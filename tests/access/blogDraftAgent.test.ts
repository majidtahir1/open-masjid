import { describe, it, expect } from 'vitest'

import { gateByApiKeyScope } from '@/access/apiScoped'
import { Posts, forceDraftForScopedAgents } from '@/collections/Posts'

// A scoped API-key caller: Payload marks API-key auth via `_strategy`.
function apiKeyReq(scopes: string[]) {
  return { req: { user: { _strategy: 'api-key', apiScopes: scopes } } } as any
}

// A normal UI session for a given role (no api-key strategy).
function sessionReq(role?: string) {
  return { req: { user: role ? { role } : null } } as any
}

const allow = () => true as const

describe('SCOPE_MAP gating for posts (gateByApiKeyScope)', () => {
  it('denies read for a key lacking blog:read', async () => {
    const gated = gateByApiKeyScope('posts', 'read')(allow)
    expect(await gated(apiKeyReq(['blog:write']))).toBe(false)
  })

  it('allows read (defers to inner) for a key with blog:read', async () => {
    const gated = gateByApiKeyScope('posts', 'read')(allow)
    expect(await gated(apiKeyReq(['blog:read']))).toBe(true)
  })

  it('denies create for a key lacking blog:write', async () => {
    const gated = gateByApiKeyScope('posts', 'create')(allow)
    expect(await gated(apiKeyReq(['blog:read']))).toBe(false)
  })

  it('allows create (defers to inner) for a key with blog:write', async () => {
    const gated = gateByApiKeyScope('posts', 'create')(allow)
    expect(await gated(apiKeyReq(['blog:write']))).toBe(true)
  })

  it('allows update (defers to inner) for a key with blog:write', async () => {
    const gated = gateByApiKeyScope('posts', 'update')(allow)
    expect(await gated(apiKeyReq(['blog:write']))).toBe(true)
  })

  it('denies delete for any scoped key (delete is unmapped)', async () => {
    const gated = gateByApiKeyScope('posts', 'delete')(allow)
    expect(await gated(apiKeyReq(['blog:write']))).toBe(false)
  })
})

describe('Posts.access.read', () => {
  const read = Posts.access!.read!

  it('returns true for platformOwner (sees drafts)', async () => {
    expect(read(sessionReq('platformOwner'))).toBe(true)
  })

  it('returns true for an api-key caller (sees drafts; scope gate ensures blog:read)', async () => {
    expect(read(apiKeyReq(['blog:read']))).toBe(true)
  })

  it('restricts everyone else to published', async () => {
    expect(read(sessionReq('admin'))).toEqual({ _status: { equals: 'published' } })
    expect(read(sessionReq())).toEqual({ _status: { equals: 'published' } })
  })
})

describe('Posts.access.create', () => {
  const create = Posts.access!.create!

  it('returns true for platformOwner', async () => {
    expect(create(sessionReq('platformOwner'))).toBe(true)
  })

  it('returns true for an api-key caller (scope gate ensures blog:write)', async () => {
    expect(create(apiKeyReq(['blog:write']))).toBe(true)
  })

  it('returns false for a non-platformOwner session', async () => {
    expect(create(sessionReq('admin'))).toBe(false)
    expect(create(sessionReq('staff'))).toBe(false)
  })
})

describe('Posts.access.update', () => {
  const update = Posts.access!.update!

  it('returns true for platformOwner (may edit anything)', async () => {
    expect(update(sessionReq('platformOwner'))).toBe(true)
  })

  it('restricts an api-key caller to drafts only', async () => {
    expect(update(apiKeyReq(['blog:write']))).toEqual({ _status: { equals: 'draft' } })
  })

  it('returns false for a non-platformOwner session', async () => {
    expect(update(sessionReq('admin'))).toBe(false)
  })
})

describe('Posts.access.delete', () => {
  const del = Posts.access!.delete!

  it('returns true for platformOwner', async () => {
    expect(del(sessionReq('platformOwner'))).toBe(true)
  })

  it('returns false for an api-key caller', async () => {
    expect(del(apiKeyReq(['blog:write']))).toBe(false)
  })
})

// Regression: an UNSCOPED API key (empty apiScopes) is deferred by the central
// scope gate (back-compat), so Posts' OWN access must still deny it — being an
// API key is not enough to touch platform-global Posts.
describe('Posts.access denies unscoped / wrong-scope API keys', () => {
  const read = Posts.access!.read!
  const create = Posts.access!.create!
  const update = Posts.access!.update!

  it('read: unscoped key sees only published', async () => {
    expect(read(apiKeyReq([]))).toEqual({ _status: { equals: 'published' } })
  })
  it('read: key with only a non-blog scope sees only published', async () => {
    expect(read(apiKeyReq(['prayer-times:read']))).toEqual({ _status: { equals: 'published' } })
  })
  it('create: unscoped key cannot create', async () => {
    expect(create(apiKeyReq([]))).toBe(false)
  })
  it('create: blog:read-only key cannot create', async () => {
    expect(create(apiKeyReq(['blog:read']))).toBe(false)
  })
  it('update: unscoped key cannot update', async () => {
    expect(update(apiKeyReq([]))).toBe(false)
  })
})

describe('forceDraftForScopedAgents (beforeChange)', () => {
  it('coerces an explicit published status to draft for a blog:write api key', async () => {
    const data = { title: 'X', _status: 'published' }
    const out = forceDraftForScopedAgents({
      data,
      req: { user: { _strategy: 'api-key', apiScopes: ['blog:write'] } },
    } as any)
    expect(out._status).toBe('draft')
  })

  it('sets draft status when none is provided for a blog:write api key', async () => {
    const out = forceDraftForScopedAgents({
      data: { title: 'X' },
      req: { user: { _strategy: 'api-key', apiScopes: ['blog:write'] } },
    } as any)
    expect(out._status).toBe('draft')
  })

  it('leaves published status untouched for a platformOwner UI session', async () => {
    const data = { title: 'X', _status: 'published' }
    const out = forceDraftForScopedAgents({
      data,
      req: { user: { role: 'platformOwner' } },
    } as any)
    expect(out._status).toBe('published')
  })

  it('leaves status untouched for an api key without blog:write', async () => {
    const data = { title: 'X', _status: 'published' }
    const out = forceDraftForScopedAgents({
      data,
      req: { user: { _strategy: 'api-key', apiScopes: ['blog:read'] } },
    } as any)
    expect(out._status).toBe('published')
  })
})
