// src/endpoints/ansari/nudges.ts
import type { Endpoint } from 'payload'

import { runNudgePipeline } from '@/ansari/pipeline'
import { authorizeAnsari, loadOwnState } from './shared'

export const ansariNudgesEndpoint: Endpoint = {
  path: '/ansari/nudges',
  method: 'get',
  handler: async (req) => {
    const auth = authorizeAnsari(req)
    if (auth instanceof Response) return auth
    const nudges = await runNudgePipeline(req.payload, auth.tenantId)
    return Response.json({ nudges })
  },
}

/**
 * GET /api/ansari/nudges/awaiting — what is awaiting THIS admin's decision.
 *
 * This is the reply-routing read. The cron delivers a nudge out-of-band, so the
 * interactive Ansari session never "saw" it. When the admin replies ("yes",
 * "not now"…) the agent calls this to recover the pending nudge(s) — full
 * intent + action + id — and route the reply to apply/dismiss/snooze/mute.
 *
 * Pure read: it does NOT run the pipeline (no emit, no sweep). Returns nudges
 * that have been emitted/delivered but not yet decided, newest first, so a bare
 * one-word reply resolves to the most recent when there is exactly one.
 */
export const ansariNudgesAwaitingEndpoint: Endpoint = {
  path: '/ansari/nudges/awaiting',
  method: 'get',
  handler: async (req) => {
    const auth = authorizeAnsari(req)
    if (auth instanceof Response) return auth
    const res = await req.payload.find({
      collection: 'nudge-states',
      where: {
        tenant: { equals: auth.tenantId },
        status: { in: ['emitted', 'delivered'] },
        resolvedAt: { exists: false },
      },
      sort: '-emittedAt',
      limit: 25,
      depth: 0,
      overrideAccess: true,
    })
    const awaiting = (
      res.docs as Array<{
        id: string | number
        rule: string
        intent?: Record<string, unknown> | null
        action?: Record<string, unknown> | null
        emittedAt?: string | null
        deliveredAt?: string | null
      }>
    ).map((d) => ({
      id: d.id,
      rule: d.rule,
      intent: d.intent ?? null,
      action: d.action ?? null,
      emittedAt: d.emittedAt ?? null,
      deliveredAt: d.deliveredAt ?? null,
    }))
    return Response.json({ awaiting })
  },
}

export const ansariNudgeAckEndpoint: Endpoint = {
  path: '/ansari/nudges/:id/ack',
  method: 'post',
  handler: async (req) => {
    const auth = authorizeAnsari(req)
    if (auth instanceof Response) return auth
    const state = await loadOwnState(req, auth.tenantId, req.routeParams?.id)
    if (state === 'missing') return Response.json({ ok: true, status: 'unknown' })
    // Treat foreign exactly like missing — don't reveal existence via 404 vs 200
    if (state === 'foreign') return Response.json({ ok: true, status: 'unknown' })
    if (state === 'error') {
      return Response.json({ status: 'error', message: 'Temporary failure — try again' }, { status: 500 })
    }
    if (state.status === 'emitted') {
      await req.payload.update({
        collection: 'nudge-states',
        id: state.id,
        data: { status: 'delivered', deliveredAt: new Date().toISOString() },
        overrideAccess: true,
      })
    }
    return Response.json({ ok: true, status: state.status === 'emitted' ? 'delivered' : state.status })
  },
}
