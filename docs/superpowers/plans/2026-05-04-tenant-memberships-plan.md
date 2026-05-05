# Tenant Memberships Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the B-milestone of tenant memberships — paid recurring dues via Stripe Connect — with two new collections (`MembershipTiers`, `Members`), a public `/membership` signup flow, an admin overview, and webhook-driven lifecycle sync. Spec: `docs/superpowers/specs/2026-05-04-tenant-memberships-design.md`.

**Architecture:** Mirror the existing donations Connect plumbing. Tiers auto-sync to Stripe Products/Prices on save. `/membership` lists tiers and redirects to Stripe Checkout (subscription mode). The existing donations Connect webhook route fans out by `metadata.kind` — events with `kind === 'membership'` route to `membership-webhook.ts` which finds-or-updates a `Member` row by `(tenant, email)`. Members manage their subscription via Stripe Customer Portal; the platform never logs them in.

**Tech Stack:** Payload 3 (Postgres), Next.js 15 App Router, Stripe Node SDK (Connect via `stripe-connect.ts`), Vitest, TypeScript.

---

## Pre-flight (do this once before Task 1)

- [ ] **Confirm branch.** Run `git branch --show-current`. Expected: `feat/tenant-memberships`. If not, `git checkout feat/tenant-memberships`.
- [ ] **Confirm node_modules.** Run `ls node_modules/.bin/tsc`. If missing, `npm install`.
- [ ] **Confirm tests baseline.** Run `npm test --silent`. Expected: all tests pass before we add anything.

---

## File map (locked in before tasks)

**New collections:**
- `src/collections/MembershipTiers.ts` — tenant-scoped, hooks for Stripe sync
- `src/collections/Members.ts` — tenant-scoped, write-restricted (webhooks + admin notes only)

**New libs:**
- `src/lib/membership-stripe.ts` — `ensureStripeProductAndPrice(tier, payload)`, `archiveTierInStripe(tier, payload)` — pure-ish helpers that take a Stripe client + tier and apply the sync rules
- `src/lib/membership-webhook.ts` — `handleMembershipEvent(event, payload)` — dispatches Stripe events to find-or-update Member rows
- `src/lib/membership-status.ts` — `bucketFromStripeStatus(s: string): 'active' | 'grace' | 'inactive'`
- `src/lib/membership-aggregates.ts` — admin-overview stats (active/grace counts, MRR, per-tier breakdown)

**New routes:**
- `src/app/(site)/membership/page.tsx` — public tier list
- `src/app/(site)/membership/thanks/page.tsx` — post-checkout landing
- `src/app/api/membership/checkout/route.ts` — POST creates Stripe Checkout Session
- `src/app/api/membership/portal/route.ts` — POST creates Customer Portal Session
- `src/app/api/members/export.csv/route.ts` — admin CSV export
- `src/app/(payload)/admin/membership/overview/page.tsx` + `OverviewClient.tsx` — admin view

**Modified files:**
- `src/payload.config.ts` — register the two new collections
- `src/payload-types.ts` — regenerated
- `src/app/api/stripe/webhook/route.ts` (or wherever the donations Connect webhook is mounted) — dispatch by `metadata.kind`
- `src/app/(payload)/admin/importMap.js` — auto-regenerated when admin components added
- `src/migrations/index.ts` + new migration files — auto-generated

**New components:**
- `src/components/MembershipTierCard.tsx` — single tier card on /membership
- `src/admin/membership/BackToOverview.tsx` — sidebar nav (mirror of donations equivalent)
- `src/admin/membership/MembershipNavLinks.tsx` — admin nav entries (if needed)

**New tests:**
- `tests/collections/membershipTiers.access.test.ts`
- `tests/collections/members.access.test.ts`
- `tests/lib/membership-stripe.test.ts`
- `tests/lib/membership-webhook.test.ts`
- `tests/lib/membership-status.test.ts`
- `tests/lib/membership-checkout.test.ts`
- `tests/lib/membership-aggregates.test.ts`

---

## Task 1: `MembershipTiers` collection (schema + access + tests)

**Files:**
- Create: `src/collections/MembershipTiers.ts`
- Modify: `src/payload.config.ts` — register the collection
- Test: `tests/collections/membershipTiers.access.test.ts`

- [ ] **Step 1: Read the donations counterpart for pattern.** Read `src/collections/DonationFunds.ts` end-to-end. Note the `tenantScopedAccess()` helper, `setTenantFromUser` hook, `admin.group: 'Donations'`, label conventions, `useAsTitle`, `defaultColumns`. Note that hard-delete is denied via access control (return false).

- [ ] **Step 2: Write failing access tests.**

```ts
// tests/collections/membershipTiers.access.test.ts
import { describe, it, expect } from 'vitest'
import { MembershipTiers } from '@/collections/MembershipTiers'

function callAccess(op: 'read' | 'create' | 'update' | 'delete', user: any) {
  const access = MembershipTiers.access as Record<string, any>
  return access[op]({ req: { user } })
}

describe('MembershipTiers access', () => {
  it('platformOwner can do everything', () => {
    const u = { role: 'platformOwner' }
    expect(callAccess('read', u)).toBe(true)
    expect(callAccess('create', u)).toBe(true)
    expect(callAccess('update', u)).toBe(true)
  })

  it('admin can read/create/update within their tenant', () => {
    const admin = { role: 'admin', tenant: 1 }
    expect(callAccess('read', admin)).not.toBe(false)
    expect(callAccess('create', admin)).not.toBe(false)
    expect(callAccess('update', admin)).not.toBe(false)
  })

  it('staff can only read', () => {
    const staff = { role: 'staff', tenant: 1 }
    expect(callAccess('read', staff)).not.toBe(false)
    expect(callAccess('create', staff)).toBe(false)
    expect(callAccess('update', staff)).toBe(false)
  })

  it('hard delete is forbidden for everyone', () => {
    for (const u of [{ role: 'platformOwner' }, { role: 'admin', tenant: 1 }, { role: 'staff', tenant: 1 }, undefined]) {
      expect(callAccess('delete', u)).toBe(false)
    }
  })

  it('anonymous gets nothing', () => {
    expect(callAccess('read', undefined)).toBe(false)
    expect(callAccess('create', undefined)).toBe(false)
  })
})
```

- [ ] **Step 3: Run tests; confirm they fail.** `npx vitest run tests/collections/membershipTiers.access.test.ts` → fail (collection doesn't exist).

- [ ] **Step 4: Implement the collection.**

```ts
// src/collections/MembershipTiers.ts
import type { CollectionConfig } from 'payload'
import { tenantScopedAccess } from '../access/tenantScoped'
import { setTenantFromUser } from '../hooks/setTenantFromUser'

/**
 * MembershipTiers — paid recurring dues offered by a tenant. Each tier maps
 * 1:1 to a Stripe Product + Price on the tenant's connected account. Prices
 * are immutable in Stripe, so amount/cadence changes rotate to a new Price
 * and archive the old one (existing subscribers continue billing on the
 * archived Price). Hard delete is forbidden — use `active = false` instead.
 */
export const MembershipTiers: CollectionConfig = {
  slug: 'membership-tiers',
  labels: { singular: 'Membership tier', plural: 'Membership tiers' },
  admin: {
    group: 'Membership',
    useAsTitle: 'name',
    defaultColumns: ['name', 'amountCents', 'cadence', 'active', 'sortOrder'],
    description: 'Paid recurring tiers congregants can subscribe to.',
  },
  access: {
    ...tenantScopedAccess(),
    delete: () => false,
  },
  hooks: {
    beforeChange: [setTenantFromUser],
  },
  fields: [
    { name: 'tenant', type: 'relationship', relationTo: 'tenants', required: true, index: true, admin: { readOnly: true } },
    { name: 'name', type: 'text', required: true },
    { name: 'description', type: 'richText' },
    {
      name: 'amountCents',
      type: 'number',
      required: true,
      min: 1,
      admin: { description: 'Amount in cents. e.g. 2500 = $25.00' },
    },
    {
      name: 'cadence',
      type: 'select',
      required: true,
      defaultValue: 'monthly',
      options: [
        { label: 'Monthly', value: 'monthly' },
        { label: 'Yearly', value: 'yearly' },
      ],
    },
    { name: 'active', type: 'checkbox', defaultValue: true, admin: { description: 'Uncheck to soft-delete: hides from /membership but keeps existing subscribers billed.' } },
    { name: 'sortOrder', type: 'number', admin: { description: 'Lower numbers appear first on the public page.' } },

    // Stripe sync state — managed by hooks, read-only in admin
    { name: 'stripeProductId', type: 'text', admin: { readOnly: true, position: 'sidebar' } },
    { name: 'stripePriceId', type: 'text', admin: { readOnly: true, position: 'sidebar' } },
    { name: 'archivedPriceIds', type: 'array', admin: { readOnly: true, position: 'sidebar' }, fields: [{ name: 'priceId', type: 'text' }] },
    { name: 'lastStripeSyncAt', type: 'date', admin: { readOnly: true, position: 'sidebar' } },
    { name: 'lastStripeSyncError', type: 'textarea', admin: { readOnly: true, position: 'sidebar' } },
  ],
  timestamps: true,
}
```

- [ ] **Step 5: Register the collection** in `src/payload.config.ts`. Find the `collections: [...]` array, add `MembershipTiers` import + entry alongside `DonationFunds`.

- [ ] **Step 6: Run tests; confirm they pass.** `npx vitest run tests/collections/membershipTiers.access.test.ts`.

- [ ] **Step 7: Run typecheck.** `npx tsc --noEmit`. Must pass.

- [ ] **Step 8: Regenerate Payload types.**

```
npx payload generate:types
```

- [ ] **Step 9: Generate the migration.**

```
npx payload migrate:create membership_tiers_collection
```

Verify the generated `src/migrations/<ts>_membership_tiers_collection.ts` adds tables `membership_tiers` and `_membership_tiers_v` with all fields. Inspect with Read.

- [ ] **Step 10: Commit.**

```
git add src/collections/MembershipTiers.ts src/payload.config.ts src/payload-types.ts src/migrations tests/collections/membershipTiers.access.test.ts
git commit -m "feat(membership): MembershipTiers collection + migration"
```

---

## Task 2: Tier ↔ Stripe sync helpers (`membership-stripe.ts`)

**Files:**
- Create: `src/lib/membership-stripe.ts`
- Test: `tests/lib/membership-stripe.test.ts`

This is a pure-ish helper module: takes a Stripe client and a tier, applies the create/update/archive rules. Hooks (Task 3) call it.

- [ ] **Step 1: Read existing `src/lib/stripe-connect.ts`** to learn how the project gets a Stripe client for a tenant's Connect account (`stripe.products.create({}, { stripeAccount: tenantAccountId })` style). Note the helper that resolves the tenant's `stripeAccountId`.

- [ ] **Step 2: Write failing tests.**

```ts
// tests/lib/membership-stripe.test.ts
import { describe, it, expect, vi } from 'vitest'
import { ensureStripeProductAndPrice, archiveTierInStripe } from '@/lib/membership-stripe'

function makeStripeMock() {
  const createdProducts: any[] = []
  const updatedProducts: any[] = []
  const createdPrices: any[] = []
  const updatedPrices: any[] = []
  const stripe = {
    products: {
      create: vi.fn(async (args, _opts) => { const p = { id: `prod_${createdProducts.length + 1}`, ...args }; createdProducts.push(p); return p }),
      update: vi.fn(async (id, args) => { updatedProducts.push({ id, ...args }); return { id, ...args } }),
    },
    prices: {
      create: vi.fn(async (args, _opts) => { const p = { id: `price_${createdPrices.length + 1}`, ...args }; createdPrices.push(p); return p }),
      update: vi.fn(async (id, args) => { updatedPrices.push({ id, ...args }); return { id, ...args } }),
    },
  } as any
  return { stripe, createdProducts, updatedProducts, createdPrices, updatedPrices }
}

const baseTier = {
  id: 1,
  name: 'Supporting',
  amountCents: 2500,
  cadence: 'monthly' as const,
  stripeProductId: null,
  stripePriceId: null,
  archivedPriceIds: [] as { priceId: string }[],
  tenant: { id: 7, stripeAccountId: 'acct_test' },
}

describe('ensureStripeProductAndPrice', () => {
  it('creates product+price on first call', async () => {
    const { stripe } = makeStripeMock()
    const out = await ensureStripeProductAndPrice(baseTier, stripe, 'acct_test')
    expect(out.stripeProductId).toMatch(/^prod_/)
    expect(out.stripePriceId).toMatch(/^price_/)
    expect(stripe.products.create).toHaveBeenCalledOnce()
    expect(stripe.prices.create).toHaveBeenCalledOnce()
    expect(stripe.prices.create.mock.calls[0][0]).toMatchObject({
      unit_amount: 2500,
      currency: 'usd',
      recurring: { interval: 'month' },
    })
  })

  it('rotates price when amountCents changes', async () => {
    const { stripe, createdPrices, updatedPrices } = makeStripeMock()
    const tier = { ...baseTier, stripeProductId: 'prod_existing', stripePriceId: 'price_old', amountCents: 5000 }
    const out = await ensureStripeProductAndPrice(tier, stripe, 'acct_test')
    expect(stripe.products.create).not.toHaveBeenCalled()
    expect(out.stripePriceId).not.toBe('price_old')
    expect(updatedPrices.find((p) => p.id === 'price_old')).toMatchObject({ active: false })
    expect(out.archivedPriceIds.map((a: any) => a.priceId)).toContain('price_old')
  })

  it('updates product name in place when name changes; no price rotation', async () => {
    const { stripe } = makeStripeMock()
    const tier = { ...baseTier, stripeProductId: 'prod_existing', stripePriceId: 'price_existing', name: 'Renamed' }
    await ensureStripeProductAndPrice(tier, stripe, 'acct_test')
    expect(stripe.products.update).toHaveBeenCalledWith('prod_existing', expect.objectContaining({ name: 'Renamed' }), expect.objectContaining({ stripeAccount: 'acct_test' }))
    expect(stripe.prices.create).not.toHaveBeenCalled()
  })

  it('rotates price when cadence changes from monthly to yearly', async () => {
    const { stripe } = makeStripeMock()
    const tier = { ...baseTier, stripeProductId: 'prod_x', stripePriceId: 'price_old', cadence: 'yearly' as const }
    const out = await ensureStripeProductAndPrice(tier, stripe, 'acct_test')
    expect(stripe.prices.create.mock.calls[0][0]).toMatchObject({ recurring: { interval: 'year' } })
    expect(out.stripePriceId).not.toBe('price_old')
  })
})

describe('archiveTierInStripe', () => {
  it('archives the current price and the product', async () => {
    const { stripe } = makeStripeMock()
    const tier = { ...baseTier, stripeProductId: 'prod_x', stripePriceId: 'price_x' }
    await archiveTierInStripe(tier, stripe, 'acct_test')
    expect(stripe.prices.update).toHaveBeenCalledWith('price_x', expect.objectContaining({ active: false }), expect.any(Object))
    expect(stripe.products.update).toHaveBeenCalledWith('prod_x', expect.objectContaining({ active: false }), expect.any(Object))
  })

  it('is a no-op when tier was never synced', async () => {
    const { stripe } = makeStripeMock()
    await archiveTierInStripe(baseTier, stripe, 'acct_test')
    expect(stripe.prices.update).not.toHaveBeenCalled()
    expect(stripe.products.update).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 3: Run tests; confirm they fail.** `npx vitest run tests/lib/membership-stripe.test.ts`.

- [ ] **Step 4: Update the rotation test in step 2** before implementing. The contract is: this helper **never archives Prices** — it only creates Product (if missing), updates Product name, and creates a Price when `stripePriceId` is null. The hook (Task 3) is responsible for archiving the old Price + clearing `stripePriceId` *before* calling this helper. Replace the "rotates price when amountCents changes" test with:

```ts
  it('creates a new Price when stripePriceId is cleared (hook signals rotation by passing null)', async () => {
    const { stripe } = makeStripeMock()
    const tier = { ...baseTier, stripeProductId: 'prod_existing', stripePriceId: null, amountCents: 5000 }
    const out = await ensureStripeProductAndPrice(tier, stripe, 'acct_test')
    expect(stripe.products.create).not.toHaveBeenCalled()
    expect(stripe.prices.create).toHaveBeenCalledOnce()
    expect(stripe.prices.create.mock.calls[0][0]).toMatchObject({ unit_amount: 5000 })
    expect(out.stripePriceId).toMatch(/^price_/)
    // helper does NOT archive — that's the hook's job
    expect(stripe.prices.update).not.toHaveBeenCalled()
  })

  it('does not call prices.create when stripePriceId already set (idempotent no-op)', async () => {
    const { stripe } = makeStripeMock()
    const tier = { ...baseTier, stripeProductId: 'prod_existing', stripePriceId: 'price_existing' }
    await ensureStripeProductAndPrice(tier, stripe, 'acct_test')
    expect(stripe.prices.create).not.toHaveBeenCalled()
  })
```

Also remove the `cadence` rotation test from step 2 — same logic (the hook clears `stripePriceId`; the helper just creates). Replace with a simpler interval test:

```ts
  it('uses correct recurring.interval for yearly cadence', async () => {
    const { stripe } = makeStripeMock()
    const tier = { ...baseTier, cadence: 'yearly' as const, stripePriceId: null }
    await ensureStripeProductAndPrice(tier, stripe, 'acct_test')
    expect(stripe.prices.create.mock.calls[0][0]).toMatchObject({ recurring: { interval: 'year' } })
  })
```

- [ ] **Step 5: Implement helper (no archiving inside).**

```ts
// src/lib/membership-stripe.ts
import type Stripe from 'stripe'

export interface TierLike {
  id: string | number
  name: string
  amountCents: number
  cadence: 'monthly' | 'yearly'
  stripeProductId?: string | null
  stripePriceId?: string | null
  archivedPriceIds?: { priceId: string }[] | null
  tenant: { id: string | number; stripeAccountId?: string | null }
}

export interface SyncResult {
  stripeProductId: string
  stripePriceId: string
  archivedPriceIds: { priceId: string }[]
}

/**
 * Pure-ish: caller owns the rotation decision.
 *
 *   - Creates Product if `stripeProductId` is null.
 *   - Updates Product name (and re-activates) if `stripeProductId` is set.
 *   - Creates a Price if `stripePriceId` is null, using current
 *     `amountCents` + `cadence`.
 *   - **Never archives** Prices. The hook (`syncTierAfterChange`) detects
 *     amount/cadence changes, archives the old Price, pushes its id into
 *     `archivedPriceIds`, then clears `stripePriceId` to null and calls
 *     this helper to create the replacement.
 *
 * Idempotent under repeat calls with the same input.
 */
export async function ensureStripeProductAndPrice(
  tier: TierLike,
  stripe: Stripe,
  stripeAccount: string,
): Promise<SyncResult> {
  const archived = (tier.archivedPriceIds ?? []).slice()
  const interval = tier.cadence === 'yearly' ? 'year' : 'month'

  let productId = tier.stripeProductId ?? null
  if (!productId) {
    const product = await stripe.products.create(
      {
        name: tier.name,
        metadata: { kind: 'membership', tierId: String(tier.id), tenantId: String(tier.tenant.id) },
      },
      { stripeAccount },
    )
    productId = product.id
  } else {
    await stripe.products.update(
      productId,
      { name: tier.name, active: true },
      { stripeAccount },
    )
  }

  let priceId = tier.stripePriceId ?? null
  if (!priceId) {
    const price = await stripe.prices.create(
      {
        product: productId,
        unit_amount: tier.amountCents,
        currency: 'usd',
        recurring: { interval },
        metadata: { kind: 'membership', tierId: String(tier.id), tenantId: String(tier.tenant.id) },
      },
      { stripeAccount },
    )
    priceId = price.id
  }

  return { stripeProductId: productId, stripePriceId: priceId, archivedPriceIds: archived }
}

/**
 * Soft-delete: archive the current Price and the Product. Existing
 * subscribers keep billing; new checkouts cannot start. Idempotent.
 */
export async function archiveTierInStripe(
  tier: TierLike,
  stripe: Stripe,
  stripeAccount: string,
): Promise<void> {
  if (tier.stripePriceId) {
    await stripe.prices.update(tier.stripePriceId, { active: false }, { stripeAccount })
  }
  if (tier.stripeProductId) {
    await stripe.products.update(tier.stripeProductId, { active: false }, { stripeAccount })
  }
}
```

- [ ] **Step 6: Tests pass.** `npx vitest run tests/lib/membership-stripe.test.ts`.

- [ ] **Step 7: Typecheck.** `npx tsc --noEmit`.

- [ ] **Step 8: Commit.**

```
git add src/lib/membership-stripe.ts tests/lib/membership-stripe.test.ts
git commit -m "feat(membership): Stripe Product/Price sync helpers"
```

---

## Task 3: Tier hooks (auto-sync on save)

**Files:**
- Modify: `src/collections/MembershipTiers.ts` — add `afterChange` hook
- Test: extend `tests/collections/membershipTiers.access.test.ts` with a separate `tests/collections/membershipTiers.hooks.test.ts`

- [ ] **Step 1: Write a failing hook test.**

```ts
// tests/collections/membershipTiers.hooks.test.ts
import { describe, it, expect, vi } from 'vitest'
import { syncTierAfterChange } from '@/collections/MembershipTiers.hooks'

const stripeMock = {
  products: { create: vi.fn(async () => ({ id: 'prod_new' })), update: vi.fn(async () => ({})) },
  prices: { create: vi.fn(async () => ({ id: 'price_new' })), update: vi.fn(async () => ({})) },
}

vi.mock('@/lib/stripe-connect', () => ({
  stripeForAccount: () => stripeMock,
}))

const tenantWithConnect = { id: 7, stripeAccountId: 'acct_x', stripeChargesEnabled: true }

function makeReq() {
  const updates: any[] = []
  return {
    payload: {
      findByID: vi.fn(async ({ id }) => (id === 7 ? tenantWithConnect : null)),
      update: vi.fn(async (args) => { updates.push(args); return args.data }),
    },
    _updates: updates,
  } as any
}

describe('syncTierAfterChange', () => {
  it('on create, sets stripeProductId and stripePriceId', async () => {
    stripeMock.products.create.mockClear(); stripeMock.prices.create.mockClear()
    const req = makeReq()
    const doc = { id: 1, tenant: 7, name: 'Supporting', amountCents: 2500, cadence: 'monthly', active: true, stripeProductId: null, stripePriceId: null, archivedPriceIds: [] }
    await syncTierAfterChange({ doc, previousDoc: null, operation: 'create', req })
    expect(req._updates[0].data.stripeProductId).toBe('prod_new')
    expect(req._updates[0].data.stripePriceId).toBe('price_new')
  })

  it('on amountCents change, archives old price and creates new', async () => {
    stripeMock.products.create.mockClear(); stripeMock.prices.create.mockClear(); stripeMock.prices.update.mockClear()
    const req = makeReq()
    const doc = { id: 1, tenant: 7, name: 'S', amountCents: 5000, cadence: 'monthly', active: true, stripeProductId: 'prod_x', stripePriceId: 'price_old', archivedPriceIds: [] }
    const previousDoc = { ...doc, amountCents: 2500 }
    await syncTierAfterChange({ doc, previousDoc, operation: 'update', req })
    expect(stripeMock.prices.update).toHaveBeenCalledWith('price_old', expect.objectContaining({ active: false }), expect.any(Object))
    expect(stripeMock.prices.create).toHaveBeenCalled()
    expect(req._updates[0].data.archivedPriceIds[0].priceId).toBe('price_old')
  })

  it('on active→false, archives in Stripe but leaves IDs on the row', async () => {
    stripeMock.prices.update.mockClear(); stripeMock.products.update.mockClear()
    const req = makeReq()
    const doc = { id: 1, tenant: 7, name: 'S', amountCents: 2500, cadence: 'monthly', active: false, stripeProductId: 'prod_x', stripePriceId: 'price_x', archivedPriceIds: [] }
    const previousDoc = { ...doc, active: true }
    await syncTierAfterChange({ doc, previousDoc, operation: 'update', req })
    expect(stripeMock.prices.update).toHaveBeenCalledWith('price_x', expect.objectContaining({ active: false }), expect.any(Object))
    expect(stripeMock.products.update).toHaveBeenCalledWith('prod_x', expect.objectContaining({ active: false }), expect.any(Object))
  })

  it('on tenant without Stripe Connect, stores error on row but does not throw', async () => {
    const req = {
      payload: {
        findByID: vi.fn(async () => ({ id: 7, stripeAccountId: null, stripeChargesEnabled: false })),
        update: vi.fn(),
      },
    } as any
    const doc = { id: 1, tenant: 7, name: 'S', amountCents: 2500, cadence: 'monthly', active: true, stripeProductId: null, stripePriceId: null, archivedPriceIds: [] }
    await syncTierAfterChange({ doc, previousDoc: null, operation: 'create', req })
    expect(req.payload.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        lastStripeSyncError: expect.stringContaining('Stripe Connect not enabled'),
      }),
    }))
  })
})
```

- [ ] **Step 2: Run tests; fail.** `npx vitest run tests/collections/membershipTiers.hooks.test.ts`.

- [ ] **Step 3: Implement the hook in a sibling file.**

```ts
// src/collections/MembershipTiers.hooks.ts
import type { CollectionAfterChangeHook } from 'payload'
import { stripeForAccount } from '@/lib/stripe-connect'
import { ensureStripeProductAndPrice, archiveTierInStripe } from '@/lib/membership-stripe'

interface TierDoc {
  id: number | string
  tenant: number | string | { id: number | string }
  name: string
  amountCents: number
  cadence: 'monthly' | 'yearly'
  active: boolean
  stripeProductId: string | null
  stripePriceId: string | null
  archivedPriceIds: { priceId: string }[] | null
}

export const syncTierAfterChange: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  operation,
  req,
}) => {
  const tier = doc as TierDoc
  const prev = previousDoc as TierDoc | null
  const tenantId = typeof tier.tenant === 'object' ? tier.tenant.id : tier.tenant

  let updates: Record<string, unknown> = {}
  try {
    const tenant = await req.payload.findByID({ collection: 'tenants', id: tenantId })
    if (!tenant?.stripeAccountId || tenant.stripeChargesEnabled !== true) {
      throw new Error('Stripe Connect not enabled for this tenant. Cannot sync tier to Stripe.')
    }
    const stripe = stripeForAccount(tenant.stripeAccountId)

    // Soft-delete path
    if (operation === 'update' && prev?.active === true && tier.active === false) {
      await archiveTierInStripe(
        { ...tier, tenant: { id: tenantId, stripeAccountId: tenant.stripeAccountId } },
        stripe,
        tenant.stripeAccountId,
      )
      updates = { lastStripeSyncAt: new Date().toISOString(), lastStripeSyncError: null }
    } else {
      // Detect amount or cadence change → rotate
      const amountChanged = prev != null && prev.amountCents !== tier.amountCents
      const cadenceChanged = prev != null && prev.cadence !== tier.cadence
      const archived = (tier.archivedPriceIds ?? []).slice()
      let priceIdForHelper = tier.stripePriceId

      if ((amountChanged || cadenceChanged) && tier.stripePriceId) {
        await stripe.prices.update(
          tier.stripePriceId,
          { active: false },
          { stripeAccount: tenant.stripeAccountId },
        )
        archived.push({ priceId: tier.stripePriceId })
        priceIdForHelper = null
      }

      const result = await ensureStripeProductAndPrice(
        {
          ...tier,
          stripePriceId: priceIdForHelper,
          archivedPriceIds: archived,
          tenant: { id: tenantId, stripeAccountId: tenant.stripeAccountId },
        },
        stripe,
        tenant.stripeAccountId,
      )
      updates = {
        stripeProductId: result.stripeProductId,
        stripePriceId: result.stripePriceId,
        archivedPriceIds: archived,
        lastStripeSyncAt: new Date().toISOString(),
        lastStripeSyncError: null,
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown Stripe sync error'
    updates = { lastStripeSyncError: msg, lastStripeSyncAt: new Date().toISOString() }
  }

  // Persist sync state without re-firing the hook (use a guard via context)
  await req.payload.update({
    collection: 'membership-tiers',
    id: tier.id,
    data: updates,
    overrideAccess: true,
    context: { skipMembershipSync: true },
  })
}
```

- [ ] **Step 4: Wire the hook into the collection** by editing `MembershipTiers.ts`:

```ts
// add at top:
import { syncTierAfterChange } from './MembershipTiers.hooks'

// replace hooks section:
hooks: {
  beforeChange: [setTenantFromUser],
  afterChange: [
    async (args) => {
      if (args.req.context?.skipMembershipSync) return
      await syncTierAfterChange(args)
    },
  ],
},
```

- [ ] **Step 5: Run tests.** `npx vitest run tests/collections/membershipTiers.hooks.test.ts`. Pass.

- [ ] **Step 6: Typecheck.** `npx tsc --noEmit`.

- [ ] **Step 7: Commit.**

```
git add src/collections/MembershipTiers.ts src/collections/MembershipTiers.hooks.ts tests/collections/membershipTiers.hooks.test.ts
git commit -m "feat(membership): tier afterChange hook auto-syncs to Stripe Connect"
```

---

## Task 4: Status bucket helper

**Files:**
- Create: `src/lib/membership-status.ts`
- Test: `tests/lib/membership-status.test.ts`

- [ ] **Step 1: Failing test.**

```ts
// tests/lib/membership-status.test.ts
import { describe, it, expect } from 'vitest'
import { bucketFromStripeStatus } from '@/lib/membership-status'

describe('bucketFromStripeStatus', () => {
  it.each([
    ['active', 'active'],
    ['trialing', 'active'],
    ['past_due', 'grace'],
    ['unpaid', 'grace'],
    ['canceled', 'inactive'],
    ['incomplete', 'inactive'],
    ['incomplete_expired', 'inactive'],
    ['paused', 'inactive'],
    ['unknown_status', 'inactive'],
  ])('%s → %s', (s, expected) => {
    expect(bucketFromStripeStatus(s)).toBe(expected)
  })
})
```

- [ ] **Step 2: Implement.**

```ts
// src/lib/membership-status.ts
export type MemberBucket = 'active' | 'grace' | 'inactive'

export function bucketFromStripeStatus(stripeStatus: string | null | undefined): MemberBucket {
  switch (stripeStatus) {
    case 'active':
    case 'trialing':
      return 'active'
    case 'past_due':
    case 'unpaid':
      return 'grace'
    default:
      return 'inactive'
  }
}
```

- [ ] **Step 3: Tests pass.** `npx vitest run tests/lib/membership-status.test.ts`.

- [ ] **Step 4: Commit.**

```
git add src/lib/membership-status.ts tests/lib/membership-status.test.ts
git commit -m "feat(membership): Stripe status → bucket helper"
```

---

## Task 5: `Members` collection (schema + access + tests + migration)

**Files:**
- Create: `src/collections/Members.ts`
- Modify: `src/payload.config.ts`
- Test: `tests/collections/members.access.test.ts`

- [ ] **Step 1: Failing access test.**

```ts
// tests/collections/members.access.test.ts
import { describe, it, expect } from 'vitest'
import { Members } from '@/collections/Members'

function call(op: 'read' | 'create' | 'update' | 'delete', user: any) {
  const fn = (Members.access as any)[op]
  return fn({ req: { user } })
}

describe('Members access', () => {
  it('platformOwner reads all', () => {
    expect(call('read', { role: 'platformOwner' })).toBe(true)
  })
  it('admin reads/updates own tenant only', () => {
    expect(call('read', { role: 'admin', tenant: 1 })).not.toBe(false)
    expect(call('update', { role: 'admin', tenant: 1 })).not.toBe(false)
  })
  it('staff cannot read members', () => {
    expect(call('read', { role: 'staff', tenant: 1 })).toBe(false)
  })
  it('create is forbidden in admin (webhooks use overrideAccess)', () => {
    for (const u of [{ role: 'platformOwner' }, { role: 'admin', tenant: 1 }, { role: 'staff', tenant: 1 }, undefined]) {
      expect(call('create', u)).toBe(false)
    }
  })
  it('delete forbidden for everyone', () => {
    for (const u of [{ role: 'platformOwner' }, { role: 'admin', tenant: 1 }, undefined]) {
      expect(call('delete', u)).toBe(false)
    }
  })
})
```

- [ ] **Step 2: Implement.**

```ts
// src/collections/Members.ts
import type { CollectionConfig } from 'payload'
import { tenantScopedAccess } from '../access/tenantScoped'

/**
 * Members — congregants who have or have had a paid membership subscription
 * via Stripe Connect. Created and updated by the membership webhook (using
 * overrideAccess); admins can update notes/phone but not name/email/tier
 * (those reflect Stripe state). Hard delete forbidden — preserve audit.
 */
export const Members: CollectionConfig = {
  slug: 'members',
  labels: { singular: 'Member', plural: 'Members' },
  admin: {
    group: 'Membership',
    useAsTitle: 'name',
    defaultColumns: ['name', 'email', 'tier', 'status', 'currentPeriodEnd'],
    description: 'Congregants subscribed to a membership tier.',
  },
  access: {
    read: ({ req: { user } }) => {
      if (!user) return false
      if (user.role === 'platformOwner') return true
      if (user.role === 'admin') return { tenant: { equals: (user as any).tenant } }
      return false // staff blocked
    },
    create: () => false,
    update: ({ req: { user } }) => {
      if (!user) return false
      if (user.role === 'platformOwner') return true
      if (user.role === 'admin') return { tenant: { equals: (user as any).tenant } }
      return false
    },
    delete: () => false,
  },
  fields: [
    { name: 'tenant', type: 'relationship', relationTo: 'tenants', required: true, index: true, admin: { readOnly: true } },
    { name: 'email', type: 'email', required: true, index: true, admin: { readOnly: true } },
    { name: 'name', type: 'text', required: true, admin: { readOnly: true } },
    { name: 'phone', type: 'text' },
    { name: 'tier', type: 'relationship', relationTo: 'membership-tiers', required: true, admin: { readOnly: true } },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'inactive',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'In grace', value: 'grace' },
        { label: 'Inactive', value: 'inactive' },
      ],
      admin: { readOnly: true },
    },
    { name: 'stripeCustomerId', type: 'text', admin: { readOnly: true, position: 'sidebar' } },
    { name: 'stripeSubscriptionId', type: 'text', admin: { readOnly: true, position: 'sidebar' } },
    { name: 'stripeSubscriptionStatus', type: 'text', admin: { readOnly: true, position: 'sidebar' } },
    { name: 'joinedAt', type: 'date', admin: { readOnly: true } },
    { name: 'currentPeriodEnd', type: 'date', admin: { readOnly: true } },
    { name: 'canceledAt', type: 'date', admin: { readOnly: true } },
    { name: 'notes', type: 'textarea', admin: { description: 'Admin-only notes; not visible to the member.' } },
  ],
  indexes: [{ fields: ['tenant', 'email'], unique: true }, { fields: ['tenant', 'status'] }],
  timestamps: true,
}
```

- [ ] **Step 3: Register in `payload.config.ts`.**

- [ ] **Step 4: Tests pass.** `npx vitest run tests/collections/members.access.test.ts`.

- [ ] **Step 5: Typecheck + regen types + migration.**

```
npx tsc --noEmit
npx payload generate:types
npx payload migrate:create members_collection
```

Verify the migration adds `members` + `_members_v` tables, `members.email` index, `members(tenant, email)` unique, FK `members.tier_id → membership_tiers.id`.

- [ ] **Step 6: Commit.**

```
git add src/collections/Members.ts src/payload.config.ts src/payload-types.ts src/migrations tests/collections/members.access.test.ts
git commit -m "feat(membership): Members collection + migration"
```

---

## Task 6: Webhook handler

**Files:**
- Create: `src/lib/membership-webhook.ts`
- Test: `tests/lib/membership-webhook.test.ts`

- [ ] **Step 1: Failing tests** covering each Stripe event we handle.

```ts
// tests/lib/membership-webhook.test.ts
import { describe, it, expect, vi } from 'vitest'
import { handleMembershipEvent } from '@/lib/membership-webhook'

function makePayload() {
  const findStub = vi.fn(async ({ collection, where }: any) => {
    // dispatch by collection + where
    if (collection === 'tenants') return { docs: [{ id: 7, stripeAccountId: where.stripeAccountId.equals }] }
    if (collection === 'membership-tiers') return { docs: [{ id: 11, tenant: 7, stripePriceId: where?.stripePriceId?.equals ?? 'price_x' }] }
    if (collection === 'members') return { docs: [] }
    return { docs: [] }
  })
  const create = vi.fn(async (a) => ({ id: 99, ...a.data }))
  const update = vi.fn(async (a) => a.data)
  return { find: findStub, create, update } as any
}

const baseSession = {
  id: 'cs_1',
  customer: 'cus_1',
  customer_email: 'a@b.com',
  customer_details: { name: 'Test User', phone: '555' },
  subscription: 'sub_1',
  metadata: { kind: 'membership', tenantId: '7', tierId: '11' },
}

describe('handleMembershipEvent', () => {
  it('checkout.session.completed creates a Member row', async () => {
    const payload = makePayload()
    payload.find = vi.fn(async ({ collection }: any) => {
      if (collection === 'tenants') return { docs: [{ id: 7, stripeAccountId: 'acct_x' }] }
      if (collection === 'membership-tiers') return { docs: [{ id: 11 }] }
      if (collection === 'members') return { docs: [] }
      return { docs: [] }
    })
    const subFetch = vi.fn(async () => ({ id: 'sub_1', status: 'active', current_period_end: 1735689600 }))
    await handleMembershipEvent({
      event: { type: 'checkout.session.completed', data: { object: baseSession }, account: 'acct_x' } as any,
      payload,
      stripeSubscriptionRetrieve: subFetch,
    })
    expect(payload.create).toHaveBeenCalledWith(expect.objectContaining({
      collection: 'members',
      data: expect.objectContaining({
        email: 'a@b.com',
        name: 'Test User',
        tenant: 7,
        tier: 11,
        status: 'active',
        stripeCustomerId: 'cus_1',
        stripeSubscriptionId: 'sub_1',
      }),
      overrideAccess: true,
    }))
  })

  it('customer.subscription.updated flips bucket to grace on past_due', async () => {
    const payload = makePayload()
    payload.find = vi.fn(async ({ collection }: any) => {
      if (collection === 'members') return { docs: [{ id: 99, stripeSubscriptionId: 'sub_1' }] }
      return { docs: [] }
    })
    await handleMembershipEvent({
      event: {
        type: 'customer.subscription.updated',
        data: { object: { id: 'sub_1', status: 'past_due', current_period_end: 1735689600 } },
        account: 'acct_x',
      } as any,
      payload,
    })
    expect(payload.update).toHaveBeenCalledWith(expect.objectContaining({
      collection: 'members',
      id: 99,
      data: expect.objectContaining({ status: 'grace', stripeSubscriptionStatus: 'past_due' }),
    }))
  })

  it('customer.subscription.deleted sets inactive + canceledAt', async () => {
    const payload = makePayload()
    payload.find = vi.fn(async () => ({ docs: [{ id: 99, stripeSubscriptionId: 'sub_1' }] }))
    await handleMembershipEvent({
      event: {
        type: 'customer.subscription.deleted',
        data: { object: { id: 'sub_1', status: 'canceled' } },
        account: 'acct_x',
      } as any,
      payload,
    })
    expect(payload.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'inactive', canceledAt: expect.any(String) }),
    }))
  })

  it('ignores non-membership events (no metadata.kind)', async () => {
    const payload = makePayload()
    await handleMembershipEvent({
      event: { type: 'checkout.session.completed', data: { object: { ...baseSession, metadata: {} } }, account: 'acct_x' } as any,
      payload,
      stripeSubscriptionRetrieve: vi.fn(),
    })
    expect(payload.create).not.toHaveBeenCalled()
    expect(payload.update).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Implement.**

```ts
// src/lib/membership-webhook.ts
import type Stripe from 'stripe'
import { bucketFromStripeStatus } from './membership-status'

interface PayloadLike {
  find: (args: any) => Promise<{ docs: any[] }>
  create: (args: any) => Promise<any>
  update: (args: any) => Promise<any>
}

export interface HandleMembershipEventArgs {
  event: Stripe.Event & { account?: string }
  payload: PayloadLike
  stripeSubscriptionRetrieve?: (id: string, account: string) => Promise<Stripe.Subscription>
}

export async function handleMembershipEvent({
  event,
  payload,
  stripeSubscriptionRetrieve,
}: HandleMembershipEventArgs): Promise<void> {
  const account = event.account
  if (!account) return

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const md = session.metadata ?? {}
      if (md.kind !== 'membership') return
      const tenantId = Number(md.tenantId)
      const tierId = Number(md.tierId)
      if (!tenantId || !tierId) return

      const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id
      if (!subId) return
      const sub = stripeSubscriptionRetrieve ? await stripeSubscriptionRetrieve(subId, account) : ({ status: 'active', current_period_end: Math.floor(Date.now() / 1000) } as any)

      const email = session.customer_email ?? session.customer_details?.email ?? ''
      const name = session.customer_details?.name ?? email
      const phone = session.customer_details?.phone ?? null

      const existing = await payload.find({
        collection: 'members',
        where: { tenant: { equals: tenantId }, email: { equals: email } },
        limit: 1,
        overrideAccess: true,
      })

      const data = {
        tenant: tenantId,
        email,
        name,
        phone,
        tier: tierId,
        status: bucketFromStripeStatus(sub.status),
        stripeCustomerId: typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null,
        stripeSubscriptionId: subId,
        stripeSubscriptionStatus: sub.status,
        currentPeriodEnd: new Date(sub.current_period_end * 1000).toISOString(),
        joinedAt: existing.docs[0]?.joinedAt ?? new Date().toISOString(),
      }

      if (existing.docs[0]) {
        await payload.update({ collection: 'members', id: existing.docs[0].id, data, overrideAccess: true })
      } else {
        await payload.create({ collection: 'members', data, overrideAccess: true })
      }
      return
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription
      const found = await payload.find({
        collection: 'members',
        where: { stripeSubscriptionId: { equals: sub.id } },
        limit: 1,
        overrideAccess: true,
      })
      const member = found.docs[0]
      if (!member) return

      // Tier change (Customer Portal upgrade/downgrade): match new Price ID to a tier
      let newTierId: number | undefined
      const priceId = sub.items?.data?.[0]?.price?.id
      if (priceId) {
        const tiers = await payload.find({
          collection: 'membership-tiers',
          where: { or: [{ stripePriceId: { equals: priceId } }, { 'archivedPriceIds.priceId': { equals: priceId } }] },
          limit: 1,
          overrideAccess: true,
        })
        if (tiers.docs[0]) newTierId = tiers.docs[0].id
      }

      await payload.update({
        collection: 'members',
        id: member.id,
        data: {
          status: bucketFromStripeStatus(sub.status),
          stripeSubscriptionStatus: sub.status,
          currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : undefined,
          ...(newTierId ? { tier: newTierId } : {}),
        },
        overrideAccess: true,
      })
      return
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      const found = await payload.find({
        collection: 'members',
        where: { stripeSubscriptionId: { equals: sub.id } },
        limit: 1,
        overrideAccess: true,
      })
      const member = found.docs[0]
      if (!member) return
      await payload.update({
        collection: 'members',
        id: member.id,
        data: {
          status: 'inactive',
          stripeSubscriptionStatus: 'canceled',
          canceledAt: new Date().toISOString(),
        },
        overrideAccess: true,
      })
      return
    }

    default:
      return
  }
}
```

- [ ] **Step 3: Tests pass.** `npx vitest run tests/lib/membership-webhook.test.ts`.

- [ ] **Step 4: Commit.**

```
git add src/lib/membership-webhook.ts tests/lib/membership-webhook.test.ts
git commit -m "feat(membership): webhook handler for subscription lifecycle"
```

---

## Task 7: Wire membership webhook into existing Connect webhook route

**Files:**
- Modify: the donations Connect webhook route. Find it: `grep -rl 'donations-webhook\|stripe.*webhook' src/app/api/`. Likely `src/app/api/stripe/webhook/route.ts` or `src/app/api/donations/webhook/route.ts`. Read the file first to understand its dispatch pattern.

- [ ] **Step 1: Read the existing webhook entry route.** Note: how it constructs the Stripe event, where it calls the donations handler.

- [ ] **Step 2: Add membership dispatch.** After (or in parallel with) the donations handler call, route to `handleMembershipEvent` for events that have `metadata.kind === 'membership'` on either the session or the subscription. For `customer.subscription.*` events, the metadata lives on the subscription itself; the dispatcher inside `handleMembershipEvent` already filters but we should avoid running the donations handler for membership subs. The simplest pattern:

```ts
// inside the route handler, after constructing `event`:
const mdKind = readMetadataKind(event)
if (mdKind === 'membership') {
  await handleMembershipEvent({ event, payload, stripeSubscriptionRetrieve: (id, acct) => stripe.subscriptions.retrieve(id, { stripeAccount: acct }) })
} else {
  await handleDonationEvent(event, payload) // existing call
}
```

Define `readMetadataKind` locally:

```ts
function readMetadataKind(event: Stripe.Event): string | null {
  const obj = event.data.object as any
  if (obj?.metadata?.kind) return obj.metadata.kind
  // For subscription events, the metadata is on the subscription
  return null
}
```

- [ ] **Step 3: Add a regression test** in the same test file as the webhook route's existing tests (likely `tests/lib/donations-webhook.test.ts` covers the dispatch — if there's a route-level test, extend it; otherwise add a thin integration test in `tests/lib/membership-webhook-dispatch.test.ts` that calls the route handler with a fake event and asserts the right branch was taken).

- [ ] **Step 4: Run all tests.** `npm test --silent`. Pass.

- [ ] **Step 5: Commit.**

```
git add <touched files>
git commit -m "feat(membership): dispatch membership events from existing Connect webhook"
```

---

## Task 8: Public `/membership` page + tier card

**Files:**
- Create: `src/app/(site)/membership/page.tsx`
- Create: `src/components/MembershipTierCard.tsx`
- Create: `src/lib/data-membership.ts` (or extend existing `src/lib/data.ts`) with `fetchActiveTiers(tenant)`

- [ ] **Step 1: Add `fetchActiveTiers`** in `src/lib/data.ts` (mirror `fetchAnnouncements`):

```ts
export async function fetchActiveTiers(tenant: TenantRecord) {
  noStore()
  const payload = await payloadClient()
  try {
    const res = await payload.find({
      collection: 'membership-tiers',
      where: gate({
        tenant: { equals: tenant.id },
        active: { equals: true },
        stripePriceId: { exists: true },
      }, false),
      sort: ['sortOrder', 'name'],
      limit: 50,
      depth: 0,
      overrideAccess: true,
    })
    return res.docs
  } catch {
    return []
  }
}
```

- [ ] **Step 2: Create `MembershipTierCard.tsx`** — server component. Shows name, description (rich text via the existing `RichText` renderer), formatted amount, "/mo" or "/yr" label, and a `<form action="/api/membership/checkout" method="post">` with hidden `tierId` input and a submit button styled as primary CTA. Match the design conventions from `DonateForm` / existing pages.

- [ ] **Step 3: Create `/membership/page.tsx`.**

```tsx
// src/app/(site)/membership/page.tsx
import { getCurrentTenant } from '@/lib/tenant-server'
import { fetchActiveTiers } from '@/lib/data'
import MembershipTierCard from '@/components/MembershipTierCard'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata = { title: 'Membership' }

export default async function MembershipPage() {
  const tenant = await getCurrentTenant()
  if (!tenant) return null
  const connectLive = (tenant as any).stripeChargesEnabled === true
  const tiers = connectLive ? await fetchActiveTiers(tenant) : []

  return (
    <main className="mx-auto max-w-page px-6 py-16">
      <header className="mb-10 text-center">
        <h1 className="font-display text-[44px] font-medium leading-[1.15] tracking-tight text-fg1">Become a member</h1>
        <p className="mx-auto mt-4 max-w-xl text-fg2">Support {tenant.name} with a recurring contribution and stay connected with your community.</p>
      </header>

      {tiers.length === 0 ? (
        <p className="text-center text-fg2">Memberships are coming soon. Check back later.</p>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {tiers.map((t) => (
            <MembershipTierCard key={t.id} tier={t} />
          ))}
        </div>
      )}
    </main>
  )
}
```

- [ ] **Step 4: Typecheck.** `npx tsc --noEmit`. (No tests needed for purely visual page; tier-card markup is straightforward.)

- [ ] **Step 5: Commit.**

```
git add src/app/\(site\)/membership/page.tsx src/components/MembershipTierCard.tsx src/lib/data.ts
git commit -m "feat(membership): public /membership page with tier cards"
```

---

## Task 9: Checkout API route

**Files:**
- Create: `src/app/api/membership/checkout/route.ts`
- Test: `tests/lib/membership-checkout.test.ts`

- [ ] **Step 1: Failing test** for the route's pure helper. Refactor: extract a pure `buildCheckoutSessionArgs(tier, tenant, origin)` helper inside the route file (or a sibling lib), and unit-test that. The route handler stays thin.

```ts
// tests/lib/membership-checkout.test.ts
import { describe, it, expect } from 'vitest'
import { buildCheckoutSessionArgs } from '@/lib/membership-checkout'

const tier = { id: 11, name: 'Supporting', stripePriceId: 'price_x', active: true }
const tenant = { id: 7, name: 'Test Masjid', slug: 'test', stripeAccountId: 'acct_x', stripeChargesEnabled: true }

describe('buildCheckoutSessionArgs', () => {
  it('builds subscription-mode session with metadata', () => {
    const args = buildCheckoutSessionArgs(tier, tenant, 'https://test.openmasjid.app')
    expect(args.mode).toBe('subscription')
    expect(args.line_items[0]).toMatchObject({ price: 'price_x', quantity: 1 })
    expect(args.metadata).toMatchObject({ kind: 'membership', tenantId: '7', tierId: '11' })
    expect(args.subscription_data!.metadata).toMatchObject({ kind: 'membership' })
    expect(args.success_url).toContain('/membership/thanks')
    expect(args.cancel_url).toContain('/membership')
  })

  it('throws if tier has no stripePriceId', () => {
    expect(() => buildCheckoutSessionArgs({ ...tier, stripePriceId: null } as any, tenant, 'https://x')).toThrow(/not synced/)
  })

  it('throws if tenant has no Connect', () => {
    expect(() => buildCheckoutSessionArgs(tier, { ...tenant, stripeChargesEnabled: false } as any, 'https://x')).toThrow(/Connect/)
  })
})
```

- [ ] **Step 2: Implement helper + route.**

```ts
// src/lib/membership-checkout.ts
import type Stripe from 'stripe'

export function buildCheckoutSessionArgs(
  tier: { id: string | number; stripePriceId?: string | null; active: boolean },
  tenant: { id: string | number; stripeChargesEnabled?: boolean | null },
  origin: string,
): Stripe.Checkout.SessionCreateParams {
  if (!tenant.stripeChargesEnabled) throw new Error('Stripe Connect not enabled for this tenant')
  if (!tier.active) throw new Error('Tier is not active')
  if (!tier.stripePriceId) throw new Error('Tier is not synced to Stripe')
  return {
    mode: 'subscription',
    line_items: [{ price: tier.stripePriceId, quantity: 1 }],
    customer_creation: 'always',
    success_url: `${origin}/membership/thanks?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/membership`,
    metadata: { kind: 'membership', tenantId: String(tenant.id), tierId: String(tier.id) },
    subscription_data: { metadata: { kind: 'membership', tenantId: String(tenant.id), tierId: String(tier.id) } },
  }
}
```

```ts
// src/app/api/membership/checkout/route.ts
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getCurrentTenant } from '@/lib/tenant-server'
import { stripeForAccount } from '@/lib/stripe-connect'
import { buildCheckoutSessionArgs } from '@/lib/membership-checkout'

export async function POST(req: Request) {
  const tenant = await getCurrentTenant()
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
  const form = await req.formData()
  const tierId = form.get('tierId')
  if (!tierId) return NextResponse.json({ error: 'Missing tierId' }, { status: 400 })

  const payload = await getPayload({ config })
  const tier = await payload.findByID({ collection: 'membership-tiers', id: String(tierId), overrideAccess: true })
  if (!tier || (tier as any).tenant !== tenant.id) return NextResponse.json({ error: 'Tier not found' }, { status: 404 })

  try {
    const origin = req.headers.get('origin') ?? `https://${tenant.slug}.openmasjid.app`
    const args = buildCheckoutSessionArgs(tier as any, tenant as any, origin)
    const stripe = stripeForAccount((tenant as any).stripeAccountId)
    const session = await stripe.checkout.sessions.create(args, { stripeAccount: (tenant as any).stripeAccountId })
    return NextResponse.redirect(session.url!, 303)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Checkout failed'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
```

- [ ] **Step 3: Tests pass.** `npx vitest run tests/lib/membership-checkout.test.ts`.

- [ ] **Step 4: Typecheck.** `npx tsc --noEmit`.

- [ ] **Step 5: Commit.**

```
git add src/lib/membership-checkout.ts src/app/api/membership/checkout/route.ts tests/lib/membership-checkout.test.ts
git commit -m "feat(membership): /api/membership/checkout creates subscription session"
```

---

## Task 10: Customer Portal API route + thanks page

**Files:**
- Create: `src/app/api/membership/portal/route.ts`
- Create: `src/app/(site)/membership/thanks/page.tsx`

- [ ] **Step 1: Implement portal route.**

```ts
// src/app/api/membership/portal/route.ts
import { NextResponse } from 'next/server'
import { getCurrentTenant } from '@/lib/tenant-server'
import { stripeForAccount } from '@/lib/stripe-connect'

export async function POST(req: Request) {
  const tenant = await getCurrentTenant()
  if (!tenant?.stripeAccountId) return NextResponse.json({ error: 'Tenant Stripe not configured' }, { status: 404 })
  const form = await req.formData()
  const customerId = form.get('customerId')
  if (!customerId || typeof customerId !== 'string') return NextResponse.json({ error: 'Missing customerId' }, { status: 400 })

  const stripe = stripeForAccount(tenant.stripeAccountId)
  const session = await stripe.billingPortal.sessions.create(
    {
      customer: customerId,
      return_url: `${req.headers.get('origin') ?? `https://${tenant.slug}.openmasjid.app`}/membership`,
    },
    { stripeAccount: tenant.stripeAccountId },
  )
  return NextResponse.redirect(session.url, 303)
}
```

- [ ] **Step 2: Thanks page** — read `session_id` from query, fetch session via Stripe, show `customer_details.name`, tier name, and a "Manage your membership" button that POSTs to `/api/membership/portal` with the customer ID.

```tsx
// src/app/(site)/membership/thanks/page.tsx
import { getCurrentTenant } from '@/lib/tenant-server'
import { stripeForAccount } from '@/lib/stripe-connect'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Welcome — Membership' }

interface Props { searchParams: Promise<{ session_id?: string }> }

export default async function ThanksPage({ searchParams }: Props) {
  const tenant = await getCurrentTenant()
  const { session_id } = await searchParams
  if (!tenant || !session_id || !tenant.stripeAccountId) {
    return (
      <main className="mx-auto max-w-page px-6 py-24 text-center">
        <h1 className="font-display text-[36px] text-fg1">Thanks for joining!</h1>
        <p className="mt-4 text-fg2">Your membership is being set up. You'll get an email confirmation shortly.</p>
      </main>
    )
  }
  const stripe = stripeForAccount(tenant.stripeAccountId)
  const session = await stripe.checkout.sessions.retrieve(session_id, { stripeAccount: tenant.stripeAccountId })
  const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id ?? ''
  const name = session.customer_details?.name ?? 'friend'

  return (
    <main className="mx-auto max-w-page px-6 py-24 text-center">
      <h1 className="font-display text-[36px] text-fg1">Welcome, {name}!</h1>
      <p className="mt-4 text-fg2">Your membership at {tenant.name} is active. A receipt has been emailed to you.</p>
      {customerId && (
        <form action="/api/membership/portal" method="post" className="mt-8">
          <input type="hidden" name="customerId" value={customerId} />
          <button type="submit" className="rounded-md bg-brand px-6 py-3 font-body font-semibold text-white">
            Manage your membership
          </button>
        </form>
      )}
    </main>
  )
}
```

- [ ] **Step 3: Typecheck.** `npx tsc --noEmit`.

- [ ] **Step 4: Commit.**

```
git add src/app/api/membership/portal/route.ts src/app/\(site\)/membership/thanks/page.tsx
git commit -m "feat(membership): Customer Portal route + thanks page"
```

---

## Task 11: Admin overview view + aggregates lib

**Files:**
- Create: `src/lib/membership-aggregates.ts`
- Test: `tests/lib/membership-aggregates.test.ts`
- Create: `src/app/(payload)/admin/membership/overview/page.tsx`
- Create: `src/app/(payload)/admin/membership/overview/OverviewClient.tsx`

- [ ] **Step 1: Failing aggregates test.**

```ts
// tests/lib/membership-aggregates.test.ts
import { describe, it, expect } from 'vitest'
import { buildAggregates } from '@/lib/membership-aggregates'

const tiers = [
  { id: 1, name: 'Supporting', amountCents: 2500, cadence: 'monthly' as const },
  { id: 2, name: 'Patron', amountCents: 30000, cadence: 'yearly' as const },
]
const members = [
  { id: 'a', tier: 1, status: 'active' },
  { id: 'b', tier: 1, status: 'active' },
  { id: 'c', tier: 2, status: 'active' },
  { id: 'd', tier: 1, status: 'grace' },
  { id: 'e', tier: 1, status: 'inactive' },
]

describe('buildAggregates', () => {
  it('counts active/grace/inactive', () => {
    const a = buildAggregates(members as any, tiers as any)
    expect(a.activeCount).toBe(3)
    expect(a.graceCount).toBe(1)
    expect(a.inactiveCount).toBe(1)
  })

  it('computes MRR (yearly normalized to monthly)', () => {
    const a = buildAggregates(members as any, tiers as any)
    // 2 active × $25 (monthly) + 1 active × $300/12 = $50 + $25 = $75 = 7500 cents
    expect(a.mrrCents).toBe(7500)
  })

  it('per-tier breakdown counts and MRR', () => {
    const a = buildAggregates(members as any, tiers as any)
    const supporting = a.byTier.find((t) => t.tierId === 1)!
    expect(supporting.activeCount).toBe(2)
    expect(supporting.graceCount).toBe(1)
    expect(supporting.mrrCents).toBe(5000)
    const patron = a.byTier.find((t) => t.tierId === 2)!
    expect(patron.activeCount).toBe(1)
    expect(patron.mrrCents).toBe(2500)
  })
})
```

- [ ] **Step 2: Implement.**

```ts
// src/lib/membership-aggregates.ts
export interface MemberRow { id: string | number; tier: string | number | { id: string | number }; status: 'active' | 'grace' | 'inactive' }
export interface TierRow { id: string | number; name: string; amountCents: number; cadence: 'monthly' | 'yearly' }

export interface Aggregates {
  activeCount: number; graceCount: number; inactiveCount: number; mrrCents: number
  byTier: { tierId: string | number; tierName: string; activeCount: number; graceCount: number; mrrCents: number }[]
}

function tierIdOf(t: MemberRow['tier']): string | number {
  return typeof t === 'object' ? t.id : t
}

function monthlyCents(t: TierRow): number {
  return t.cadence === 'yearly' ? Math.round(t.amountCents / 12) : t.amountCents
}

export function buildAggregates(members: MemberRow[], tiers: TierRow[]): Aggregates {
  const tierById = new Map(tiers.map((t) => [t.id, t]))
  let activeCount = 0, graceCount = 0, inactiveCount = 0, mrrCents = 0
  const byTier = new Map<string | number, { tierId: string | number; tierName: string; activeCount: number; graceCount: number; mrrCents: number }>()
  for (const t of tiers) byTier.set(t.id, { tierId: t.id, tierName: t.name, activeCount: 0, graceCount: 0, mrrCents: 0 })

  for (const m of members) {
    const tid = tierIdOf(m.tier)
    const tier = tierById.get(tid)
    const bucket = byTier.get(tid)
    if (m.status === 'active') {
      activeCount++
      if (tier && bucket) {
        const c = monthlyCents(tier)
        mrrCents += c; bucket.activeCount++; bucket.mrrCents += c
      }
    } else if (m.status === 'grace') {
      graceCount++
      if (bucket) bucket.graceCount++
    } else {
      inactiveCount++
    }
  }

  return { activeCount, graceCount, inactiveCount, mrrCents, byTier: Array.from(byTier.values()) }
}
```

- [ ] **Step 3: Tests pass.**

- [ ] **Step 4: Implement admin overview** — mirror `src/app/(payload)/admin/donations/overview/page.tsx` and `OverviewClient.tsx`. Server page fetches members + tiers (admin-auth, tenant-scoped), computes aggregates, passes to client component for stat cards + table. Read the donations equivalents and adapt — don't try to invent a new layout.

- [ ] **Step 5: Typecheck + run all tests.** `npx tsc --noEmit && npm test --silent`.

- [ ] **Step 6: Commit.**

```
git add src/lib/membership-aggregates.ts tests/lib/membership-aggregates.test.ts src/app/\(payload\)/admin/membership
git commit -m "feat(membership): admin overview with active/grace/MRR breakdowns"
```

---

## Task 12: CSV export route

**Files:**
- Create: `src/app/api/members/export.csv/route.ts`
- Test: `tests/lib/members-export.test.ts`

- [ ] **Step 1: Failing test for the pure formatter.**

```ts
// tests/lib/members-export.test.ts
import { describe, it, expect } from 'vitest'
import { formatMembersCsv } from '@/lib/members-export'

describe('formatMembersCsv', () => {
  it('emits BOM + header row + escaped fields', () => {
    const csv = formatMembersCsv([
      { name: 'A, "B"', email: 'a@b.com', phone: null, tierName: 'Supporting', status: 'active', stripeSubscriptionStatus: 'active', joinedAt: '2026-01-01', currentPeriodEnd: '2026-02-01', canceledAt: null, stripeCustomerId: 'cus_x', stripeSubscriptionId: 'sub_x' },
    ])
    expect(csv.startsWith('﻿')).toBe(true)
    expect(csv).toContain('name,email,phone,tier,status')
    expect(csv).toContain('"A, ""B"""')
  })
})
```

- [ ] **Step 2: Implement** the formatter (mirror `src/app/api/donations/export.csv/route.ts`'s `csvEscape`) and route. Route reads tenant via `getCurrentTenant`, requires `req.user.role === 'admin'` (use the same admin-auth pattern as donations export), fetches all members for the tenant, joins to tier names, calls formatter, returns response with BOM, `text/csv; charset=utf-8`, `Content-Disposition: attachment; filename="members-{slug}-{YYYY-MM-DD}.csv"`.

- [ ] **Step 3: Tests pass + typecheck.**

- [ ] **Step 4: Commit.**

```
git add src/app/api/members/export.csv/route.ts src/lib/members-export.ts tests/lib/members-export.test.ts
git commit -m "feat(membership): admin CSV export"
```

---

## Task 13: Final integration check

- [ ] **Step 1: Re-run everything.** `npx tsc --noEmit && npm test --silent`. Both clean.

- [ ] **Step 2: Build smoke-test.** `npm run build 2>&1 | tail -30`. Expect a successful build — fix any new build errors (often Next.js metadata/edge runtime mismatches, server/client boundary issues with the form actions).

- [ ] **Step 3: Manual smoke-test plan.** Add this to the eventual PR body so the reviewer/QA can run it post-merge:

```
## Manual smoke test (run after merging + applying migration)

Pre-req: a tenant with Stripe Connect Express live (chargesEnabled).

1. Admin → Membership → Tiers → Create tier "Supporting", $25/mo. Save.
   → Verify lastStripeSyncAt is set, no error, stripeProductId/stripePriceId populated.
2. Visit /membership on the tenant site. Card renders with tier name and price.
3. Click "Become a member". Stripe Checkout opens. Complete with test card 4242…
4. Land on /membership/thanks. Click "Manage your membership" → Stripe Customer Portal opens.
5. Admin → Membership → Overview. Active count = 1, MRR = $25.
6. Admin → Members → see the new row. Status = active, tier = Supporting.
7. In Customer Portal, cancel the subscription.
8. Admin overview reflects: active = 0, inactive = 1.
9. CSV export → file downloads with BOM, name/email/tier/status correct.
10. Edit the tier amount to $50. Verify a new stripePriceId, old pushed to archivedPriceIds. Existing member continues at $25 (Stripe behavior).
11. Set tier `active = false`. Tier hides from /membership but admin still shows the existing member's tier name.
```

- [ ] **Step 4: Generate PR description** from this plan + spec link. Open PR via `gh pr create`. The PR's description should reference issue #46, link to both the spec and this plan, and embed the smoke-test plan above as the "Test plan" checklist.

- [ ] **Step 5: Final commit (only if anything tweaked during integration).**

---

## Out of scope (do not implement)

- Free / non-paying members (deferred A milestone)
- Member-side login / sessions / magic-link auth
- Content gating on Pages/Announcements/Events (deferred C milestone)
- Email notifications beyond Stripe's automatic receipts
- Trial periods on tiers
- Multiple concurrent subscriptions per member at the same tenant
- Public member directory
- Date-range filters in the admin overview (matches donations module's current scope)

If any of these come up during implementation, stop and flag — do not silently expand scope.
