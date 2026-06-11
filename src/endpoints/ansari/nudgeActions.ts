// src/endpoints/ansari/nudgeActions.ts
import type { Endpoint, PayloadRequest } from 'payload'

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
  if (state === 'foreign') return Response.json({ error: 'Not found' }, { status: 404 })
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
    const fresh = (await rule.evaluate(ctx)).find((f) => f.dedupKey === state.dedupKey)
    if (!fresh) {
      await setStatus(req, state.id, { status: 'resolved', resolvedAt: ctx.now.toISOString() })
      return Response.json({ status: 'already-handled' })
    }

    // The admin only ever gets what they actually confirmed.
    if (JSON.stringify(fresh.action) !== JSON.stringify(state.action)) {
      await setStatus(req, state.id, { action: fresh.action, intent: fresh.intent, status: 'emitted' })
      return Response.json({
        status: 'changed',
        nudge: { id: state.id, rule: state.rule, intent: fresh.intent, action: fresh.action },
      })
    }

    if (fresh.action.kind === 'conversation-starter' || !rule.execute) {
      await setStatus(req, state.id, { status: 'applied' })
      return Response.json({
        status: 'handoff',
        intent: fresh.intent,
        topic: fresh.action.kind === 'conversation-starter' ? fresh.action.topic : null,
      })
    }

    const result = await rule.execute(ctx, fresh)
    await setStatus(req, state.id, { status: 'applied' })
    return Response.json({ status: 'applied', detail: result.detail })
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
    return Response.json({ ok: true, status: 'muted', rule: state.rule })
  },
}
