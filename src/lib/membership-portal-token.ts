import crypto from 'node:crypto'

interface PortalTokenPayload {
  tenantId: string | number
  customerId: string
  exp: number
  nonce: string
}

function secret(): string {
  const s = process.env.PAYLOAD_SECRET
  if (!s) throw new Error('PAYLOAD_SECRET is not set')
  return s
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function b64urlDecode(input: string): Buffer {
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4))
  return Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64')
}

export function signMembershipPortalToken(args: {
  tenantId: string | number
  customerId: string
  expiresInSec?: number
}): string {
  const payload: PortalTokenPayload = {
    tenantId: args.tenantId,
    customerId: args.customerId,
    exp: Math.floor(Date.now() / 1000) + (args.expiresInSec ?? 900),
    nonce: crypto.randomBytes(8).toString('hex'),
  }
  const body = b64url(JSON.stringify(payload))
  const sig = b64url(crypto.createHmac('sha256', secret()).update(body).digest())
  return `${body}.${sig}`
}

export function verifyMembershipPortalToken(token: string): {
  tenantId: string | number
  customerId: string
} {
  const parts = token.split('.')
  if (parts.length !== 2) throw new Error('malformed portal token')

  const [body, sig] = parts
  if (!body || !sig) throw new Error('malformed portal token')

  const expected = b64url(crypto.createHmac('sha256', secret()).update(body).digest())
  const sigBuf = Buffer.from(sig)
  const expectedBuf = Buffer.from(expected)
  if (sigBuf.length !== expectedBuf.length) throw new Error('invalid portal token')
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) throw new Error('invalid portal token')

  const payload = JSON.parse(b64urlDecode(body).toString('utf8')) as PortalTokenPayload
  if (payload.exp < Math.floor(Date.now() / 1000)) throw new Error('portal token expired')
  if (!payload.customerId) throw new Error('portal token missing customer')

  return {
    tenantId: payload.tenantId,
    customerId: payload.customerId,
  }
}
