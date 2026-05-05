/**
 * Pure helpers for the free-tier signup path. Separated from the route
 * handler for testability — the route is a thin wrapper that loads the
 * tenant + tier from Payload, calls these helpers, and writes the Member.
 */

export interface FreeSignupInput {
  name: string
  email: string
  phone?: string | null
}

export interface FreeTierLike {
  id: string | number
  active: boolean
  amountCents: number
}

/**
 * Validate input + tier compatibility for a free signup.
 * Throws with a user-presentable message on validation failure.
 */
export function validateFreeSignup(
  input: FreeSignupInput,
  tier: FreeTierLike,
): { name: string; email: string; phone: string | null } {
  if (!tier.active) {
    throw new Error('Tier is not active')
  }
  if (tier.amountCents !== 0) {
    throw new Error('Tier is not free — use the Stripe Checkout flow instead')
  }
  const name = (input.name ?? '').trim()
  if (!name) {
    throw new Error('Name is required')
  }
  const email = (input.email ?? '').trim().toLowerCase()
  // Minimal RFC-ish check — we don't need server-side address parsing here;
  // bounce handling is the masjid's problem if it's wrong.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('A valid email address is required')
  }
  const phoneRaw = (input.phone ?? '').trim()
  const phone = phoneRaw.length > 0 ? phoneRaw : null
  return { name, email, phone }
}

/**
 * Build the data shape used for find-or-create on `members` for a free signup.
 * `joinedAt` is preserved when re-signing-up an existing member; the caller
 * passes the existing member's `joinedAt` (or null if first-time).
 */
export function buildFreeMemberData(
  tenantId: string | number,
  tierId: string | number,
  validated: { name: string; email: string; phone: string | null },
  existingJoinedAt: string | null,
): {
  tenant: string | number
  tier: string | number
  email: string
  name: string
  phone: string | null
  status: 'active'
  joinedAt: string
} {
  return {
    tenant: tenantId,
    tier: tierId,
    email: validated.email,
    name: validated.name,
    phone: validated.phone,
    status: 'active',
    joinedAt: existingJoinedAt ?? new Date().toISOString(),
  }
}
