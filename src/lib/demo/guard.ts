/**
 * Shared guard for the public demo tenant.
 *
 * The demo tenant (`demoMode: true`) is administered by a SHARED, PUBLIC admin
 * account. These guards stop that public admin from tampering with the seeded
 * TEST Stripe connected account, the donation config, or inviting users into
 * the demo tenant. They are intentionally narrow: they only fire when the
 * resolved tenant is the demo tenant, so real tenants are never affected.
 */

/** True when the given tenant doc is the public demo tenant. */
export function isDemoTenant(
  tenant: { demoMode?: boolean | null } | null | undefined,
): boolean {
  return !!tenant?.demoMode
}
