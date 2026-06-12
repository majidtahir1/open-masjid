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
