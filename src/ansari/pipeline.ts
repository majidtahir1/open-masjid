// src/ansari/pipeline.ts
import type { Payload } from 'payload'

import { RULES } from './registry'
import { isoWeekKey, localParts } from './time'
import type { ActionDescriptor, Finding, NudgeContext, NudgeTier, Rule } from './types'

export type NudgeSettings = {
  enabled: boolean
  disabledRules: string[]
  quietHoursStart: number
  quietHoursEnd: number
  digestDay: number // 0=Sunday … 6=Saturday
  digestHour: number
}

export const DEFAULT_SETTINGS: NudgeSettings = {
  enabled: true,
  disabledRules: [],
  quietHoursStart: 21,
  quietHoursEnd: 8,
  digestDay: 0,
  digestHour: 9,
}

export function inQuietHours(now: Date, timezone: string, s: NudgeSettings): boolean {
  const { hour } = localParts(now, timezone)
  const { quietHoursStart: start, quietHoursEnd: end } = s
  if (start === end) return false
  return start > end ? hour >= start || hour < end : hour >= start && hour < end
}

export function inDigestWindow(now: Date, timezone: string, s: NudgeSettings): boolean {
  const { weekday, hour } = localParts(now, timezone)
  // >= so a missed poll at the exact hour doesn't skip a whole week;
  // the digest's week-keyed dedup keeps it to once.
  return weekday === s.digestDay && hour >= s.digestHour
}

export async function loadSettings(payload: Payload, tenantId: string | number): Promise<NudgeSettings> {
  const res = await payload.find({
    collection: 'ansari-settings',
    where: { tenant: { equals: tenantId } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const doc = res.docs[0] as
    | {
        enabled?: boolean | null
        disabledRules?: string[] | null
        quietHoursStart?: number | null
        quietHoursEnd?: number | null
        digestDay?: string | number | null
        digestHour?: number | null
      }
    | undefined
  if (!doc) return DEFAULT_SETTINGS
  return {
    enabled: doc.enabled ?? true,
    disabledRules: doc.disabledRules ?? [],
    quietHoursStart: doc.quietHoursStart ?? DEFAULT_SETTINGS.quietHoursStart,
    quietHoursEnd: doc.quietHoursEnd ?? DEFAULT_SETTINGS.quietHoursEnd,
    digestDay: Number(doc.digestDay ?? DEFAULT_SETTINGS.digestDay),
    digestHour: doc.digestHour ?? DEFAULT_SETTINGS.digestHour,
  }
}

/**
 * Resolve the tenant's IANA timezone string, falling back to 'UTC' if:
 * - the findByID call throws
 * - the timezone field is blank
 * - the string is not a valid IANA timezone (Intl will throw RangeError)
 */
export async function tenantTimezone(payload: Payload, tenantId: string | number): Promise<string> {
  try {
    const tenant = (await payload.findByID({
      collection: 'tenants',
      id: tenantId,
      depth: 0,
      overrideAccess: true,
    })) as { location?: { timezone?: string | null } } | null
    const tz = tenant?.location?.timezone || 'UTC'
    // Validate: Intl throws RangeError for unrecognised IANA identifiers
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: tz })
    } catch {
      return 'UTC'
    }
    return tz
  } catch {
    return 'UTC'
  }
}

export type EmittedNudge = {
  id: string | number
  rule: string
  tier: NudgeTier
  intent: Record<string, unknown>
  action: ActionDescriptor
}

type StateDoc = {
  id: string | number
  rule: string
  dedupKey: string
  status: string
  tier: string
}

export async function runNudgePipeline(
  payload: Payload,
  tenantId: string | number,
  now: Date = new Date(),
): Promise<EmittedNudge[]> {
  const timezone = await tenantTimezone(payload, tenantId)
  const settings = await loadSettings(payload, tenantId)
  if (!settings.enabled) return []

  const ctx: NudgeContext = { payload, tenant: { id: tenantId, timezone }, now }
  const active = RULES.filter((r) => !settings.disabledRules.includes(r.id))
  const digestRule = active.find((r) => r.id === 'digest.weekly')
  const nonDigest = active.filter((r) => r.id !== 'digest.weekly')

  const findings: Array<{ rule: Rule; finding: Finding }> = []
  for (const rule of nonDigest) {
    try {
      for (const f of await rule.evaluate(ctx)) findings.push({ rule, finding: f })
    } catch {
      // one broken rule must not silence the rest
    }
  }

  const statesRes = await payload.find({
    collection: 'nudge-states',
    where: { tenant: { equals: tenantId }, status: { in: ['emitted', 'delivered', 'snoozed'] } },
    limit: 500,
    depth: 0,
    overrideAccess: true,
  })
  const open = statesRes.docs as StateDoc[]

  // Resolution sweep: a tracked problem that stopped firing is resolved.
  const currentKeys = new Set(findings.map((f) => f.finding.dedupKey))
  const thisWeekDigestKey = `digest:${isoWeekKey(now, timezone)}`
  for (const st of open) {
    const isStaleDigest = st.rule === 'digest.weekly' && st.dedupKey !== thisWeekDigestKey
    const isResolvedProblem =
      st.rule !== 'digest.weekly' &&
      !settings.disabledRules.includes(st.rule) &&
      !currentKeys.has(st.dedupKey)
    if (!isStaleDigest && !isResolvedProblem) continue
    await payload.update({
      collection: 'nudge-states',
      id: st.id,
      data: { status: 'resolved', resolvedAt: now.toISOString() },
      overrideAccess: true,
    })
  }

  // Digest evaluates AFTER the sweep so its unresolved list is fresh.
  const digestOpen = inDigestWindow(now, timezone, settings)
  if (digestRule && digestOpen) {
    try {
      for (const f of await digestRule.evaluate(ctx)) findings.push({ rule: digestRule, finding: f })
    } catch {
      // digest failure must not block immediates
    }
  }

  const openByKey = new Map(open.map((st) => [st.dedupKey, st]))
  const quiet = inQuietHours(now, timezone, settings)
  const out: EmittedNudge[] = []

  for (const { rule, finding } of findings) {
    const gateClosed = rule.tier === 'immediate' ? quiet : !digestOpen
    const existing = openByKey.get(finding.dedupKey)

    if (existing) {
      // at-least-once: emitted-but-never-acked keeps returning (when its gate is open)
      if (existing.status === 'emitted' && !gateClosed) {
        out.push({ id: existing.id, rule: rule.id, tier: rule.tier, intent: finding.intent, action: finding.action })
      }
      continue // delivered → fire-once silence; snoozed → resurfaces via digest content
    }

    if (gateClosed) continue // held, NOT recorded — fires on the next in-window poll

    const created = (await payload.create({
      collection: 'nudge-states',
      data: {
        tenant: Number(tenantId),
        rule: rule.id,
        dedupKey: finding.dedupKey,
        tier: rule.tier,
        status: 'emitted',
        intent: finding.intent,
        action: finding.action,
        emittedAt: now.toISOString(),
      },
      overrideAccess: true,
    })) as { id: string | number }
    out.push({ id: created.id, rule: rule.id, tier: rule.tier, intent: finding.intent, action: finding.action })
  }
  return out
}
