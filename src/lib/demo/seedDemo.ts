import type { Payload } from 'payload'
import {
  DEMO_SLUG,
  demoTenantData,
  demoDonationConfig,
  demoMembershipTiers,
} from './demoContent'

/**
 * Shared seed/reset engine for the public demo tenant.
 *
 * Idempotent and re-runnable: used by the `seed:demo` script and the nightly
 * `/api/demo/reset` route. Mirrors `scripts/seed.ts` idioms (loosely-typed
 * payload, `overrideAccess`, a fake platformOwner req so validate hooks pass).
 *
 * Reset policy:
 *  - WIPE visitor-generated transactional data only (members, donations,
 *    form-submissions). Website content (services, hero-slides, events, forms,
 *    announcements) is imported once from ICP via `import:demo` and PERSISTS
 *    across resets — it is no longer wiped/recreated here.
 *  - UPSERT membership tiers by (tenant, name) — never delete. Creating a paid
 *    tier fires `syncTierAfterChange` which provisions a Stripe (test)
 *    Product/Price on the connected account; wiping + recreating nightly would
 *    spawn new test products and rotate price ids, so we keep them stable.
 *  - Donation funds are auto-seeded by a tenant afterChange hook; we never
 *    touch `donation-funds`.
 */

// Fake req.user so validate hooks that gate on platformOwner succeed during seed.
// IMPORTANT: this returns a FRESH object every call. A single shared req object
// is mutated by Payload (it stamps `transactionID` onto it after the first
// operation), so reusing one across creates makes later operations ride a
// stale/committed transaction — which silently breaks transactional afterChange
// writebacks (e.g. the tier→Stripe sync saving stripePriceId for tiers 2+).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const seedReq = (): any => ({ user: { id: 0, role: 'platformOwner', email: 'demo-seed@seed' } })

async function findTenant(payload: Payload): Promise<{ id: string | number } | undefined> {
  const res = await payload.find({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    collection: 'tenants' as any,
    where: { slug: { equals: DEMO_SLUG } },
    limit: 1,
    overrideAccess: true,
  })
  return res.docs[0] as { id: string | number } | undefined
}

async function deleteAllForTenant(
  payload: Payload,
  collection: string,
  tenantId: string | number,
): Promise<void> {
  await payload.delete({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    collection: collection as any,
    where: { tenant: { equals: tenantId } },
    overrideAccess: true,
    req: seedReq(),
  })
}

/** Create or update the demo tenant. Idempotent. Returns its id. */
export async function ensureDemoTenant(payload: Payload): Promise<string | number> {
  const data = { ...demoTenantData, donationConfig: demoDonationConfig() }
  const existing = await findTenant(payload)
  if (existing) {
    await payload.update({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      collection: 'tenants' as any,
      id: existing.id,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: data as any,
      overrideAccess: true,
      req: seedReq(),
    })
    return existing.id
  }
  const created = (await payload.create({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    collection: 'tenants' as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: data as any,
    overrideAccess: true,
    req: seedReq(),
  })) as { id: string | number }
  return created.id
}

/** Find an existing membership tier for this tenant by name. */
async function findTierByName(
  payload: Payload,
  tenantId: string | number,
  name: string,
): Promise<{ id: string | number } | undefined> {
  const res = await payload.find({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    collection: 'membership-tiers' as any,
    where: { and: [{ tenant: { equals: tenantId } }, { name: { equals: name } }] },
    limit: 1,
    overrideAccess: true,
  })
  return res.docs[0] as { id: string | number } | undefined
}

/** Wipe the demo tenant's mutable content and recreate the canonical set. */
export async function seedDemoContent(
  payload: Payload,
  tenantId: string | number,
): Promise<void> {
  // Wipe only visitor-generated transactional data (members/donations/
  // form-submissions). Website content (services/hero-slides/events/forms/
  // announcements) is now imported once from ICP via `import:demo` and must
  // PERSIST across resets, so it is no longer wiped/recreated here.
  // membership-tiers are deliberately NOT wiped — they are upserted below to
  // keep their Stripe test Product/Price ids stable. donation-funds are
  // auto-seeded by the tenant hook and never touched here.
  for (const c of ['members', 'donations', 'form-submissions']) {
    await deleteAllForTenant(payload, c, tenantId)
  }

  // Purge any users created in the demo tenant beyond the canonical shared
  // admin (defence-in-depth alongside the demo user-write guard) so a visitor
  // can't leave behind accounts that survive the nightly reset.
  const demoAdminEmail = process.env.DEMO_ADMIN_EMAIL || 'demo-admin@demo.openmasjid.app'
  await payload.delete({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    collection: 'users' as any,
    where: {
      and: [{ tenant: { equals: tenantId } }, { email: { not_equals: demoAdminEmail } }],
    },
    overrideAccess: true,
    req: seedReq(),
  })

  // Upsert tiers by (tenant, name). Creating/updating a paid tier triggers
  // syncTierAfterChange → Stripe (test) Product/Price.
  for (const t of demoMembershipTiers) {
    const existing = await findTierByName(payload, tenantId, t.name)
    if (existing) {
      await payload.update({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        collection: 'membership-tiers' as any,
        id: existing.id,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: { ...t } as any,
        overrideAccess: true,
        req: seedReq(),
      })
    } else {
      await payload.create({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        collection: 'membership-tiers' as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: { ...t, tenant: tenantId } as any,
        overrideAccess: true,
        req: seedReq(),
      })
    }
  }
}

/** Full reset: ensure the tenant exists, then rebuild its content. */
export async function resetDemoContent(
  payload: Payload,
): Promise<{ tenantId: string | number }> {
  const tenantId = await ensureDemoTenant(payload)
  await seedDemoContent(payload, tenantId)
  // Ensure the shared admin here too (not just in the seed script) so that the
  // `/api/demo/reset` endpoint and the nightly cron fully provision the demo —
  // the prod image has no `tsx`, so the TS seed script can't run there and the
  // endpoint is the only provisioning path.
  await ensureDemoAdmin(payload, tenantId)
  return { tenantId }
}

/**
 * Create or update the shared demo admin user scoped to the demo tenant.
 * Idempotent. Password comes from `DEMO_ADMIN_PASSWORD` (throws if unset) so it
 * is never committed. Email defaults to a stable demo address.
 */
export async function ensureDemoAdmin(
  payload: Payload,
  tenantId: string | number,
): Promise<void> {
  const email = process.env.DEMO_ADMIN_EMAIL || 'demo-admin@demo.openmasjid.app'
  const password = process.env.DEMO_ADMIN_PASSWORD
  if (!password) throw new Error('DEMO_ADMIN_PASSWORD is not set')

  const existing = await payload.find({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    collection: 'users' as any,
    where: { email: { equals: email } },
    limit: 1,
    overrideAccess: true,
  })

  // firstName + lastName are required on Users; supply demo-appropriate values.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {
    email,
    role: 'admin',
    tenant: tenantId,
    firstName: 'Demo',
    lastName: 'Admin',
    password,
  }

  const found = existing.docs[0] as { id: string | number } | undefined
  if (found) {
    await payload.update({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      collection: 'users' as any,
      id: found.id,
      data,
      overrideAccess: true,
      req: seedReq(),
    })
  } else {
    await payload.create({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      collection: 'users' as any,
      data,
      overrideAccess: true,
      req: seedReq(),
    })
  }
}
