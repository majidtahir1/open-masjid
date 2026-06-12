// src/endpoints/ansari/nudgeActions.ts
import type { Endpoint, PayloadRequest } from 'payload'

import { canonical } from '@/ansari/canonical'
import { tenantTimezone } from '@/ansari/pipeline'
import { ruleById } from '@/ansari/registry'
import type { RuleId } from '@/ansari/ruleIds'
import type { NudgeContext } from '@/ansari/types'
import { authorizeAnsari, hasApiScope, loadOwnState, type NudgeStateDoc } from './shared'

const TERMINAL = ['applied', 'dismissed', 'resolved']

async function setStatus(
  req: PayloadRequest,
  id: string | number,
  data: Record<string, unknown>,
): Promise<void> {
  await req.payload.update({ collection: 'nudge-states', id, data, overrideAccess: true })
}

type Loaded = { tenantId: string | number; state: NudgeStateDoc }

async function loadForAction(req: PayloadRequest): Promise<Loaded | Response | 'gone'> {
  const auth = authorizeAnsari(req)
  if (auth instanceof Response) return auth
  const state = await loadOwnState(req, auth.tenantId, req.routeParams?.id)
  if (state === 'missing') return 'gone'
  // Treat foreign exactly like missing — don't reveal existence via 404 vs 200
  if (state === 'foreign') return 'gone'
  if (state === 'error') {
    return Response.json({ status: 'error', message: 'Temporary failure — try again' }, { status: 500 })
  }
  return { tenantId: auth.tenantId, state }
}

export const ansariNudgeApplyEndpoint: Endpoint = {
  path: '/ansari/nudges/:id/apply',
  method: 'post',
  handler: async (req) => {
    const loaded = await loadForAction(req)
    if (loaded instanceof Response) return loaded
    // Stale Telegram buttons must always land somewhere graceful — never a 404.
    if (loaded === 'gone') {
      return Response.json({ status: 'already-handled', message: 'This nudge no longer exists.' })
    }
    const { tenantId, state } = loaded
    if (TERMINAL.includes(state.status)) return Response.json({ status: 'already-handled' })

    const rule = ruleById(state.rule)
    if (!rule) return Response.json({ status: 'error', message: `Unknown rule ${state.rule}` }, { status: 500 })
    if (rule.requiredScope && !hasApiScope(req, rule.requiredScope)) {
      return Response.json({ error: `Forbidden — missing ${rule.requiredScope} scope` }, { status: 403 })
    }

    const ctx: NudgeContext = {
      payload: req.payload,
      tenant: { id: tenantId, timezone: await tenantTimezone(req.payload, tenantId) },
      now: new Date(),
    }

    // Re-validation reuses evaluate() — discovery and apply share one source of truth.
    let fresh: Awaited<ReturnType<typeof rule.evaluate>>[number] | undefined
    try {
      fresh = (await rule.evaluate(ctx)).find((f) => f.dedupKey === state.dedupKey)
    } catch (err) {
      req.payload.logger.error({ err, rule: state.rule, tenant: tenantId }, 'nudge evaluate failed on apply')
      return Response.json({ status: 'error', message: 'Temporary failure — try again' }, { status: 500 })
    }

    if (!fresh) {
      await setStatus(req, state.id, { status: 'resolved', resolvedAt: ctx.now.toISOString() })
      return Response.json({ status: 'already-handled' })
    }

    // Use key-order-independent comparison — stored actions round-trip through
    // Postgres jsonb which does NOT preserve key order.
    if (canonical(fresh.action) !== canonical(state.action)) {
      await setStatus(req, state.id, { action: fresh.action, intent: fresh.intent, status: 'emitted' })
      return Response.json({
        status: 'changed',
        nudge: { id: state.id, rule: state.rule, intent: fresh.intent, action: fresh.action },
      })
    }

    if (fresh.action.kind === 'conversation-starter' || !rule.execute) {
      // Claim before returning handoff — marks state terminal before any side-effects.
      const claim = await req.payload.update({
        collection: 'nudge-states',
        where: { id: { equals: state.id }, status: { not_in: ['applied', 'dismissed', 'resolved'] } },
        data: { status: 'applied' },
        overrideAccess: true,
      })
      if ((claim as { docs: unknown[] }).docs.length === 0) return Response.json({ status: 'already-handled' })
      return Response.json({
        status: 'handoff',
        intent: fresh.intent,
        topic: fresh.action.kind === 'conversation-starter' ? fresh.action.topic : null,
      })
    }

    // Claim before execute — marks state terminal before any side-effects so
    // concurrent taps cannot both run execute (e.g. events.low_rsvp creates an
    // announcement). If the claim races and loses, bail out gracefully.
    const claim = await req.payload.update({
      collection: 'nudge-states',
      where: { id: { equals: state.id }, status: { not_in: ['applied', 'dismissed', 'resolved'] } },
      data: { status: 'applied' },
      overrideAccess: true,
    })
    if ((claim as { docs: unknown[] }).docs.length === 0) return Response.json({ status: 'already-handled' })

    try {
      const result = await rule.execute(ctx, fresh)
      return Response.json({ status: 'applied', detail: result.detail })
    } catch (err) {
      req.payload.logger.error({ err, rule: state.rule, tenant: tenantId }, 'nudge execute failed on apply')
      // Best-effort revert so the admin can retry; cast to avoid exhaustive status enum check
      await req.payload
        .update({
          collection: 'nudge-states',
          id: state.id,
          data: { status: state.status as 'emitted' | 'delivered' | 'snoozed' },
          overrideAccess: true,
        })
        .catch(() => undefined)
      return Response.json({ status: 'error', message: 'Temporary failure — try again' }, { status: 500 })
    }
  },
}

export const ansariNudgeDismissEndpoint: Endpoint = {
  path: '/ansari/nudges/:id/dismiss',
  method: 'post',
  handler: async (req) => {
    const loaded = await loadForAction(req)
    if (loaded instanceof Response) return loaded
    if (loaded === 'gone') return Response.json({ ok: true, status: 'unknown' })
    await setStatus(req, loaded.state.id, { status: 'dismissed' })
    return Response.json({ ok: true, status: 'dismissed' })
  },
}

export const ansariNudgeSnoozeEndpoint: Endpoint = {
  path: '/ansari/nudges/:id/snooze',
  method: 'post',
  handler: async (req) => {
    const loaded = await loadForAction(req)
    if (loaded instanceof Response) return loaded
    if (loaded === 'gone') return Response.json({ ok: true, status: 'unknown' })
    await setStatus(req, loaded.state.id, { status: 'snoozed', snoozedAt: new Date().toISOString() })
    return Response.json({ ok: true, status: 'snoozed' })
  },
}

export const ansariNudgeMuteEndpoint: Endpoint = {
  path: '/ansari/nudges/:id/mute',
  method: 'post',
  handler: async (req) => {
    const loaded = await loadForAction(req)
    if (loaded instanceof Response) return loaded
    if (loaded === 'gone') return Response.json({ ok: true, status: 'unknown' })
    const { tenantId, state } = loaded

    const res = await req.payload.find({
      collection: 'ansari-settings',
      where: { tenant: { equals: tenantId } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const settings = res.docs[0] as { id: string | number; disabledRules?: string[] | null } | undefined
    if (settings) {
      const merged = Array.from(new Set([...(settings.disabledRules ?? []), state.rule])) as RuleId[]
      await req.payload.update({
        collection: 'ansari-settings',
        id: settings.id,
        data: { disabledRules: merged },
        overrideAccess: true,
      })
    } else {
      await req.payload.create({
        collection: 'ansari-settings',
        data: { tenant: Number(tenantId), disabledRules: [state.rule as RuleId] },
        overrideAccess: true,
      })
    }
    await setStatus(req, state.id, { status: 'dismissed' })

    // Stamp resolvedAt on all un-stamped nudge-states for this rule+tenant so
    // muted rules' states drop out of the open set and don't occupy suppression
    // queries forever.
    const openStates = await req.payload.find({
      collection: 'nudge-states',
      where: {
        tenant: { equals: tenantId },
        rule: { equals: state.rule },
        resolvedAt: { exists: false },
      },
      limit: 500,
      depth: 0,
      overrideAccess: true,
    })
    const nowIso = new Date().toISOString()
    for (const st of openStates.docs as Array<{ id: string | number }>) {
      await req.payload.update({
        collection: 'nudge-states',
        id: st.id,
        data: { resolvedAt: nowIso },
        overrideAccess: true,
      })
    }

    return Response.json({ ok: true, status: 'muted', rule: state.rule })
  },
}
