# Demo Masjid Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a public, always-on demo masjid at `demo.openmasjid.app` that runs the full money layer (donations, memberships, paid forms) in Stripe **test mode** inside the existing live deployment, with an editable shared admin and a nightly reset — without touching real tenants, live keys, or real money.

**Architecture:** A single `demoMode` flag on the tenant is the master switch. Connect Stripe calls route through a new tenant-aware client (`getStripeForTenant`) that returns a **test** Stripe client for the demo tenant and the live client for everyone else. The Connect webhook verifies against both live and test signing secrets so the demo's `4242` payments round-trip into real `Member`/`Donation`/form rows scoped to the demo tenant. A shared seed module provisions the demo tenant + content and is reused by a nightly `/api/demo/reset` route fired by the existing `crond` sidecar.

**Tech Stack:** Next.js (App Router) + Payload CMS 3 (Postgres/drizzle, explicit migrations), Stripe Node SDK (Connect direct charges), Vitest, Docker Compose (`crond` sidecar).

**Spec:** `docs/superpowers/specs/2026-06-04-demo-masjid-design.md`

---

## File Structure

**Create**
- `src/lib/demo/demoContent.ts` — pure data constants for the demo tenant + content.
- `src/lib/demo/seedDemo.ts` — `ensureDemoTenant`, `seedDemoContent`, `resetDemoContent`.
- `scripts/seed-demo.ts` — run-as-script entrypoint to provision/refresh the demo.
- `src/app/api/demo/reset/route.ts` — authed nightly reset endpoint.
- Tests: `tests/lib/stripe-for-tenant.test.ts`, `tests/lib/connect-webhook-dual-secret.test.ts`, `tests/api/demo-reset-auth.test.ts`, `tests/lib/demo-email-gate.test.ts`.

**Modify**
- `src/lib/stripe.ts` — add `getStripeTest()` + `getStripeForTenant()`.
- `src/app/api/membership/checkout/route.ts`, `src/app/api/membership/portal/route.ts`, `src/app/api/donations/checkout/route.ts` — route through `getStripeForTenant(tenant)`.
- `src/lib/form-checkout.ts` — accept `demoMode` on the tenant arg; route accordingly.
- `src/lib/membership-stripe.ts` (+ caller `MembershipTiers.hooks.ts`) — tier sync uses the tenant-aware client.
- `src/app/api/stripe/connect/webhook/route.ts` — dual-secret verify + mode-correct retrieve client.
- `src/collections/Tenants.ts` — add `demoMode` field; new migration.
- `src/lib/form-notifications.ts` — early-return when `tenant.demoMode`.
- `docker-compose.prod.yml` — add daily reset crontab line + `TZ` on the cron sidecar.
- `.env.example` — `STRIPE_SECRET_KEY_TEST`, `STRIPE_CONNECT_WEBHOOK_SECRET_TEST`, `DEMO_STRIPE_ACCOUNT_ID`.

---

# Phase 1 — Foundation

## Task 1: Add `demoMode` flag to Tenants

**Files:**
- Modify: `src/collections/Tenants.ts` (Account tab, after the `status` field block at lines 553+)
- Migration: generated under `src/migrations/`

- [ ] **Step 1: Add the field.** In the **Account** tab's `fields` array (the tab whose `label: 'Account'`, ~line 530), immediately after the `status` field object (closes ~line 553), insert:

```ts
            {
              name: 'demoMode',
              type: 'checkbox',
              defaultValue: false,
              label: 'Demo tenant',
              admin: {
                hidden: true,
                description:
                  'Public demo tenant. Routes Stripe to TEST mode, sandboxes email, and is wiped nightly. Never set on a real masjid.',
              },
              access: { update: platformOwnerFieldUpdate },
            },
```

(`platformOwnerFieldUpdate` already exists at line 18 — reuse it, do not redefine.)

- [ ] **Step 2: Generate the migration.**

Run: `npx payload migrate:create demo_mode`
Expected: a new file `src/migrations/<timestamp>_demo_mode.ts` adding a `demo_mode` boolean column to `tenants`.

- [ ] **Step 3: Apply + typecheck.**

Run: `npx payload migrate && npx tsc --noEmit`
Expected: migration applies cleanly; `payload-types.ts` regenerates with `demoMode?: boolean | null` on `Tenant` (run `npx payload generate:types` if it doesn't auto-update).

- [ ] **Step 4: Commit.**

```bash
git add src/collections/Tenants.ts src/migrations src/payload-types.ts
git commit -m "feat(demo): add demoMode flag to tenants"
```

---

## Task 2: Tenant-aware Stripe client

**Files:**
- Modify: `src/lib/stripe.ts`
- Test: `tests/lib/stripe-for-tenant.test.ts`

- [ ] **Step 1: Write the failing test.**

```ts
// tests/lib/stripe-for-tenant.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { getStripe, getStripeTest, getStripeForTenant, __resetStripeCache } from '@/lib/stripe'

describe('getStripeForTenant', () => {
  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = 'sk_live_dummy'
    process.env.STRIPE_SECRET_KEY_TEST = 'sk_test_dummy'
    __resetStripeCache()
  })

  it('returns the live client for a normal tenant', () => {
    expect(getStripeForTenant({ demoMode: false })).toBe(getStripe())
  })

  it('returns the test client for a demo tenant', () => {
    expect(getStripeForTenant({ demoMode: true })).toBe(getStripeTest())
  })

  it('returns the live client when tenant is null/undefined', () => {
    expect(getStripeForTenant(null)).toBe(getStripe())
    expect(getStripeForTenant(undefined)).toBe(getStripe())
  })

  it('caches each client (same instance across calls)', () => {
    expect(getStripeTest()).toBe(getStripeTest())
  })
})
```

- [ ] **Step 2: Run it to confirm it fails.**

Run: `npx vitest run tests/lib/stripe-for-tenant.test.ts`
Expected: FAIL — `getStripeTest`/`getStripeForTenant`/`__resetStripeCache` not exported.

- [ ] **Step 3: Implement.** Replace the body of `src/lib/stripe.ts` with:

```ts
import Stripe from 'stripe'

const API_VERSION = '2025-02-24.acacia' as const

let cachedLive: Stripe | null = null
let cachedTest: Stripe | null = null

export function getStripe(): Stripe {
  if (cachedLive) return cachedLive
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set')
  cachedLive = new Stripe(key, { apiVersion: API_VERSION })
  return cachedLive
}

export function getStripeTest(): Stripe {
  if (cachedTest) return cachedTest
  const key = process.env.STRIPE_SECRET_KEY_TEST
  if (!key) throw new Error('STRIPE_SECRET_KEY_TEST is not set')
  cachedTest = new Stripe(key, { apiVersion: API_VERSION })
  return cachedTest
}

/** Connect calls route here: demo tenants use the TEST platform key, all
 *  others the live key. The mode follows the platform key (Stripe forbids
 *  mixing a live key with a test connected account and vice-versa). */
export function getStripeForTenant(
  tenant: { demoMode?: boolean | null } | null | undefined,
): Stripe {
  return tenant?.demoMode ? getStripeTest() : getStripe()
}

/** Test-only: clear cached clients so env changes take effect. */
export function __resetStripeCache(): void {
  cachedLive = null
  cachedTest = null
}

export function getPriceId(plan: 'monthly' | 'annual'): string {
  const id = plan === 'monthly' ? process.env.STRIPE_PRICE_MONTHLY : process.env.STRIPE_PRICE_ANNUAL
  if (!id) throw new Error(`Missing Stripe price env var for plan=${plan}`)
  return id
}
```

- [ ] **Step 4: Run the test.**

Run: `npx vitest run tests/lib/stripe-for-tenant.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Add env vars.** In `.env.example`, under the Stripe section, add:

```bash
# Demo tenant (test mode) — see docs/superpowers/specs/2026-06-04-demo-masjid-design.md
STRIPE_SECRET_KEY_TEST=
STRIPE_CONNECT_WEBHOOK_SECRET_TEST=
DEMO_STRIPE_ACCOUNT_ID=
```

- [ ] **Step 6: Commit.**

```bash
git add src/lib/stripe.ts tests/lib/stripe-for-tenant.test.ts .env.example
git commit -m "feat(demo): tenant-aware Stripe client (test key for demo tenant)"
```

---

# Phase 2 — Route Connect calls through the tenant-aware client

> Each task swaps `getStripe()` / `stripeForAccount()` for `getStripeForTenant(tenant)` at one Connect call site. The `{ stripeAccount }` request option is unchanged. Run `npx tsc --noEmit` after each.

## Task 3: Membership checkout + portal

**Files:**
- Modify: `src/app/api/membership/checkout/route.ts`
- Modify: `src/app/api/membership/portal/route.ts`

- [ ] **Step 1: membership/checkout.** Replace the import `import { stripeForAccount } from '@/lib/stripe-connect'` with `import { getStripeForTenant } from '@/lib/stripe'`, then change the client line (currently `const stripe = stripeForAccount(stripeAccountId)`, ~line 68) to:

```ts
    const stripe = getStripeForTenant(tenant as { demoMode?: boolean | null })
```

(Leave `stripe.checkout.sessions.create(args, { stripeAccount: stripeAccountId })` unchanged.)

- [ ] **Step 2: membership/portal.** Same swap: import `getStripeForTenant` from `@/lib/stripe`, change `const stripe = stripeForAccount(stripeAccountId)` (~line 62) to:

```ts
  const stripe = getStripeForTenant(tenant as { demoMode?: boolean | null })
```

- [ ] **Step 3: Verify the tenant carries `demoMode`.** `getCurrentTenant()` returns the full tenant doc, so `demoMode` is present. Confirm with: `grep -n "getCurrentTenant" src/lib/tenant-server.ts` returns the full-doc resolver (no field projection). If it projects fields, add `demoMode` to the projection.

- [ ] **Step 4: Typecheck + commit.**

```bash
npx tsc --noEmit
git add src/app/api/membership/checkout/route.ts src/app/api/membership/portal/route.ts
git commit -m "feat(demo): route membership checkout + portal via tenant-aware Stripe"
```

## Task 4: Donations checkout

**Files:** Modify `src/app/api/donations/checkout/route.ts`

- [ ] **Step 1:** Add `import { getStripeForTenant } from '@/lib/stripe'` (keep or drop the existing `getStripe` import depending on remaining use). Change `const stripe = getStripe()` (~line 84) to:

```ts
  const stripe = getStripeForTenant(tenant as { demoMode?: boolean | null })
```

(`stripe.checkout.sessions.create(params, { stripeAccount: dc.stripeAccountId })` unchanged.)

- [ ] **Step 2: Typecheck + commit.**

```bash
npx tsc --noEmit
git add src/app/api/donations/checkout/route.ts
git commit -m "feat(demo): route donations checkout via tenant-aware Stripe"
```

## Task 5: Form checkout

**Files:** Modify `src/lib/form-checkout.ts`

- [ ] **Step 1:** Extend the `tenant` shape in the `Args` interface (lines 6-11) to include `demoMode`:

```ts
  tenant: {
    id: string | number
    stripeAccountId?: string | null
    slug?: string | null
    customDomains?: Array<{ domain: string }> | null
    demoMode?: boolean | null
  }
```

- [ ] **Step 2:** Change `import { getStripe } from './stripe'` → `import { getStripeForTenant } from './stripe'`, and change `const stripe = getStripe()` (line 19) to:

```ts
  const stripe = getStripeForTenant(tenant)
```

- [ ] **Step 3: Ensure callers pass `demoMode`.** Run `grep -rn "createFormCheckoutSession" src` and confirm each caller's `tenant` object includes `demoMode` (it will if the tenant was loaded as a full doc; if a caller hand-builds the tenant object, add `demoMode: tenant.demoMode`). Update callers as needed.

- [ ] **Step 4: Run the existing form-checkout test + typecheck.**

Run: `npx vitest run tests/lib/form-checkout.test.ts && npx tsc --noEmit`
Expected: PASS (update the test's tenant fixture with `demoMode: false` if it asserts on the Stripe client; the live path is unchanged for non-demo).

- [ ] **Step 5: Commit.**

```bash
git add src/lib/form-checkout.ts tests/lib/form-checkout.test.ts
git commit -m "feat(demo): route form checkout via tenant-aware Stripe"
```

## Task 6: Membership tier sync

**Files:**
- Inspect: `src/lib/membership-stripe.ts`, `src/collections/MembershipTiers.hooks.ts`

Creating a paid tier fires `syncTierAfterChange`, which creates a Stripe Product/Price **on the connected account**. For the demo tenant this must use the test client.

- [ ] **Step 1: Locate the Stripe client acquisition.** Run `grep -n "getStripe\|stripeForAccount\|stripeAccount" src/lib/membership-stripe.ts src/collections/MembershipTiers.hooks.ts`. Identify where the sync builds its Stripe client.

- [ ] **Step 2: Thread the tenant.** The hook has the tier's `tenant` relationship and loads the tenant doc to check `stripeChargesEnabled`. Pass that tenant (or its `demoMode`) into the sync helper and replace the client acquisition with `getStripeForTenant(tenant)`. If the helper currently takes no client, add a `stripe: Stripe` parameter and have the hook pass `getStripeForTenant(tenant)`.

- [ ] **Step 3: Typecheck + run membership tests.**

Run: `npx tsc --noEmit && npx vitest run tests/lib/membership-signup.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit.**

```bash
git add src/lib/membership-stripe.ts src/collections/MembershipTiers.hooks.ts
git commit -m "feat(demo): tier Stripe sync uses tenant-aware client"
```

## Task 7: Dual-secret Connect webhook + mode-correct retrieve

**Files:**
- Modify: `src/app/api/stripe/connect/webhook/route.ts`
- Test: `tests/lib/connect-webhook-dual-secret.test.ts`

- [ ] **Step 1: Write the failing test** (verifies a helper that picks the right secret/client):

```ts
// tests/lib/connect-webhook-dual-secret.test.ts
import { describe, it, expect } from 'vitest'
import Stripe from 'stripe'
import { verifyConnectEvent } from '@/app/api/stripe/connect/webhook/verify'

function sign(secret: string, payload: object): { raw: string; sig: string } {
  const raw = JSON.stringify(payload)
  const header = Stripe.webhooks.generateTestHeaderString({ payload: raw, secret })
  return { raw, sig: header }
}

describe('verifyConnectEvent', () => {
  const live = 'whsec_live_dummy'
  const test = 'whsec_test_dummy'

  it('accepts an event signed with the live secret and reports live mode', () => {
    const { raw, sig } = sign(live, { id: 'evt_1', type: 'ping', livemode: true })
    const r = verifyConnectEvent(raw, sig, { liveSecret: live, testSecret: test })
    expect(r?.mode).toBe('live')
    expect(r?.event.id).toBe('evt_1')
  })

  it('accepts an event signed with the test secret and reports test mode', () => {
    const { raw, sig } = sign(test, { id: 'evt_2', type: 'ping', livemode: false })
    const r = verifyConnectEvent(raw, sig, { liveSecret: live, testSecret: test })
    expect(r?.mode).toBe('test')
  })

  it('rejects an event signed with an unknown secret', () => {
    const { raw, sig } = sign('whsec_bogus', { id: 'evt_3', type: 'ping' })
    expect(verifyConnectEvent(raw, sig, { liveSecret: live, testSecret: test })).toBeNull()
  })

  it('skips the test secret when it is unset', () => {
    const { raw, sig } = sign(live, { id: 'evt_4', type: 'ping' })
    const r = verifyConnectEvent(raw, sig, { liveSecret: live, testSecret: undefined })
    expect(r?.mode).toBe('live')
  })
})
```

- [ ] **Step 2: Run it to confirm failure.**

Run: `npx vitest run tests/lib/connect-webhook-dual-secret.test.ts`
Expected: FAIL — module `verify` not found.

- [ ] **Step 3: Implement the verifier.** Create `src/app/api/stripe/connect/webhook/verify.ts`:

```ts
import type Stripe from 'stripe'
import { getStripe, getStripeTest } from '@/lib/stripe'

export interface VerifiedConnectEvent {
  event: Stripe.Event & { account?: string }
  mode: 'live' | 'test'
  stripe: Stripe
}

/**
 * Verify a Connect webhook against both the live and test signing secrets.
 * Returns the parsed event plus the mode-correct Stripe client, or null if
 * neither secret validates the signature.
 */
export function verifyConnectEvent(
  raw: string,
  sig: string,
  secrets: { liveSecret?: string; testSecret?: string },
): VerifiedConnectEvent | null {
  const candidates: Array<{ secret: string; mode: 'live' | 'test'; stripe: Stripe }> = []
  if (secrets.liveSecret) candidates.push({ secret: secrets.liveSecret, mode: 'live', stripe: getStripe() })
  if (secrets.testSecret) candidates.push({ secret: secrets.testSecret, mode: 'test', stripe: getStripeTest() })

  for (const c of candidates) {
    try {
      const event = c.stripe.webhooks.constructEvent(raw, sig, c.secret) as Stripe.Event & {
        account?: string
      }
      return { event, mode: c.mode, stripe: c.stripe }
    } catch {
      // try the next secret
    }
  }
  return null
}
```

Note: `getStripe()`/`getStripeTest()` are only constructed for secrets that are present, so an unset `STRIPE_SECRET_KEY_TEST` never throws here as long as `testSecret` is also unset. (In the demo deployment both are set together.)

- [ ] **Step 4: Wire it into the route.** In `src/app/api/stripe/connect/webhook/route.ts`, replace lines 14-26 (signature/secret/constructEvent block) and the `const stripe = getStripe()` with:

```ts
  const sig = req.headers.get('stripe-signature')
  if (!sig) {
    return NextResponse.json({ error: 'missing signature' }, { status: 400 })
  }
  const raw = await req.text()
  const verified = verifyConnectEvent(raw, sig, {
    liveSecret: process.env.STRIPE_CONNECT_WEBHOOK_SECRET,
    testSecret: process.env.STRIPE_CONNECT_WEBHOOK_SECRET_TEST,
  })
  if (!verified) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 400 })
  }
  const { event, stripe } = verified
```

Add the import: `import { verifyConnectEvent } from './verify'` and remove the now-unused `getStripe` import if nothing else uses it. The downstream `Promise.all` block (lines 31-44) already uses the local `stripe` variable for the retrieve closures — because `verified.stripe` is the mode-correct client, test events retrieve against the test client automatically. No other changes.

- [ ] **Step 5: Run the test + typecheck.**

Run: `npx vitest run tests/lib/connect-webhook-dual-secret.test.ts && npx tsc --noEmit`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit.**

```bash
git add src/app/api/stripe/connect/webhook/route.ts src/app/api/stripe/connect/webhook/verify.ts tests/lib/connect-webhook-dual-secret.test.ts
git commit -m "feat(demo): dual-secret Connect webhook with mode-correct client"
```

---

# Phase 3 — Demo tenant content + seed

## Task 8: Demo content constants

**Files:** Create `src/lib/demo/demoContent.ts`

- [ ] **Step 1: Write the data module.** Plain constants mirroring the field shapes confirmed in the collections (Tenants, MembershipTiers, Forms, Announcements, Events). `DEMO_SLUG` is the resolution key; the Stripe account id comes from env so it isn't committed.

```ts
export const DEMO_SLUG = 'demo'

export const demoTenantData = {
  name: 'Masjid al-Noor (Demo)',
  slug: DEMO_SLUG,
  siteType: 'masjid' as const,
  demoMode: true,
  status: 'grandfathered' as const,
  branding: {
    primaryColor: '#0F1E4A',
    secondaryColor: '#28A0B4',
    accentColor: '#F0C88C',
    displayFont: 'Fraunces' as const,
  },
  contactInfo: {
    phone: '+1 (555) 010-2030',
    email: 'salaam@demo.openmasjid.app',
    address: '100 Community Way, Demo City, TX 75000',
  },
  footerTagline: 'A friendly place to see OpenMasjid in action',
  location: { lat: 32.7767, lng: -96.797, timezone: 'America/Chicago' },
  prayerCalc: { method: 'ISNA' as const, asrMadhab: 'Standard' as const },
} as const

/** donationConfig is set separately because stripeAccountId comes from env. */
export function demoDonationConfig() {
  const acct = process.env.DEMO_STRIPE_ACCOUNT_ID
  if (!acct) throw new Error('DEMO_STRIPE_ACCOUNT_ID is not set')
  return {
    mode: 'connect' as const,
    stripeAccountId: acct,
    stripeChargesEnabled: true,
  }
}

export const demoMembershipTiers = [
  { name: 'Supporter', amountCents: 1000, cadence: 'monthly' as const, active: true, sortOrder: 1 },
  { name: 'Family', amountCents: 2500, cadence: 'monthly' as const, active: true, sortOrder: 2 },
  { name: 'Patron', amountCents: 10000, cadence: 'annual' as const, active: true, sortOrder: 3 },
] as const

export const demoAnnouncements = [
  { title: 'Welcome to the OpenMasjid demo', priority: 'normal' as const, active: true },
  { title: 'Jumu’ah khutbah begins at 1:30 PM', priority: 'high' as const, active: true },
] as const

export const demoEvents = [
  {
    title: 'Weekly Halaqa',
    slug: 'weekly-halaqa',
    shortDescription: 'A weekly circle of knowledge after Isha.',
    tag: 'weekly-class' as const,
    when: 'Wednesdays after Isha',
    displayMode: 'text' as const,
    location: 'Main prayer hall',
    audience: ['all' as const],
  },
  {
    title: 'Community Iftar',
    slug: 'community-iftar',
    shortDescription: 'Open iftar for the whole community.',
    tag: 'event' as const,
    when: 'Every Saturday in Ramadan',
    displayMode: 'text' as const,
    location: 'Community hall',
    audience: ['families' as const, 'all' as const],
  },
] as const

export const demoForm = {
  title: 'Eid Dinner RSVP (Demo)',
  slug: 'eid-dinner-rsvp',
  status: 'published' as const,
  schema: {
    steps: [
      {
        id: 's1',
        fields: [
          { id: 'name', type: 'text', label: 'Your name', required: true },
          { id: 'guests', type: 'number', label: 'Number of guests', required: true },
        ],
      },
    ],
  },
  settings: { submitButtonLabel: 'RSVP', sendConfirmation: false },
} as const
```

- [ ] **Step 2: Typecheck + commit.**

```bash
npx tsc --noEmit
git add src/lib/demo/demoContent.ts
git commit -m "feat(demo): demo tenant content constants"
```

> NOTE for implementer: before writing the create-calls in Task 9, open `src/collections/Forms.ts`, `src/collections/Announcements.ts`, and `src/collections/Events.ts` and confirm every field name above matches (e.g. the Events `tag`/`audience` enum values, the Form `schema` field shape). Adjust the constants to satisfy each collection's `required` fields and `validate` hooks. Do not invent enum values — copy them from the `options` arrays.

## Task 9: Seed / reset module

**Files:** Create `src/lib/demo/seedDemo.ts`

This is the shared engine used by both the seed script (Task 10) and the reset route (Task 12). Mirrors `scripts/seed.ts` idioms: find-or-create the tenant, delete-all + recreate mutable content.

- [ ] **Step 1: Implement.** Use a loosely-typed `payload` so it works with the real client and tests.

```ts
import type { Payload } from 'payload'
import {
  DEMO_SLUG,
  demoTenantData,
  demoDonationConfig,
  demoMembershipTiers,
  demoAnnouncements,
  demoEvents,
  demoForm,
} from './demoContent'

const seedReq: any = { user: { id: 0, role: 'platformOwner', email: 'demo-seed@seed' } }

async function findTenant(payload: Payload): Promise<{ id: string | number } | undefined> {
  const res = await payload.find({
    collection: 'tenants' as any,
    where: { slug: { equals: DEMO_SLUG } },
    limit: 1,
    overrideAccess: true,
  })
  return res.docs[0] as any
}

async function deleteAllForTenant(payload: Payload, collection: string, tenantId: string | number) {
  await payload.delete({
    collection: collection as any,
    where: { tenant: { equals: tenantId } },
    overrideAccess: true,
    req: seedReq,
  })
}

/** Create or update the demo tenant. Idempotent. Returns its id. */
export async function ensureDemoTenant(payload: Payload): Promise<string | number> {
  const data = { ...demoTenantData, donationConfig: demoDonationConfig() }
  const existing = await findTenant(payload)
  if (existing) {
    await payload.update({
      collection: 'tenants' as any,
      id: existing.id,
      data,
      overrideAccess: true,
      req: seedReq,
    })
    return existing.id
  }
  const created = (await payload.create({
    collection: 'tenants' as any,
    data,
    overrideAccess: true,
    req: seedReq,
  })) as { id: string | number }
  return created.id
}

/** Wipe the demo tenant's mutable content and recreate the canonical set. */
export async function seedDemoContent(payload: Payload, tenantId: string | number): Promise<void> {
  // Mutable collections wiped on every run (members/donations/form-submissions
  // are visitor-generated; the rest may have been edited in the demo admin).
  for (const c of ['members', 'donations', 'form-submissions', 'announcements', 'events', 'forms', 'membership-tiers']) {
    await deleteAllForTenant(payload, c, tenantId)
  }

  for (const t of demoMembershipTiers) {
    // Creating a paid tier triggers syncTierAfterChange → Stripe (test) Product/Price.
    await payload.create({
      collection: 'membership-tiers' as any,
      data: { ...t, tenant: tenantId },
      overrideAccess: true,
      req: seedReq,
    })
  }
  for (const a of demoAnnouncements) {
    await payload.create({
      collection: 'announcements' as any,
      data: { ...a, tenant: tenantId },
      overrideAccess: true,
      req: seedReq,
    })
  }
  for (const e of demoEvents) {
    await payload.create({
      collection: 'events' as any,
      data: { ...e, _status: 'published', tenant: tenantId },
      overrideAccess: true,
      req: seedReq,
    })
  }
  await payload.create({
    collection: 'forms' as any,
    data: { ...demoForm, tenant: tenantId },
    overrideAccess: true,
    req: seedReq,
  })
}

/** Full reset: ensure tenant exists, then rebuild content. */
export async function resetDemoContent(payload: Payload): Promise<{ tenantId: string | number }> {
  const tenantId = await ensureDemoTenant(payload)
  await seedDemoContent(payload, tenantId)
  return { tenantId }
}
```

- [ ] **Step 2: Typecheck.**

Run: `npx tsc --noEmit`
Expected: clean. (If `events` `description` is a required richText field, import the `richText` helper pattern from `scripts/seed.ts` and add it in the events loop.)

- [ ] **Step 3: Commit.**

```bash
git add src/lib/demo/seedDemo.ts
git commit -m "feat(demo): shared seed/reset engine for the demo tenant"
```

## Task 10: Seed entrypoint script

**Files:** Create `scripts/seed-demo.ts`

- [ ] **Step 1: Implement** (mirrors the bottom of `scripts/seed.ts`):

```ts
import { getPayload } from 'payload'
import config from '@payload-config'
import { resetDemoContent } from '@/lib/demo/seedDemo'
import { ensureDemoAdmin } from '@/lib/demo/seedDemo' // added in Task 11

async function main() {
  const payload = await getPayload({ config })
  const { tenantId } = await resetDemoContent(payload)
  await ensureDemoAdmin(payload, tenantId)
  console.log('✓ Demo tenant provisioned:', tenantId)
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
```

- [ ] **Step 2: Add an npm script.** In `package.json` `scripts`, add: `"seed:demo": "tsx scripts/seed-demo.ts"` (match the runner used by the existing `seed` script — check `package.json` for whether it's `tsx`, `ts-node`, or `payload run`).

- [ ] **Step 3: Commit** (do not run against prod yet — needs env + Task 11).

```bash
git add scripts/seed-demo.ts package.json
git commit -m "feat(demo): seed-demo entrypoint script"
```

## Task 11: Demo admin user

**Files:** Modify `src/lib/demo/seedDemo.ts`

- [ ] **Step 1: Add `ensureDemoAdmin`.** Idempotent; creates a shared `admin` user scoped to the demo tenant. Password comes from env so it isn't committed.

```ts
export async function ensureDemoAdmin(payload: Payload, tenantId: string | number): Promise<void> {
  const email = process.env.DEMO_ADMIN_EMAIL || 'demo-admin@demo.openmasjid.app'
  const password = process.env.DEMO_ADMIN_PASSWORD
  if (!password) throw new Error('DEMO_ADMIN_PASSWORD is not set')
  const existing = await payload.find({
    collection: 'users' as any,
    where: { email: { equals: email } },
    limit: 1,
    overrideAccess: true,
  })
  const data: any = { email, role: 'admin', tenant: tenantId }
  if (existing.docs[0]) {
    await payload.update({ collection: 'users' as any, id: (existing.docs[0] as any).id, data: { ...data, password }, overrideAccess: true, req: seedReq })
  } else {
    await payload.create({ collection: 'users' as any, data: { ...data, password }, overrideAccess: true, req: seedReq })
  }
}
```

- [ ] **Step 2: Add envs to `.env.example`:** `DEMO_ADMIN_EMAIL=`, `DEMO_ADMIN_PASSWORD=`.

- [ ] **Step 3: Typecheck + commit.**

```bash
npx tsc --noEmit
git add src/lib/demo/seedDemo.ts .env.example
git commit -m "feat(demo): seed shared demo admin user"
```

---

# Phase 4 — Reset automation

## Task 12: `/api/demo/reset` route

**Files:**
- Create: `src/app/api/demo/reset/route.ts`
- Test: `tests/api/demo-reset-auth.test.ts`

Mirrors the **prod sidecar** auth convention: `X-Cron-Secret` header vs `CRON_SECRET`, fail-closed (matches `jobs.access.run`).

- [ ] **Step 1: Write the failing auth test.**

```ts
// tests/api/demo-reset-auth.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('payload', () => ({ getPayload: vi.fn(async () => ({})) }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/lib/demo/seedDemo', () => ({ resetDemoContent: vi.fn(async () => ({ tenantId: 7 })) }))

import { POST } from '@/app/api/demo/reset/route'
import { resetDemoContent } from '@/lib/demo/seedDemo'

function req(headers: Record<string, string>) {
  return new Request('http://x/api/demo/reset', { method: 'POST', headers })
}

describe('POST /api/demo/reset', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = 's3cret'
  })

  it('rejects when the secret is missing', async () => {
    const res = await POST(req({}))
    expect(res.status).toBe(403)
    expect(resetDemoContent).not.toHaveBeenCalled()
  })

  it('rejects a wrong secret', async () => {
    const res = await POST(req({ 'x-cron-secret': 'nope' }))
    expect(res.status).toBe(403)
  })

  it('runs the reset with the correct secret', async () => {
    const res = await POST(req({ 'x-cron-secret': 's3cret' }))
    expect(res.status).toBe(200)
    expect(resetDemoContent).toHaveBeenCalledOnce()
  })

  it('fails closed when CRON_SECRET is unset', async () => {
    delete process.env.CRON_SECRET
    const res = await POST(req({ 'x-cron-secret': '' }))
    expect(res.status).toBe(403)
  })
})
```

- [ ] **Step 2: Run it to confirm failure.**

Run: `npx vitest run tests/api/demo-reset-auth.test.ts`
Expected: FAIL — route module not found.

- [ ] **Step 3: Implement the route.**

```ts
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { resetDemoContent } from '@/lib/demo/seedDemo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function authorized(req: Request): boolean {
  const expected = process.env.CRON_SECRET ?? ''
  if (!expected) return false // fail closed when unset
  const provided = req.headers.get('x-cron-secret') ?? ''
  if (provided.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < provided.length; i++) diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i)
  return diff === 0
}

export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  const payload = await getPayload({ config })
  const { tenantId } = await resetDemoContent(payload)
  return NextResponse.json({ reset: true, tenantId })
}
```

- [ ] **Step 4: Run the test + typecheck.**

Run: `npx vitest run tests/api/demo-reset-auth.test.ts && npx tsc --noEmit`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit.**

```bash
git add src/app/api/demo/reset/route.ts tests/api/demo-reset-auth.test.ts
git commit -m "feat(demo): authed /api/demo/reset endpoint"
```

## Task 13: Nightly cron + timezone

**Files:** Modify `docker-compose.prod.yml` (the `cron` service, lines 67-76)

- [ ] **Step 1: Add the daily reset line + TZ.** Replace the `cron` service block with (note the new `environment:` TZ and the second crontab line appended with `&&`):

```yaml
  cron:
    image: alpine:3.20
    restart: unless-stopped
    depends_on:
      - app
    env_file: ${ENV_FILE:-.env}
    environment:
      TZ: America/Chicago
    command: >
      sh -c "apk add --no-cache curl tzdata >/dev/null &&
      printf '%s\n%s\n'
      '* * * * * curl -fsS -X POST http://app:3000/api/payload-jobs/run -H \"X-Cron-Secret: $$CRON_SECRET\" >> /proc/1/fd/1 2>&1'
      '0 1 * * * curl -fsS -X POST http://app:3000/api/demo/reset -H \"X-Cron-Secret: $$CRON_SECRET\" >> /proc/1/fd/1 2>&1'
      > /etc/crontabs/root &&
      crond -f -L /dev/stdout"
```

`TZ=America/Chicago` + the bundled `tzdata` makes busybox `crond` interpret `0 1 * * *` as 1:00 AM Central with automatic DST. The every-minute jobs line is unaffected.

- [ ] **Step 2: Validate compose syntax.**

Run: `docker compose -f docker-compose.prod.yml config >/dev/null && echo OK`
Expected: `OK` (no YAML/interpolation errors).

- [ ] **Step 3: Commit.**

```bash
git add docker-compose.prod.yml
git commit -m "feat(demo): nightly demo reset cron at 1am CT"
```

---

# Phase 5 — Hardening (before exposing the demo publicly)

## Task 14: Email sandbox for demo tenant

**Files:**
- Modify: `src/lib/form-notifications.ts`
- Test: `tests/lib/demo-email-gate.test.ts`

- [ ] **Step 1: Write the failing test.**

```ts
// tests/lib/demo-email-gate.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const fetchMock = vi.fn(async () => ({ ok: true, status: 200 }))
vi.stubGlobal('fetch', fetchMock)

import { shouldSendForTenant } from '@/lib/form-notifications'

describe('demo email gate', () => {
  beforeEach(() => vi.clearAllMocks())
  it('suppresses email for a demo tenant', () => {
    expect(shouldSendForTenant({ demoMode: true })).toBe(false)
  })
  it('allows email for a normal tenant', () => {
    expect(shouldSendForTenant({ demoMode: false })).toBe(true)
  })
  it('allows email when tenant is missing', () => {
    expect(shouldSendForTenant(null)).toBe(true)
  })
})
```

- [ ] **Step 2: Run it to confirm failure.**

Run: `npx vitest run tests/lib/demo-email-gate.test.ts`
Expected: FAIL — `shouldSendForTenant` not exported.

- [ ] **Step 3: Implement.** In `src/lib/form-notifications.ts`, export the guard and call it inside `sendFormNotifications` after `loadTenant`:

```ts
export function shouldSendForTenant(tenant: { demoMode?: boolean | null } | null | undefined): boolean {
  return !tenant?.demoMode
}
```

Then in `sendFormNotifications`, immediately after `const tenant = await loadTenant(form)` (line 177):

```ts
  if (!shouldSendForTenant(tenant)) {
    console.info('[form-notifications] demo tenant; suppressing outbound email')
    return
  }
```

- [ ] **Step 4: Audit other senders.** Run `grep -rn "sendEmail\|api.resend.com\|RESEND_API_KEY" src` and confirm the only outbound paths are form-notifications, contact actions, and Payload auth (password reset / invite). For the demo: leave `RESEND_API_KEY` **unset in the demo's env context if it shares config**, and gate the contact-form sender on `demoMode` the same way if it loads a tenant. Document any path that can't be gated (e.g. Payload built-in auth emails) — mitigated because the demo admin is a single shared account and invites are disabled (Task 15).

- [ ] **Step 5: Run the test + typecheck.**

Run: `npx vitest run tests/lib/demo-email-gate.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit.**

```bash
git add src/lib/form-notifications.ts tests/lib/demo-email-gate.test.ts
git commit -m "feat(demo): sandbox outbound email for demo tenant"
```

## Task 15: Demo-admin guardrails

**Files:** Modify `src/collections/Tenants.ts`, `src/collections/Users.ts`

Prevent the shared demo admin from tampering with config that the reset can't restore or that exposes risk (Stripe connect/disconnect, billing, domains, inviting users).

- [ ] **Step 1: Block Connect changes on the demo tenant.** The demo's `donationConfig.stripeAccountId` is set by seed and must not be editable from the demo admin UI. It already has `access: { update: platformOwnerFieldUpdate }` (Tenants.ts:710) — confirm the Connect OAuth callback route and disconnect route refuse to run for a `demoMode` tenant. In `src/app/api/stripe/connect/callback/route.ts` and `src/app/api/stripe/connect/disconnect/route.ts`, after resolving the tenant, add:

```ts
  if ((tenant as { demoMode?: boolean }).demoMode) {
    return NextResponse.redirect(new URL('/admin/donations/connect?status=demo_locked', url))
  }
```

(Adjust the response shape to each route.)

- [ ] **Step 2: Block user invites on the demo tenant.** Run `grep -rn "inviteUser" src/endpoints src/app` to find the invite endpoint; early-return 403 when the acting user's tenant has `demoMode`.

- [ ] **Step 3: Block domain edits.** The `customDomains` field (Tenants.ts) — add `access: { update: platformOwnerFieldUpdate }` if not already platform-gated, so demo admins can't point the demo at another domain.

- [ ] **Step 4: Typecheck + commit.**

```bash
npx tsc --noEmit
git add src/collections/Tenants.ts src/app/api/stripe/connect/callback/route.ts src/app/api/stripe/connect/disconnect/route.ts
git commit -m "feat(demo): guardrails on shared demo admin (no connect/invite/domain changes)"
```

## Task 16: Exclude demo tenant from cross-tenant reporting

**Files:** dashboard/Overview data loaders (discovered below)

The aggregate functions are pure reducers (no queries), so exclusion belongs in the **callers** that fetch rows for platform-wide views.

- [ ] **Step 1: Find cross-tenant fetchers.** Run:

```bash
grep -rn "computeAggregates\|buildAggregates" src
grep -rn "collection: 'donations'\|collection: 'members'\|collection: \"donations\"\|collection: \"members\"" src/app src/lib
```

Identify any loader that queries **across all tenants** (platform-owner MRR / totals dashboards). Per-tenant admin views (scoped to one tenant) need no change — a demo admin seeing demo totals is fine.

- [ ] **Step 2: Add the exclusion.** For each cross-tenant query, add a `demoMode` filter. Since `demoMode` lives on `tenants`, filter by excluding the demo tenant id (resolve it once via `slug = 'demo'`) or join: `where: { 'tenant.demoMode': { not_equals: true } }` if the collection supports relationship-field filtering; otherwise fetch the demo tenant id and add `{ tenant: { not_equals: demoTenantId } }`.

- [ ] **Step 3: Typecheck + commit.**

```bash
npx tsc --noEmit
git add -A
git commit -m "feat(demo): exclude demo tenant from cross-tenant reporting"
```

---

# Manual / Ops checklist (not code — do after Phase 4, before going public)

- [ ] In Stripe **test mode**: copy `sk_test_…` → `STRIPE_SECRET_KEY_TEST` in the deploy env.
- [ ] In Stripe **test mode → Connect → Accounts**: create a connected account, complete test onboarding until `charges_enabled` is true, copy its `acct_…` → `DEMO_STRIPE_ACCOUNT_ID`.
- [ ] In Stripe **test mode → Webhooks**: add endpoint `https://demo.openmasjid.app/api/stripe/connect/webhook` (subscribe to the same events as the live Connect endpoint). Copy its signing secret → `STRIPE_CONNECT_WEBHOOK_SECRET_TEST`.
- [ ] Set `DEMO_ADMIN_EMAIL`, `DEMO_ADMIN_PASSWORD` in the deploy env.
- [ ] Run `npm run seed:demo` against prod to provision the tenant, content, tiers (which sync to test Stripe), and demo admin.
- [ ] Add `demo.openmasjid.app` subdomain routing (DNS/hosting), matching existing subdomain tenants.
- [ ] Smoke test: complete a `4242` membership on the demo and confirm a `Member` row appears in the demo admin; confirm a real tenant's live checkout is unaffected.

---

# Self-Review notes (for the executor)

- **Spec corrections folded in here:** (1) the spec said "four Connect call sites" — it's actually six (added tier-sync and the webhook); (2) the spec implied reporting exclusion lives in the aggregate files — it lives in the cross-tenant *callers* (Task 16), because the aggregates are pure reducers; (3) reset auth uses the prod sidecar's `X-Cron-Secret`/`CRON_SECRET` convention (not the kiosk route's `Authorization: Bearer`).
- **Verify-before-write reminders are embedded** in Tasks 3, 5, 6, 8, 15, 16 where exact field names / caller shapes must be confirmed against the live collections rather than assumed.
