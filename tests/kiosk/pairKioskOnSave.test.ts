import { describe, it, expect } from 'vitest'
import { pairKioskOnSave } from '@/hooks/pairKioskOnSave'

// The hook only reads `data` and `originalDoc`; cast a minimal args object.
const run = (data: Record<string, unknown>, originalDoc?: Record<string, unknown>) =>
  pairKioskOnSave({ data, originalDoc } as never) as Promise<Record<string, unknown>>

describe('pairKioskOnSave', () => {
  it('normalizes the code and stamps an expiry when pairing on create', async () => {
    const out = await run({ name: 'Lobby', pairingCode: 'x4j-3gs' })
    expect(out.pairingCode).toBe('X4J-3GS')
    expect(typeof out.pairingCodeExpiresAt).toBe('string')
    expect(new Date(out.pairingCodeExpiresAt as string).getTime()).toBeGreaterThan(Date.now())
  })

  it('re-opens an already-paired kiosk by clearing prior credentials', async () => {
    const out = await run(
      { pairingCode: 'X4J-3GS' },
      { deviceId: 'old-device', secretHash: 'old-hash', status: 'ONLINE', pairingCode: null },
    )
    expect(out.pairingCode).toBe('X4J-3GS')
    expect(out.deviceId).toBeNull()
    expect(out.secretHash).toBeNull()
    expect(out.status).toBe('UNPAIRED')
  })

  it('is idempotent for an in-flight code re-save (keeps expiry, no reset)', async () => {
    const out = await run(
      { pairingCode: 'X4J-3GS', deviceId: null },
      { pairingCode: 'X4J-3GS', pairingCodeExpiresAt: '2999-01-01T00:00:00.000Z' },
    )
    expect(out.pairingCode).toBe('X4J-3GS')
    // The idempotent branch must not re-stamp expiry or touch credentials.
    expect(out).not.toHaveProperty('pairingCodeExpiresAt')
    expect(out).not.toHaveProperty('status')
  })

  it('throws on a malformed code', async () => {
    await expect(run({ pairingCode: 'nope' })).rejects.toThrow(/Invalid pairing code/)
  })

  it('passes through untouched when no code is provided', async () => {
    const data = { name: 'Hall' }
    expect(await run(data)).toBe(data)
  })
})
