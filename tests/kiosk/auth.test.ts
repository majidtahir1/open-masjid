import { describe, it, expect } from 'vitest'
import { hashSecret, verifySecret, generateDeviceSecret } from '@/lib/kiosk/auth'

describe('kiosk auth', () => {
  it('generateDeviceSecret returns a 64-char hex string', () => {
    const secret = generateDeviceSecret()
    expect(secret).toMatch(/^[a-f0-9]{64}$/)
  })

  it('hashSecret produces a bcrypt hash that verifySecret can validate', async () => {
    const secret = generateDeviceSecret()
    const hash = await hashSecret(secret)
    expect(hash).toMatch(/^\$2[aby]\$/)
    expect(await verifySecret(secret, hash)).toBe(true)
  })

  it('verifySecret returns false for mismatched secret', async () => {
    const hash = await hashSecret(generateDeviceSecret())
    expect(await verifySecret(generateDeviceSecret(), hash)).toBe(false)
  })
})
