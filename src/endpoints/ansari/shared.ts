// src/endpoints/ansari/shared.ts
import type { PayloadRequest } from 'payload'

import { isApiKeyAuth } from '@/access/apiScoped'

export function extractId(rel: unknown): string | number | null {
  if (rel == null) return null
  if (typeof rel === 'object' && 'id' in rel) return (rel as { id: string | number }).id
  return rel as string | number
}

/**
 * All /api/ansari/* endpoints: session admins/platformOwners pass; API keys
 * must carry the ansari:nudges scope. Returns the caller's tenant id.
 *
 * Note: unlike gateByApiKeyScope's legacy-key leniency (which tolerates empty
 * apiScopes for backward-compat), empty apiScopes is rejected here by design —
 * Ansari nudges are a sensitive write surface and we require an explicit grant.
 */
export function authorizeAnsari(req: PayloadRequest): { tenantId: string | number } | Response {
  const user = req.user as
    | { role?: string; tenant?: unknown; apiScopes?: string[] | null }
    | null
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (isApiKeyAuth(req)) {
    if (!(user.apiScopes ?? []).includes('ansari:nudges')) {
      return Response.json({ error: 'Forbidden — missing ansari:nudges scope' }, { status: 403 })
    }
  } else if (user.role !== 'admin' && user.role !== 'platformOwner') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }
  const tenantId = extractId(user.tenant)
  if (!tenantId) return Response.json({ error: 'No tenant on this account' }, { status: 400 })
  return { tenantId }
}

export function hasApiScope(req: PayloadRequest, scope: string): boolean {
  if (!isApiKeyAuth(req)) return true // session admins already passed role checks
  const scopes = (req.user as { apiScopes?: string[] | null } | null)?.apiScopes ?? []
  return scopes.includes(scope)
}

export type NudgeStateDoc = {
  id: string | number
  tenant: unknown
  rule: string
  dedupKey: string
  status: string
  tier: string
  intent?: Record<string, unknown>
  action?: Record<string, unknown>
}

/** Load a nudge state, enforcing tenant ownership. */
export async function loadOwnState(
  req: PayloadRequest,
  tenantId: string | number,
  id: unknown,
): Promise<NudgeStateDoc | 'missing' | 'foreign' | 'error'> {
  try {
    const doc = (await req.payload.findByID({
      collection: 'nudge-states',
      id: id as string,
      depth: 0,
      overrideAccess: true,
    })) as NudgeStateDoc | null
    if (!doc) return 'missing'
    if (String(extractId(doc.tenant)) !== String(tenantId)) return 'foreign'
    return doc
  } catch (err) {
    // Only treat a genuine Not Found (404) as missing; all other errors
    // (DB down, network timeout, etc.) bubble up as 'error' so callers
    // can return a 500 instead of silently answering 200 already-handled.
    if ((err as { status?: number })?.status === 404) return 'missing'
    return 'error'
  }
}
