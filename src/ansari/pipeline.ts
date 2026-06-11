// src/ansari/pipeline.ts
import type { Payload } from 'payload'

import { RULES } from './registry'
import { digestDedupKey } from './rules/digest-weekly'
import { localParts } from './time'
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
  resolvedAt?: string | null
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

  // Track which rules threw so we do not falsely resolve their states.
  const failedRules = new Set<string>()

  const findings: Array<{ rule: Rule; finding: Finding }> = []
  for (const rule of nonDigest) {
    try {
      for (const f of await rule.evaluate(ctx)) findings.push({ rule, finding: f })
    } catch (err: unknown) {
      // one broken rule must not silence the rest
      failedRules.add(rule.id)
      ;(payload as unknown as { logger: { error: (...a: unknown[]) => void } }).logger.error(
        { err, rule: rule.id, tenant: tenantId },
        'nudge rule evaluation failed',
      )
    }
  }

  // Widen to all unresolved states including terminal ones (dismissed/applied),
  // so we can:
  //  a) suppress re-creation while the problem persists, and
  //  b) stamp resolvedAt when the condition clears (removing them from future suppression).
  const statesRes = await payload.find({
    collection: 'nudge-states',
    where: {
      tenant: { equals: tenantId },
      status: { in: ['emitted', 'delivered', 'snoozed', 'dismissed', 'applied'] },
      resolvedAt: { exists: false },
    },
    limit: 500,
    depth: 0,
    overrideAccess: true,
  })

  // Fix 5: visibility on overflow — alert if we may be missing states.
  if (statesRes.totalDocs > 500) {
    ;(payload as unknown as { logger: { warn: (...a: unknown[]) => void } }).logger.warn(
      { tenant: tenantId, totalDocs: statesRes.totalDocs },
      'nudge-states open set exceeds query limit',
    )
  }

  const rawOpen = statesRes.docs as StateDoc[]

  // Fix 3: concurrent-poll race heals here — when two states share a dedupKey,
  // keep the smallest id and immediately resolve the others.
  const seenKeys = new Map<string, StateDoc>()
  const healIds = new Set<string | number>()
  for (const st of rawOpen) {
    const prior = seenKeys.get(st.dedupKey)
    if (!prior) {
      seenKeys.set(st.dedupKey, st)
    } else {
      // Keep the one with the smaller id; mark the other for healing.
      const [keep, discard] =
        (prior.id as number) <= (st.id as number) ? [prior, st] : [st, prior]
      seenKeys.set(st.dedupKey, keep)
      healIds.add(discard.id)
    }
  }
  // Heal duplicates immediately before any other updates.
  // When the discarded duplicate is already terminal (dismissed/applied),
  // preserve its status and only stamp resolvedAt — same rule as the sweep below.
  for (const id of healIds) {
    const discarded = rawOpen.find((st) => st.id === id)!
    const isTerminal = discarded.status === 'dismissed' || discarded.status === 'applied'
    await payload.update({
      collection: 'nudge-states',
      id,
      data: isTerminal ? { resolvedAt: now.toISOString() } : { status: 'resolved', resolvedAt: now.toISOString() },
      overrideAccess: true,
    })
  }
  // open: only the survivors (no healed duplicates).
  const open = rawOpen.filter((st) => !healIds.has(st.id))

  // Resolution sweep: a tracked problem that stopped firing is resolved.
  // emitted/delivered/snoozed → set status=resolved + resolvedAt (full close).
  // dismissed/applied        → set resolvedAt ONLY (preserves audit trail; the
  //   stamp removes it from future suppression so a genuine recurrence under a
  //   reused key is treated as fresh).
  const currentKeys = new Set(findings.map((f) => f.finding.dedupKey))
  const thisWeekDigestKey = digestDedupKey(now, timezone)
  for (const st of open) {
    // Skip states whose rule failed evaluation — we don't know if the condition cleared.
    if (failedRules.has(st.rule)) continue

    const isStaleDigest = st.rule === 'digest.weekly' && st.dedupKey !== thisWeekDigestKey
    const isResolvedProblem =
      st.rule !== 'digest.weekly' &&
      !settings.disabledRules.includes(st.rule) &&
      !currentKeys.has(st.dedupKey)
    if (!isStaleDigest && !isResolvedProblem) continue

    const isTerminal = st.status === 'dismissed' || st.status === 'applied'
    if (isTerminal) {
      // Preserve the terminal status; just stamp resolvedAt so the record
      // drops out of future suppression queries.
      await payload.update({
        collection: 'nudge-states',
        id: st.id,
        data: { resolvedAt: now.toISOString() },
        overrideAccess: true,
      })
    } else {
      await payload.update({
        collection: 'nudge-states',
        id: st.id,
        data: { status: 'resolved', resolvedAt: now.toISOString() },
        overrideAccess: true,
      })
    }
  }

  // Digest evaluates AFTER the sweep so its unresolved list is fresh.
  const digestOpen = inDigestWindow(now, timezone, settings)
  if (digestRule && digestOpen) {
    try {
      for (const f of await digestRule.evaluate(ctx)) findings.push({ rule: digestRule, finding: f })
    } catch (err: unknown) {
      // digest failure must not block immediates
      failedRules.add(digestRule.id)
      ;(payload as unknown as { logger: { error: (...a: unknown[]) => void } }).logger.error(
        { err, rule: digestRule.id, tenant: tenantId },
        'nudge rule evaluation failed',
      )
    }
  }

  // Build the open-by-key map from the de-duped, non-healed survivors.
  const openByKey = new Map(open.map((st) => [st.dedupKey, st]))
  const quiet = inQuietHours(now, timezone, settings)
  const out: EmittedNudge[] = []

  for (const { rule, finding } of findings) {
    const gateClosed = rule.tier === 'immediate' ? quiet : !digestOpen
    const existing = openByKey.get(finding.dedupKey)

    if (existing) {
      // Suppression: ANY open state with the matching dedupKey blocks re-creation
      // while the problem persists — regardless of terminal status (dismissed/applied).
      // Re-emit to output ONLY when status is 'emitted' and the tier gate is open;
      // delivered/snoozed/dismissed/applied stay silent.
      if (existing.status === 'emitted' && !gateClosed) {
        out.push({ id: existing.id, rule: rule.id, tier: rule.tier, intent: finding.intent, action: finding.action })
      }
      continue
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
