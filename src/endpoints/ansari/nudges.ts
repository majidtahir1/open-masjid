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
    const id = req.routeParams?.id
    const state = await loadOwnState(req, auth.tenantId, id)
    if (state === 'missing') return Response.json({ ok: true, status: 'unknown' })
    if (state === 'foreign') return Response.json({ error: 'Not found' }, { status: 404 })
    if (state.status === 'emitted') {
      await req.payload.update({
        collection: 'nudge-states',
        id: id as string,
        data: { status: 'delivered', deliveredAt: new Date().toISOString() },
        overrideAccess: true,
      })
    }
    return Response.json({ ok: true, status: 'delivered' })
  },
}
