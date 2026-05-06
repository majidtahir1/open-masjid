// tests/collections/form-submissions.access.test.ts
import { describe, it, expect } from 'vitest'
import { FormSubmissions } from '@/collections/FormSubmissions'

const callAccess = (op: 'read'|'create'|'update'|'delete', user: any) =>
  (FormSubmissions.access![op] as Function)({ req: { user }, id: undefined })

describe('FormSubmissions access', () => {
  it('denies create/update/delete from any user', () => {
    expect(callAccess('create', { role: 'platformOwner' })).toBe(false)
    expect(callAccess('update', { role: 'platformOwner' })).toBe(false)
    expect(callAccess('delete', { role: 'platformOwner' })).toBe(false)
  })
  it('tenant-scopes reads', () => {
    expect(callAccess('read', { id: 'u', role: 'admin', tenant: { id: 't' } }))
      .toEqual({ tenant: { equals: 't' } })
  })
})
