import { describe, it, expect } from 'vitest'
import { Posts } from '@/collections/Posts'

function callAccess(op: 'read' | 'create' | 'update' | 'delete', user: any) {
  const access = Posts.access as Record<string, any>
  return access[op]({ req: { user } })
}

describe('Posts access', () => {
  it('anonymous can read published only', () => {
    expect(callAccess('read', undefined)).toEqual({ _status: { equals: 'published' } })
  })

  it('non-owner authenticated users still see published only', () => {
    expect(callAccess('read', { role: 'admin', tenant: 7 })).toEqual({
      _status: { equals: 'published' },
    })
  })

  it('platformOwner reads everything (incl. drafts)', () => {
    expect(callAccess('read', { role: 'platformOwner' })).toBe(true)
  })

  it('only platformOwner can write', () => {
    for (const op of ['create', 'update', 'delete'] as const) {
      expect(callAccess(op, undefined)).toBe(false)
      expect(callAccess(op, { role: 'admin', tenant: 7 })).toBe(false)
      expect(callAccess(op, { role: 'platformOwner' })).toBe(true)
    }
  })
})

describe('Posts schema', () => {
  const field = (name: string) =>
    (Posts.fields as any[]).find((f) => f.name === name)

  it('has no tenant field (platform-level collection)', () => {
    expect(field('tenant')).toBeUndefined()
  })

  it('kind defaults to article with two options', () => {
    const kind = field('kind')
    expect(kind.type).toBe('select')
    expect(kind.defaultValue).toBe('article')
    expect(kind.options.map((o: any) => o.value).sort()).toEqual(['article', 'changelog'])
  })

  it('enables drafts with scheduled publish', () => {
    expect(Posts.versions).toMatchObject({ drafts: { schedulePublish: true } })
  })

  it('hides the collection from non-platform-owners', () => {
    const hidden = Posts.admin?.hidden as (args: any) => boolean
    expect(hidden({ user: { role: 'admin' } })).toBe(true)
    expect(hidden({ user: { role: 'platformOwner' } })).toBe(false)
  })
})
