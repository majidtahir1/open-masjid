/**
 * Server-only helpers for the parent self check-in kiosk.
 *
 * The kiosk has no logged-in Payload user. A staff member binds an iPad once by
 * entering the tenant's `checkinKiosk.pin`; the bind endpoint then issues a
 * signed, tenant+program-scoped token that the iPad stores in localStorage and
 * presents on every lookup / check call. We verify the HMAC signature instead of
 * a session cookie, and only the narrow check-in/out surface is exposed.
 */
import { createHmac, timingSafeEqual } from 'node:crypto'

const TOKEN_TTL_MS = 180 * 24 * 60 * 60 * 1000 // 180 days
const SCOPE = 'checkin'

export interface KioskTokenClaims {
  tenantId: string
  programId: string
}

function secretKey(): string {
  const s = process.env.PAYLOAD_SECRET
  if (!s) throw new Error('PAYLOAD_SECRET is not set')
  return s
}

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function sign(payload: string): string {
  return b64url(createHmac('sha256', secretKey()).update(payload).digest())
}

/** Mint a kiosk token bound to one tenant + program. */
export function signKioskToken(claims: KioskTokenClaims): string {
  const body = {
    t: String(claims.tenantId),
    p: String(claims.programId),
    s: SCOPE,
    exp: Date.now() + TOKEN_TTL_MS,
  }
  const payload = b64url(Buffer.from(JSON.stringify(body)))
  return `${payload}.${sign(payload)}`
}

/** Verify a kiosk token; returns its claims or null when invalid/expired. */
export function verifyKioskToken(token: string | null | undefined): KioskTokenClaims | null {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null
  const [payload, sig] = token.split('.')
  if (!payload || !sig) return null

  const expected = sign(payload)
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  try {
    const body = JSON.parse(Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString())
    if (body.s !== SCOPE) return null
    if (typeof body.exp !== 'number' || body.exp < Date.now()) return null
    if (!body.t || !body.p) return null
    return { tenantId: String(body.t), programId: String(body.p) }
  } catch {
    return null
  }
}

/** Read the bearer token from an Authorization header. */
export function bearerFrom(req: Request): string | null {
  const h = req.headers.get('authorization') || req.headers.get('Authorization')
  if (!h) return null
  const m = /^Bearer\s+(.+)$/i.exec(h.trim())
  return m ? m[1] : null
}

/** Constant-time string compare for the setup PIN. */
export function pinMatches(input: string, stored: string | null | undefined): boolean {
  if (!stored) return false
  const a = Buffer.from(String(input))
  const b = Buffer.from(String(stored))
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/** Keep the last 10 digits so "(214) 555-0123" and "2145550123" match. */
export function normalizePhone(raw: string | null | undefined): string {
  const digits = String(raw ?? '').replace(/\D/g, '')
  return digits.length > 10 ? digits.slice(-10) : digits
}

/**
 * The UTC instant range covering "today" for the tenant's calendar day.
 * Sessions are generated at the day's midnight, so we bracket the local date.
 */
export function tenantDayRangeUtc(timezone?: string | null): { gte: string; lte: string; ymd: string } {
  const tz = timezone || 'America/Chicago'
  const now = new Date()
  let ymd: string
  try {
    // en-CA yields YYYY-MM-DD
    ymd = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
  } catch {
    ymd = now.toISOString().slice(0, 10)
  }
  return { gte: `${ymd}T00:00:00.000Z`, lte: `${ymd}T23:59:59.999Z`, ymd }
}
