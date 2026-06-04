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
  it('denies read for a key lacking blog:read', () => {
    const gated = gateByApiKeyScope('posts', 'read')(allow)
    expect(gated(apiKeyReq(['blog:write']))).toBe(false)
  })

  it('allows read (defers to inner) for a key with blog:read', () => {
    const gated = gateByApiKeyScope('posts', 'read')(allow)
    expect(gated(apiKeyReq(['blog:read']))).toBe(true)
  })

  it('denies create for a key lacking blog:write', () => {
    const gated = gateByApiKeyScope('posts', 'create')(allow)
    expect(gated(apiKeyReq(['blog:read']))).toBe(false)
  })

  it('allows create (defers to inner) for a key with blog:write', () => {
    const gated = gateByApiKeyScope('posts', 'create')(allow)
    expect(gated(apiKeyReq(['blog:write']))).toBe(true)
  })

  it('allows update (defers to inner) for a key with blog:write', () => {
    const gated = gateByApiKeyScope('posts', 'update')(allow)
    expect(gated(apiKeyReq(['blog:write']))).toBe(true)
  })

  it('denies delete for any scoped key (delete is unmapped)', () => {
    const gated = gateByApiKeyScope('posts', 'delete')(allow)
    expect(gated(apiKeyReq(['blog:write']))).toBe(false)
  })
})

describe('Posts.access.read', () => {
  const read = Posts.access!.read!

  it('returns true for platformOwner (sees drafts)', () => {
    expect(read(sessionReq('platformOwner'))).toBe(true)
  })

  it('returns true for an api-key caller (sees drafts; scope gate ensures blog:read)', () => {
    expect(read(apiKeyReq(['blog:read']))).toBe(true)
  })

  it('restricts everyone else to published', () => {
    expect(read(sessionReq('admin'))).toEqual({ _status: { equals: 'published' } })
    expect(read(sessionReq())).toEqual({ _status: { equals: 'published' } })
  })
})

describe('Posts.access.create', () => {
  const create = Posts.access!.create!

  it('returns true for platformOwner', () => {
    expect(create(sessionReq('platformOwner'))).toBe(true)
  })

  it('returns true for an api-key caller (scope gate ensures blog:write)', () => {
    expect(create(apiKeyReq(['blog:write']))).toBe(true)
  })

  it('returns false for a non-platformOwner session', () => {
    expect(create(sessionReq('admin'))).toBe(false)
    expect(create(sessionReq('staff'))).toBe(false)
  })
})

describe('Posts.access.update', () => {
  const update = Posts.access!.update!

  it('returns true for platformOwner (may edit anything)', () => {
    expect(update(sessionReq('platformOwner'))).toBe(true)
  })

  it('restricts an api-key caller to drafts only', () => {
    expect(update(apiKeyReq(['blog:write']))).toEqual({ _status: { equals: 'draft' } })
  })

  it('returns false for a non-platformOwner session', () => {
    expect(update(sessionReq('admin'))).toBe(false)
  })
})

describe('Posts.access.delete', () => {
  const del = Posts.access!.delete!

  it('returns true for platformOwner', () => {
    expect(del(sessionReq('platformOwner'))).toBe(true)
  })

  it('returns false for an api-key caller', () => {
    expect(del(apiKeyReq(['blog:write']))).toBe(false)
  })
})

describe('forceDraftForScopedAgents (beforeChange)', () => {
  it('coerces an explicit published status to draft for a blog:write api key', () => {
    const data = { title: 'X', _status: 'published' }
    const out = forceDraftForScopedAgents({
      data,
      req: { user: { _strategy: 'api-key', apiScopes: ['blog:write'] } },
    } as any)
    expect(out._status).toBe('draft')
  })

  it('sets draft status when none is provided for a blog:write api key', () => {
    const out = forceDraftForScopedAgents({
      data: { title: 'X' },
      req: { user: { _strategy: 'api-key', apiScopes: ['blog:write'] } },
    } as any)
    expect(out._status).toBe('draft')
  })

  it('leaves published status untouched for a platformOwner UI session', () => {
    const data = { title: 'X', _status: 'published' }
    const out = forceDraftForScopedAgents({
      data,
      req: { user: { role: 'platformOwner' } },
    } as any)
    expect(out._status).toBe('published')
  })

  it('leaves status untouched for an api key without blog:write', () => {
    const data = { title: 'X', _status: 'published' }
    const out = forceDraftForScopedAgents({
      data,
      req: { user: { _strategy: 'api-key', apiScopes: ['blog:read'] } },
    } as any)
    expect(out._status).toBe('published')
  })
})
