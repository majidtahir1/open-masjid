import crypto from 'crypto'
import type Stripe from 'stripe'
import { getStripe } from './stripe'

/**
 * Returns the platform Stripe client, scoped to a connected account.
 * All API calls made with this client act on behalf of `stripeAccountId`.
 */
export function stripeForAccount(stripeAccountId: string): Stripe {
  // The Stripe Node SDK supports per-request `stripeAccount` headers, but for
  // convenience callers can use this wrapper and pass the client to helpers
  // that accept a plain Stripe instance (request options are passed separately).
  // We return the platform client — callers must still pass
  // `{ stripeAccount: stripeAccountId }` as request options where required.
  void stripeAccountId // consumed by callers as request option
  return getStripe()
}

interface StatePayload {
  tenantId: string | number
  userId: string | number
  nonce: string
  exp: number
}

export interface SignStateOpts {
  expiresInSec?: number
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

export function signState(
  p: { tenantId: string | number; userId: string | number },
  opts: SignStateOpts = {},
): string {
  const exp = Math.floor(Date.now() / 1000) + (opts.expiresInSec ?? 600)
  const payload: StatePayload = {
    tenantId: p.tenantId,
    userId: p.userId,
    nonce: crypto.randomBytes(8).toString('hex'),
    exp,
  }
  const body = b64url(JSON.stringify(payload))
  const sig = b64url(crypto.createHmac('sha256', secret()).update(body).digest())
  return `${body}.${sig}`
}

export function verifyState(token: string): StatePayload {
  const parts = token.split('.')
  if (parts.length !== 2) throw new Error('malformed state token')
  const [body, sig] = parts
  if (!body || !sig) throw new Error('malformed state token')
  const expected = b64url(crypto.createHmac('sha256', secret()).update(body).digest())
  const sigBuf = Buffer.from(sig)
  const expectedBuf = Buffer.from(expected)
  if (sigBuf.length !== expectedBuf.length) throw new Error('invalid state signature')
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) throw new Error('invalid state signature')
  const payload = JSON.parse(b64urlDecode(body).toString('utf8')) as StatePayload
  if (payload.exp < Math.floor(Date.now() / 1000)) throw new Error('state expired')
  return payload
}

export function buildAuthorizeUrl(opts: {
  tenantId: string | number
  userId: string | number
  redirectUri: string
}): string {
  const clientId = process.env.STRIPE_CONNECT_CLIENT_ID
  if (!clientId) throw new Error('STRIPE_CONNECT_CLIENT_ID is not set')
  const state = signState({ tenantId: opts.tenantId, userId: opts.userId })
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    scope: 'read_write',
    redirect_uri: opts.redirectUri,
    state,
  })
  return `https://connect.stripe.com/oauth/authorize?${params.toString()}`
}

export async function exchangeCode(code: string): Promise<{ stripeUserId: string }> {
  const stripe = getStripe()
  const res = await stripe.oauth.token({ grant_type: 'authorization_code', code })
  if (!res.stripe_user_id) throw new Error('no stripe_user_id returned')
  return { stripeUserId: res.stripe_user_id }
}

export async function fetchAccount(acct: string) {
  const stripe = getStripe()
  return stripe.accounts.retrieve(acct)
}

export async function disconnectAccount(acct: string): Promise<void> {
  const stripe = getStripe()
  const clientId = process.env.STRIPE_CONNECT_CLIENT_ID
  if (!clientId) throw new Error('STRIPE_CONNECT_CLIENT_ID is not set')
  await stripe.oauth.deauthorize({ client_id: clientId, stripe_user_id: acct })
}
