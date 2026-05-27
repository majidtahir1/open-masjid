import { describe, it, expect } from 'vitest'
import { denyKioskManager, allowKioskManagerRead } from '@/access/kioskRoles'

const mkReq = (role: string, tenantId: string | number | null = 't1') =>
  ({
    req: {
      user: tenantId
        ? { role, tenant: { id: tenantId } }
        : { role },
    },
  }) as any

describe('kiosk role access', () => {
  it('denyKioskManager blocks kioskManager', () => {
    const inner = () => true
    expect(denyKioskManager(inner as any)(mkReq('kioskManager') as any)).toBe(false)
  })

  it('denyKioskManager defers for other roles', () => {
    const inner = () => true
    expect(denyKioskManager(inner as any)(mkReq('admin') as any)).toBe(true)
  })

  it('allowKioskManagerRead returns tenant filter for kioskManager', () => {
    const inner = () => false
    const result = allowKioskManagerRead(inner as any)(mkReq('kioskManager', 'tenantX') as any)
    expect(result).toEqual({ tenant: { equals: 'tenantX' } })
  })

  it('allowKioskManagerRead returns false when kioskManager has no tenant', () => {
    const inner = () => true
    expect(allowKioskManagerRead(inner as any)(mkReq('kioskManager', null) as any)).toBe(false)
  })

  it('allowKioskManagerRead defers for other roles', () => {
    const inner = () => 'INNER'
    expect(allowKioskManagerRead(inner as any)(mkReq('admin') as any)).toBe('INNER')
  })
})
