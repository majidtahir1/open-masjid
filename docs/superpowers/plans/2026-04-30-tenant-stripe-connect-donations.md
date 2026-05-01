# Tenant Stripe Connect + Donation Funds — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `docs/superpowers/specs/2026-04-30-tenant-stripe-connect-donations-design.md`

**Goal:** Enable each tenant to connect their own Stripe account (Standard Connect, direct charges, no platform fee) and accept donations against tenant-managed funds with one-time and monthly recurring giving.

**Architecture:** Stripe Connect Standard with direct charges on the connected account. Two new collections (`donationFunds`, `donations`). New tenant fields for connect state. OAuth-based onboarding. Hosted Stripe Checkout. Single Connect-mode webhook endpoint receives events from all connected accounts. Aggregate-only donation records, no PII — donor identity always lives in Stripe.

**Tech Stack:** Next.js App Router, Payload CMS 3.x, PostgreSQL, Stripe Node SDK (already at `2025-02-24.acacia`), TypeScript, Vitest, Tailwind.

---

## Design System Compliance (MANDATORY for all UI tasks)

**Every public-facing and admin-facing UI built in this plan MUST follow the existing OpenMasjid / ICP design system. No ad-hoc styles, no Tailwind-only inventions, no off-token colors.**

**Reference files** (read these before writing any UI):

- `OpenMasjid_marketing/shared/colors_and_type.css` — design tokens (canonical)
- `OpenMasjid_marketing/shared/site.css` — global layout / spacing
- `OpenMasjid_marketing/shared/tenant.css` — per-tenant skinning rules
- `OpenMasjid_marketing/pages/home.css`, `pricing.css`, `features.css`, `other.css` — page composition patterns
- `OpenMasjid_marketing/shared/Header.jsx`, `Footer.jsx`, `Logo.jsx`, `Icons.jsx`, `TenantPreview.jsx` — component prototypes
- `src/app/(site)/donate/page.tsx` — current donate-page implementation (uses tokens correctly: `text-fg1`, `bg-brand`, `tracking-caps`, `font-display`, `r-md`, `sh-sm`, `secondary-soft`)
- `src/app/(payload)/admin/billing/BillingClient.tsx` — current admin client component (mirror this pattern for tenant-side admin pages)

**Token usage rules:**

- Colors: use semantic tokens (`bg-brand`, `bg-brand-hover`, `text-fg1`, `text-fg2`, `text-fg3`, `border-border`, `bg-bg-alt`, `bg-secondary-soft`, `text-success`, `text-danger`). Never hex literals in JSX outside the `tenants.branding` color picker fields.
- Typography: `font-display` (Fraunces) for headings, `font-body` (Inter) for body, `tracking-caps` for eyebrows.
- Type sizes: `text-fs-xs`, `text-fs-sm`, `text-fs-base`, `text-fs-lg`, etc. — never raw `text-[14px]` outside hero-scale display headlines.
- Radii: `rounded-[var(--r-md)]` (cards/buttons), `rounded-[var(--r-sm)]` (small chips), `rounded-pill` (badges). Never raw `rounded-lg`.
- Shadows: `shadow-sh-sm`, `shadow-sh-md`. Never raw `shadow-lg`.
- Spacing: section padding `py-20`, container max-width `max-w-[820px]` or grid widths from existing pages.

**Pattern to mirror:** Open `src/app/(site)/donate/page.tsx` and copy its structural conventions (eyebrow, display headline, supporting copy, branded primary CTA with `bg-brand` + `hover:bg-brand-hover` + `shadow-sh-sm` + hover lift `hover:-translate-y-px`). The new donate-page redesign must remain visually consistent with this existing page.

**Verification step (every UI task includes this):** Before committing a UI change, grep the new code for `text-\[#`, `bg-\[#`, `rounded-lg`, `shadow-lg`, `text-\[1[0-9]px\]`, `border-gray-`, `bg-gray-` — if any match, replace with tokens.

---

## Existing Codebase Patterns to Follow

- **Stripe client:** `src/lib/stripe.ts` — call `getStripe()`, do not new-up Stripe directly.
- **Webhook signature:** `src/app/api/stripe/billing/webhook/route.ts` — copy the `runtime = 'nodejs'`, raw-body, `constructEvent` pattern.
- **Mapper-style separation:** `src/lib/billing-webhook.ts` exports a pure mapper consumed by the route. Replicate this for the connect webhook.
- **Tenant-scoped collections:** `src/collections/Events.ts`, `src/collections/Services.ts` — copy access-control + `tenant` field patterns.
- **Migrations:** `src/migrations/20260430_144311_tenant_billing_fields.ts` — copy structure and pair `.ts` + `.json` snapshot.
- **Tests:** `tests/lib/billing-webhook.test.ts`, `tests/lib/signup-stripe.test.ts` — Vitest, mock the Stripe SDK.
- **Endpoints (Payload custom):** `src/endpoints/createTenant.ts` — for any tenant-side server logic that needs tenant-scoped access.
- **Admin React components:** `src/admin/CreateTenantPanel`, `src/admin/onboarding/MilestonePanel.tsx`, `src/app/(payload)/admin/billing/BillingClient.tsx` — patterns for custom Payload admin UI.

---

## Phase Structure (for parallel execution)

The plan is split into **phases**. Tasks within a phase can be dispatched in parallel to subagents. Phases must complete in order.

- **Phase 0 — Foundation (sequential, single agent):** Task 1.
- **Phase 1 — Schema & Connect (3 parallel tracks):** Tasks 2, 3, 4.
- **Phase 2 — Funds, Checkout, Webhook (3 parallel tracks):** Tasks 5, 6, 7.
- **Phase 3 — Dashboard & Wizard (2 parallel tracks):** Tasks 8, 9.
- **Phase 4 — Integration verification (sequential):** Task 10.

Each task includes: files, TDD steps with failing test first, implementation code, exact commands, and a commit step.

---

## Task 1 — Data Model & Migration (Phase 0, sequential)

**Why first:** Every other task imports the new collections / fields. Land this before parallel work begins.

**Files:**

- Create: `src/collections/DonationFunds.ts`
- Create: `src/collections/Donations.ts`
- Modify: `src/collections/Tenants.ts` (extend `donationConfig` group, rename `mode: 'stripe'` → `'connect'`, add capability/timestamp fields)
- Modify: `src/payload.config.ts` (register `DonationFunds`, `Donations`)
- Create: `src/migrations/<timestamp>_donation_funds_and_donations.ts` (and `.json` snapshot)
- Create: `src/hooks/seedDefaultDonationFunds.ts` (afterChange hook on `tenants` create)
- Modify: `src/collections/Tenants.ts` to register the seed hook
- Test: `tests/collections/donationFunds.access.test.ts`
- Test: `tests/collections/donations.access.test.ts`
- Test: `tests/hooks/seedDefaultDonationFunds.test.ts`

### Subtasks

- [ ] **1.1 — Write failing test for `donationFunds` access control**

```ts
// tests/collections/donationFunds.access.test.ts
import { describe, it, expect, beforeAll } from 'vitest'
import { getPayload } from 'payload'
import config from '@payload-config'

describe('donationFunds access', () => {
  let payload: Awaited<ReturnType<typeof getPayload>>

  beforeAll(async () => {
    payload = await getPayload({ config })
  })

  it('rejects reads from a different tenant', async () => {
    // Create two tenants, one fund per tenant; assert tenant A staff cannot read tenant B's fund.
    // ... (use payload.create with overrideAccess and then payload.find with the tenant-A user as req.user)
    expect(true).toBe(true) // placeholder until implementation exists
  })
})
```

- [ ] **1.2 — Run test to verify failure**

```
pnpm exec vitest run tests/collections/donationFunds.access.test.ts
```

Expected: collection slug `donation-funds` not found (since collection isn't registered yet).

- [ ] **1.3 — Implement `DonationFunds.ts`**

```ts
// src/collections/DonationFunds.ts
import type { CollectionConfig } from 'payload'
import { tenantScopedAccess } from '../access/tenantScoped'

export const DonationFunds: CollectionConfig = {
  slug: 'donation-funds',
  labels: { singular: 'Donation Fund', plural: 'Donation Funds' },
  admin: {
    group: 'Donations',
    useAsTitle: 'name',
    defaultColumns: ['name', 'zakatEligible', 'active', 'sortOrder'],
    description: 'Categories donors can give toward (Sadaqah, Zakat, Building Fund, etc.).',
  },
  access: tenantScopedAccess(),
  fields: [
    { name: 'tenant', type: 'relationship', relationTo: 'tenants', required: true, index: true,
      admin: { hidden: true } },
    { name: 'name', type: 'text', required: true,
      admin: { description: 'Public-facing fund name (e.g. "Sadaqah", "Zakat", "Building Fund").' } },
    { name: 'slug', type: 'text', required: true, index: true,
      admin: { description: 'URL-safe identifier, unique within this tenant.' } },
    { name: 'description', type: 'textarea',
      admin: { description: 'Optional description shown beneath the fund name on the donate page.' } },
    { name: 'zakatEligible', type: 'checkbox', defaultValue: false,
      admin: { description: 'Mark true for funds that accept Zakat (restricted use).' } },
    { name: 'suggestedAmounts', type: 'array',
      labels: { singular: 'Suggested Amount', plural: 'Suggested Amounts' },
      fields: [{ name: 'amount', type: 'number', required: true, min: 1,
        admin: { description: 'Whole-dollar amount shown as a quick-pick.' } }],
      admin: { description: 'Suggested donation chips (e.g. 25, 50, 100, 250). Optional.' } },
    { name: 'sortOrder', type: 'number', defaultValue: 0 },
    { name: 'active', type: 'checkbox', defaultValue: true,
      admin: { description: 'Inactive funds are hidden from the public donate page.' } },
  ],
  indexes: [{ fields: ['tenant', 'slug'], unique: true }],
}

export default DonationFunds
```

- [ ] **1.4 — Implement `Donations.ts` (read-only from admin; webhook writes via overrideAccess)**

```ts
// src/collections/Donations.ts
import type { CollectionConfig } from 'payload'
import { tenantScopedReadAccess } from '../access/tenantScoped'

export const Donations: CollectionConfig = {
  slug: 'donations',
  labels: { singular: 'Donation', plural: 'Donations' },
  admin: {
    group: 'Donations',
    useAsTitle: 'stripePaymentIntentId',
    defaultColumns: ['createdAt', 'fund', 'amount', 'frequency', 'status'],
    description: 'Aggregate donation records. No donor PII is stored — donor identity lives in Stripe.',
  },
  access: {
    create: () => false,
    update: () => false,
    delete: () => false,
    read: tenantScopedReadAccess(),
  },
  fields: [
    { name: 'tenant', type: 'relationship', relationTo: 'tenants', required: true, index: true,
      admin: { readOnly: true } },
    { name: 'fund', type: 'relationship', relationTo: 'donation-funds', required: true,
      admin: { readOnly: true } },
    { name: 'amount', type: 'number', required: true, min: 0,
      admin: { description: 'Amount in cents.', readOnly: true } },
    { name: 'currency', type: 'text', defaultValue: 'usd', admin: { readOnly: true } },
    { name: 'frequency', type: 'select', required: true,
      options: [{ label: 'One-time', value: 'one_time' }, { label: 'Monthly', value: 'monthly' }],
      admin: { readOnly: true } },
    { name: 'status', type: 'select', required: true,
      options: [
        { label: 'Succeeded', value: 'succeeded' },
        { label: 'Refunded', value: 'refunded' },
        { label: 'Failed', value: 'failed' },
      ],
      admin: { readOnly: true } },
    { name: 'stripePaymentIntentId', type: 'text', required: true, unique: true, index: true,
      admin: { readOnly: true } },
    { name: 'stripeChargeId', type: 'text', admin: { readOnly: true } },
    { name: 'stripeSubscriptionId', type: 'text', admin: { readOnly: true } },
    { name: 'stripeAccountId', type: 'text', required: true, admin: { readOnly: true } },
  ],
  timestamps: true,
}

export default Donations
```

- [ ] **1.5 — Add `tenantScopedReadAccess` if it does not exist**

Inspect `src/access/tenantScoped.ts`. If a read-only-by-tenant helper exists, reuse it. Otherwise add:

```ts
// src/access/tenantScoped.ts (append)
export function tenantScopedReadAccess() {
  return ({ req: { user } }: { req: { user: any } }) => {
    if (!user) return false
    if (user.role === 'platformOwner') return true
    const tenantId = typeof user.tenant === 'object' ? user.tenant?.id : user.tenant
    if (!tenantId) return false
    return { tenant: { equals: tenantId } }
  }
}
```

- [ ] **1.6 — Extend tenant `donationConfig`**

In `src/collections/Tenants.ts`, replace the existing Donations tab `mode` options and add capability/timestamp fields:

```ts
// inside the Donations tab → donationConfig group → fields:
{
  name: 'mode',
  type: 'select',
  defaultValue: 'external',
  label: 'Donation Mode',
  options: [
    { label: 'External link (LaunchGood, PayPal, etc.)', value: 'external' },
    { label: 'Stripe Connect (on-site)', value: 'connect' },
  ],
  admin: { description: 'External link is the default. Switch to Stripe Connect after connecting your account.' },
},
// keep externalUrl as-is, condition on mode === 'external'
{
  name: 'stripeAccountId',
  type: 'text',
  label: 'Stripe Account ID',
  admin: { hidden: true, readOnly: true,
    description: 'Connected Stripe account ID. Set automatically by the Connect OAuth flow.' },
},
{ name: 'stripeAccountConnectedAt', type: 'date', admin: { hidden: true, readOnly: true } },
{ name: 'stripeChargesEnabled', type: 'checkbox', defaultValue: false,
  admin: { hidden: true, readOnly: true } },
{ name: 'stripePayoutsEnabled', type: 'checkbox', defaultValue: false,
  admin: { hidden: true, readOnly: true } },
{ name: 'stripeAccountLastSyncedAt', type: 'date', admin: { hidden: true, readOnly: true } },
```

Remove the manually-edited `stripeAccountId` field condition (`mode === 'stripe'`); the field is now write-only-by-OAuth and hidden.

- [ ] **1.7 — Create seed hook for default funds**

```ts
// src/hooks/seedDefaultDonationFunds.ts
import type { CollectionAfterChangeHook } from 'payload'

export const seedDefaultDonationFunds: CollectionAfterChangeHook = async ({
  doc, operation, req,
}) => {
  if (operation !== 'create') return doc
  await req.payload.create({
    collection: 'donation-funds',
    data: {
      tenant: doc.id,
      name: 'Sadaqah',
      slug: 'sadaqah',
      zakatEligible: false,
      sortOrder: 0,
      active: true,
      suggestedAmounts: [{ amount: 25 }, { amount: 50 }, { amount: 100 }, { amount: 250 }],
    },
    overrideAccess: true,
  })
  await req.payload.create({
    collection: 'donation-funds',
    data: {
      tenant: doc.id,
      name: 'Zakat',
      slug: 'zakat',
      zakatEligible: true,
      sortOrder: 1,
      active: true,
      suggestedAmounts: [{ amount: 100 }, { amount: 250 }, { amount: 500 }],
    },
    overrideAccess: true,
  })
  return doc
}
```

Register in `Tenants.ts` `hooks.afterChange`.

- [ ] **1.8 — Register collections**

In `src/payload.config.ts`, import `DonationFunds` and `Donations` and add to `collections: [...]`.

- [ ] **1.9 — Generate Payload types & migration**

```
pnpm payload generate:types
pnpm payload migrate:create donation_funds_and_donations
```

Inspect the generated `.ts` migration; ensure it (a) renames any `donation_config_mode = 'stripe'` rows to `'connect'`, (b) creates the two new tables, (c) adds the new tenant columns. Add an explicit UPDATE if the rename is missing:

```ts
await db.execute(sql`UPDATE tenants SET donation_config_mode = 'connect' WHERE donation_config_mode = 'stripe'`)
```

- [ ] **1.10 — Run migration locally**

```
pnpm payload migrate
```

- [ ] **1.11 — Implement test bodies & verify**

Fill in the access tests (cross-tenant read denial, tenant-scoped read OK) and the seed hook test (creating a tenant produces exactly two funds with correct slugs / `zakatEligible`).

```
pnpm exec vitest run tests/collections/donationFunds.access.test.ts tests/collections/donations.access.test.ts tests/hooks/seedDefaultDonationFunds.test.ts
```

Expected: all green.

- [ ] **1.12 — Commit**

```
git add src/collections/DonationFunds.ts src/collections/Donations.ts \
  src/collections/Tenants.ts src/payload.config.ts \
  src/hooks/seedDefaultDonationFunds.ts src/access/tenantScoped.ts \
  src/migrations/*donation_funds_and_donations* \
  src/payload-types.ts \
  tests/collections/donationFunds.access.test.ts \
  tests/collections/donations.access.test.ts \
  tests/hooks/seedDefaultDonationFunds.test.ts
git commit -m "feat(donations): add donationFunds + donations collections, seed defaults, extend tenant connect fields"
```

---

## Task 2 — Stripe Connect OAuth (Phase 1, parallel track A)

**Files:**

- Create: `src/lib/stripe-connect.ts` (helpers: `buildAuthorizeUrl`, `signState`, `verifyState`, `exchangeCode`, `fetchAccount`, `disconnectAccount`)
- Create: `src/app/api/stripe/connect/authorize/route.ts`
- Create: `src/app/api/stripe/connect/callback/route.ts`
- Create: `src/app/api/stripe/connect/disconnect/route.ts`
- Test: `tests/lib/stripe-connect.test.ts`
- Test: `tests/api/stripe-connect-oauth.test.ts`

### Subtasks

- [ ] **2.1 — Write failing tests for `signState` / `verifyState`**

```ts
// tests/lib/stripe-connect.test.ts
import { describe, it, expect, vi } from 'vitest'
import { signState, verifyState } from '@/lib/stripe-connect'

describe('connect state JWT', () => {
  it('round-trips tenantId + userId', async () => {
    process.env.PAYLOAD_SECRET = 'test-secret-32-bytes-or-longer-please'
    const token = signState({ tenantId: 't1', userId: 'u1' })
    const decoded = verifyState(token)
    expect(decoded).toMatchObject({ tenantId: 't1', userId: 'u1' })
  })

  it('rejects forged tokens', () => {
    process.env.PAYLOAD_SECRET = 'test-secret-32-bytes-or-longer-please'
    expect(() => verifyState('bogus.value.here')).toThrow()
  })

  it('rejects expired tokens', () => {
    process.env.PAYLOAD_SECRET = 'test-secret-32-bytes-or-longer-please'
    const token = signState({ tenantId: 't1', userId: 'u1' }, { expiresInSec: -1 })
    expect(() => verifyState(token)).toThrow(/expired/i)
  })
})
```

Run: `pnpm exec vitest run tests/lib/stripe-connect.test.ts` — expect FAIL.

- [ ] **2.2 — Implement `stripe-connect.ts`**

```ts
// src/lib/stripe-connect.ts
import crypto from 'crypto'
import { getStripe } from './stripe'

interface StatePayload { tenantId: string | number; userId: string | number; nonce: string; exp: number }

export interface SignStateOpts { expiresInSec?: number }

function secret(): string {
  const s = process.env.PAYLOAD_SECRET
  if (!s) throw new Error('PAYLOAD_SECRET is not set')
  return s
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function b64urlDecode(input: string): Buffer {
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4))
  return Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64')
}

export function signState(p: { tenantId: string | number; userId: string | number }, opts: SignStateOpts = {}): string {
  const exp = Math.floor(Date.now() / 1000) + (opts.expiresInSec ?? 600)
  const payload: StatePayload = { tenantId: p.tenantId, userId: p.userId, nonce: crypto.randomBytes(8).toString('hex'), exp }
  const body = b64url(JSON.stringify(payload))
  const sig = b64url(crypto.createHmac('sha256', secret()).update(body).digest())
  return `${body}.${sig}`
}

export function verifyState(token: string): StatePayload {
  const [body, sig] = token.split('.')
  if (!body || !sig) throw new Error('malformed state token')
  const expected = b64url(crypto.createHmac('sha256', secret()).update(body).digest())
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) throw new Error('invalid state signature')
  const payload = JSON.parse(b64urlDecode(body).toString('utf8')) as StatePayload
  if (payload.exp < Math.floor(Date.now() / 1000)) throw new Error('state expired')
  return payload
}

export function buildAuthorizeUrl(opts: { tenantId: string | number; userId: string | number; redirectUri: string }): string {
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
```

- [ ] **2.3 — Verify state tests pass**

```
pnpm exec vitest run tests/lib/stripe-connect.test.ts
```

- [ ] **2.4 — Write failing route tests**

```ts
// tests/api/stripe-connect-oauth.test.ts
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/stripe', () => ({
  getStripe: () => ({
    oauth: {
      token: vi.fn().mockResolvedValue({ stripe_user_id: 'acct_test_123' }),
      deauthorize: vi.fn().mockResolvedValue({}),
    },
    accounts: {
      retrieve: vi.fn().mockResolvedValue({
        id: 'acct_test_123', charges_enabled: true, payouts_enabled: true,
      }),
    },
  }),
}))

// authorize route returns a 302 to connect.stripe.com with state param
// callback route exchanges code, retrieves account, updates tenant, redirects to /admin/donations/connect?status=success
// callback rejects mismatched tenant in state vs session
// disconnect calls stripe.oauth.deauthorize and clears tenant fields
```

Fill in concrete tests using `payload.create` to set up a tenant + admin user, then invoke the route handlers via `POST`/`GET` Next-style request mocks.

Run: `pnpm exec vitest run tests/api/stripe-connect-oauth.test.ts` — expect FAIL.

- [ ] **2.5 — Implement authorize route**

```ts
// src/app/api/stripe/connect/authorize/route.ts
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import { buildAuthorizeUrl } from '@/lib/stripe-connect'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const payload = await getPayload({ config })
  const h = await headers()
  const auth = await payload.auth({ headers: h })
  const user = auth.user
  if (!user || (user.role !== 'admin' && user.role !== 'platformOwner')) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const tenantId = typeof user.tenant === 'object' ? (user.tenant as { id: string | number }).id : user.tenant
  if (!tenantId) return NextResponse.json({ error: 'no tenant' }, { status: 400 })
  const proto = h.get('x-forwarded-proto') ?? 'https'
  const host = h.get('host')
  const redirectUri = `${proto}://${host}/api/stripe/connect/callback`
  const url = buildAuthorizeUrl({ tenantId, userId: user.id, redirectUri })
  return NextResponse.redirect(url)
}
```

- [ ] **2.6 — Implement callback route**

```ts
// src/app/api/stripe/connect/callback/route.ts
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import { verifyState, exchangeCode, fetchAccount } from '@/lib/stripe-connect'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  if (!code || !state) return NextResponse.redirect(new URL('/admin/donations/connect?status=missing', url))
  let decoded
  try { decoded = verifyState(state) } catch {
    return NextResponse.redirect(new URL('/admin/donations/connect?status=invalid_state', url))
  }
  const payload = await getPayload({ config })
  const h = await headers()
  const auth = await payload.auth({ headers: h })
  if (!auth.user || String(auth.user.id) !== String(decoded.userId)) {
    return NextResponse.redirect(new URL('/admin/donations/connect?status=user_mismatch', url))
  }
  const sessionTenantId = typeof auth.user.tenant === 'object' ? (auth.user.tenant as { id: string | number }).id : auth.user.tenant
  if (String(sessionTenantId) !== String(decoded.tenantId)) {
    return NextResponse.redirect(new URL('/admin/donations/connect?status=tenant_mismatch', url))
  }
  const { stripeUserId } = await exchangeCode(code)
  const account = await fetchAccount(stripeUserId)
  await payload.update({
    collection: 'tenants',
    id: decoded.tenantId,
    data: {
      donationConfig: {
        mode: 'connect',
        stripeAccountId: stripeUserId,
        stripeAccountConnectedAt: new Date().toISOString(),
        stripeChargesEnabled: !!account.charges_enabled,
        stripePayoutsEnabled: !!account.payouts_enabled,
        stripeAccountLastSyncedAt: new Date().toISOString(),
      },
    },
    overrideAccess: true,
  })
  return NextResponse.redirect(new URL('/admin/donations/connect?status=success', url))
}
```

- [ ] **2.7 — Implement disconnect route**

```ts
// src/app/api/stripe/connect/disconnect/route.ts
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import { disconnectAccount } from '@/lib/stripe-connect'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST() {
  const payload = await getPayload({ config })
  const h = await headers()
  const auth = await payload.auth({ headers: h })
  const user = auth.user
  if (!user || (user.role !== 'admin' && user.role !== 'platformOwner')) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const tenantId = typeof user.tenant === 'object' ? (user.tenant as { id: string | number }).id : user.tenant
  if (!tenantId) return NextResponse.json({ error: 'no tenant' }, { status: 400 })
  const tenant = await payload.findByID({ collection: 'tenants', id: tenantId, overrideAccess: true })
  const acct = (tenant as any)?.donationConfig?.stripeAccountId
  if (acct) {
    try { await disconnectAccount(acct) } catch (err) {
      payload.logger.warn(`stripe-connect disconnect: ${(err as Error).message}`)
    }
  }
  await payload.update({
    collection: 'tenants', id: tenantId, overrideAccess: true,
    data: {
      donationConfig: {
        mode: 'external',
        stripeAccountId: null,
        stripeAccountConnectedAt: null,
        stripeChargesEnabled: false,
        stripePayoutsEnabled: false,
        stripeAccountLastSyncedAt: null,
      },
    },
  })
  return NextResponse.json({ disconnected: true })
}
```

- [ ] **2.8 — Verify all tests pass**

```
pnpm exec vitest run tests/lib/stripe-connect.test.ts tests/api/stripe-connect-oauth.test.ts
```

- [ ] **2.9 — Commit**

```
git add src/lib/stripe-connect.ts src/app/api/stripe/connect tests/lib/stripe-connect.test.ts tests/api/stripe-connect-oauth.test.ts
git commit -m "feat(donations): stripe connect oauth (authorize/callback/disconnect)"
```

---

## Task 3 — Donation Funds Admin UI (Phase 1, parallel track B)

**Files:**

- Create: `src/admin/donations/FundsListIntro.tsx` — renders an explanatory header on the funds list view (uses `text-fs-xs uppercase tracking-caps text-brand` eyebrow + `font-display` headline + `text-fg2` body, mirroring `donate/page.tsx`).
- Modify: `src/collections/DonationFunds.ts` — add `admin.components.beforeListTable` pointing at the intro component.
- Test: `tests/collections/donationFunds.crud.test.ts` (CRUD as admin user, slug uniqueness per tenant).

### Subtasks

- [ ] **3.1 — Failing CRUD test**

Tenant admin can create, list, edit, archive (set `active: false`), reorder via `sortOrder`. Slug uniqueness is per-tenant (two tenants can both have `slug: 'sadaqah'`).

- [ ] **3.2 — Verify the unique index from Task 1.3 is `[tenant, slug]`** (not just `slug`). Adjust the migration if needed.

- [ ] **3.3 — Build `FundsListIntro.tsx`**

```tsx
// src/admin/donations/FundsListIntro.tsx
export default function FundsListIntro() {
  return (
    <section className="mb-6">
      <div className="mb-2 font-body text-fs-xs font-semibold uppercase tracking-caps text-brand">
        Donations
      </div>
      <h1 className="mb-2 font-display text-[32px] font-medium leading-[1.1] tracking-tight text-fg1">
        Donation funds
      </h1>
      <p className="m-0 max-w-[640px] text-fs-base leading-relaxed text-fg2">
        Categories congregants can give toward — Sadaqah and Zakat are seeded automatically.
        Add your own funds for school, building projects, or anything else specific to your masjid.
      </p>
    </section>
  )
}
```

- [ ] **3.4 — Wire `beforeListTable` component path in `DonationFunds.ts`**

```ts
admin: {
  ...
  components: { beforeListTable: ['/src/admin/donations/FundsListIntro#default'] },
},
```

- [ ] **3.5 — Run tests + design-token grep**

```
pnpm exec vitest run tests/collections/donationFunds.crud.test.ts
grep -nE 'text-\[#|bg-\[#|rounded-lg|shadow-lg|border-gray-|bg-gray-' src/admin/donations/FundsListIntro.tsx && echo "TOKEN VIOLATION" || echo "tokens OK"
```

- [ ] **3.6 — Commit**

```
git add src/admin/donations src/collections/DonationFunds.ts tests/collections/donationFunds.crud.test.ts
git commit -m "feat(donations): funds admin list view + crud"
```

---

## Task 4 — Connect Webhook Skeleton + Signature Verification (Phase 1, parallel track C)

Builds the Connect webhook endpoint with signature verification and a routing skeleton. Concrete event handlers are filled in by Task 7 (which depends on Task 1 schema only, so this task can also run in parallel with Tasks 2 and 3).

**Files:**

- Create: `src/lib/donations-webhook.ts` (pure router: `mapStripeEventToDonationAction(event): DonationAction | null`)
- Create: `src/app/api/stripe/connect/webhook/route.ts`
- Test: `tests/lib/donations-webhook.test.ts`

### Subtasks

- [ ] **4.1 — Failing test for signature rejection**

```ts
// tests/lib/donations-webhook.test.ts
import { describe, it, expect } from 'vitest'
import { POST } from '@/app/api/stripe/connect/webhook/route'

describe('connect webhook', () => {
  it('rejects requests without signature', async () => {
    const req = new Request('http://localhost/api/stripe/connect/webhook', {
      method: 'POST', body: '{}',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
```

- [ ] **4.2 — Implement endpoint with signature verification + ignore-everything skeleton**

```ts
// src/app/api/stripe/connect/webhook/route.ts
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getStripe } from '@/lib/stripe'
import { mapStripeEventToDonationAction } from '@/lib/donations-webhook'
import { applyDonationAction } from '@/lib/donations-apply'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const sig = req.headers.get('stripe-signature')
  const secret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET
  if (!sig || !secret) {
    return NextResponse.json({ error: 'missing signature or secret' }, { status: 400 })
  }
  const raw = await req.text()
  const stripe = getStripe()
  let event
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret)
  } catch (err) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 400 })
  }
  const action = mapStripeEventToDonationAction(event)
  if (!action) return NextResponse.json({ received: true, ignored: event.type })
  const payload = await getPayload({ config })
  await applyDonationAction(payload, action)
  return NextResponse.json({ received: true })
}
```

Stub `donations-webhook.ts` (returns `null` for all events for now) and `donations-apply.ts` (no-op). Task 7 fills these in.

```ts
// src/lib/donations-webhook.ts
import type Stripe from 'stripe'
export type DonationAction = { kind: 'noop' }
export function mapStripeEventToDonationAction(_event: Stripe.Event): DonationAction | null { return null }
```

```ts
// src/lib/donations-apply.ts
import type { Payload } from 'payload'
import type { DonationAction } from './donations-webhook'
export async function applyDonationAction(_payload: Payload, _action: DonationAction): Promise<void> {}
```

- [ ] **4.3 — Verify failing test passes**

```
pnpm exec vitest run tests/lib/donations-webhook.test.ts
```

- [ ] **4.4 — Commit**

```
git add src/lib/donations-webhook.ts src/lib/donations-apply.ts src/app/api/stripe/connect/webhook tests/lib/donations-webhook.test.ts
git commit -m "feat(donations): connect webhook endpoint scaffold + signature verification"
```

---

## Task 5 — Public Donate Page Redesign + Checkout Endpoint (Phase 2, parallel track A)

**Depends on:** Task 1 (schema), Task 2 (`donationConfig.stripeAccountId` populated by OAuth — but the page only requires the field to exist; checkout creation only needs `stripeAccountId`).

**Files:**

- Create: `src/app/api/donations/checkout/route.ts`
- Modify: `src/app/(site)/donate/page.tsx` (add fund/amount/frequency picker when `mode === 'connect' && stripeChargesEnabled`)
- Create: `src/components/DonateForm.tsx` (client component)
- Create: `src/app/(site)/donate/thanks/page.tsx`
- Test: `tests/api/donations-checkout.test.ts`
- Test: `tests/app/donate-page.test.tsx` (smoke render)

### Subtasks

- [ ] **5.1 — Failing test for checkout endpoint**

```ts
// tests/api/donations-checkout.test.ts
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/stripe', () => ({
  getStripe: () => ({
    checkout: { sessions: { create: vi.fn().mockResolvedValue({ id: 'cs_test', url: 'https://checkout.stripe.com/x' }) } },
  }),
}))

// Setup: tenant with stripeAccountId='acct_x', chargesEnabled=true, an active fund.
// POST /api/donations/checkout { fundId, amountCents: 5000, frequency: 'one_time' }
// → 200 { url }, stripe.checkout.sessions.create called with mode='payment', stripeAccount: 'acct_x',
//   metadata { tenantId, fundId, frequency: 'one_time' }, line_items[0].price_data.unit_amount=5000.

// Negative cases:
// - amountCents < 100 → 400
// - fund belongs to a different tenant → 404
// - fund.active === false → 404
// - tenant.stripeChargesEnabled === false → 409
```

Run: `pnpm exec vitest run tests/api/donations-checkout.test.ts` — expect FAIL.

- [ ] **5.2 — Implement checkout endpoint**

```ts
// src/app/api/donations/checkout/route.ts
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { headers } from 'next/headers'
import { getStripe } from '@/lib/stripe'
import { getCurrentTenant } from '@/lib/tenant-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface Body { fundId: string | number; amountCents: number; frequency: 'one_time' | 'monthly' }

export async function POST(req: Request) {
  const tenant = await getCurrentTenant()
  if (!tenant) return NextResponse.json({ error: 'no tenant' }, { status: 404 })
  const dc = (tenant as any).donationConfig ?? {}
  if (dc.mode !== 'connect' || !dc.stripeAccountId || !dc.stripeChargesEnabled) {
    return NextResponse.json({ error: 'donations not enabled' }, { status: 409 })
  }
  let body: Body
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad json' }, { status: 400 }) }
  const { fundId, amountCents, frequency } = body
  if (!fundId || !Number.isInteger(amountCents) || amountCents < 100) {
    return NextResponse.json({ error: 'invalid amount' }, { status: 400 })
  }
  if (frequency !== 'one_time' && frequency !== 'monthly') {
    return NextResponse.json({ error: 'invalid frequency' }, { status: 400 })
  }
  const payload = await getPayload({ config })
  const fund = await payload.findByID({ collection: 'donation-funds', id: fundId, overrideAccess: true }).catch(() => null)
  const fundTenantId = (fund as any)?.tenant?.id ?? (fund as any)?.tenant
  if (!fund || String(fundTenantId) !== String(tenant.id) || !(fund as any).active) {
    return NextResponse.json({ error: 'fund not found' }, { status: 404 })
  }

  const h = await headers()
  const proto = h.get('x-forwarded-proto') ?? 'https'
  const host = h.get('host')
  const origin = `${proto}://${host}`

  const metadata = { tenantId: String(tenant.id), fundId: String(fund.id), frequency }
  const stripe = getStripe()
  const session = await stripe.checkout.sessions.create({
    mode: frequency === 'monthly' ? 'subscription' : 'payment',
    line_items: [{
      price_data: {
        currency: 'usd',
        product_data: { name: `${(tenant as any).name} — ${(fund as any).name}` },
        unit_amount: amountCents,
        ...(frequency === 'monthly' ? { recurring: { interval: 'month' } } : {}),
      } as any,
      quantity: 1,
    }],
    metadata,
    payment_intent_data: frequency === 'one_time' ? { metadata } : undefined,
    subscription_data: frequency === 'monthly' ? { metadata } : undefined,
    success_url: `${origin}/donate/thanks?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/donate`,
  } as any, { stripeAccount: dc.stripeAccountId })

  return NextResponse.json({ url: session.url })
}
```

- [ ] **5.3 — Implement `DonateForm.tsx` (client)**

Mandatory token-only styling. Mirror `donate/page.tsx` patterns:

```tsx
// src/components/DonateForm.tsx
'use client'
import { useState } from 'react'
import { Heart } from 'lucide-react'

export interface DonateFund { id: string | number; name: string; description?: string | null; zakatEligible?: boolean; suggestedAmounts?: { amount: number }[] }

export default function DonateForm({ funds }: { funds: DonateFund[] }) {
  const [fundId, setFundId] = useState<string | number>(funds[0]?.id)
  const fund = funds.find((f) => String(f.id) === String(fundId))
  const [amount, setAmount] = useState<number>(fund?.suggestedAmounts?.[0]?.amount ?? 50)
  const [custom, setCustom] = useState('')
  const [frequency, setFrequency] = useState<'one_time' | 'monthly'>('one_time')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dollars = custom ? Number(custom) : amount

  async function submit() {
    setError(null); setPending(true)
    try {
      const cents = Math.round(dollars * 100)
      const res = await fetch('/api/donations/checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fundId, amountCents: cents, frequency }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'failed')
      window.location.href = data.url
    } catch (e) {
      setError((e as Error).message); setPending(false)
    }
  }

  return (
    <div className="mx-auto max-w-[520px] rounded-[var(--r-md)] border border-border bg-white p-8 shadow-sh-sm">
      <div className="mb-3 font-body text-fs-xs font-semibold uppercase tracking-caps text-fg3">Choose a fund</div>
      <div className="mb-6 grid gap-2">
        {funds.map((f) => (
          <button key={String(f.id)} type="button" onClick={() => setFundId(f.id)}
            className={`flex items-center justify-between rounded-[var(--r-md)] border px-4 py-3 text-left font-body text-fs-base transition-colors ${
              String(fundId) === String(f.id) ? 'border-brand bg-brand-soft text-fg1' : 'border-border bg-white text-fg2 hover:border-border-teal'
            }`}>
            <span className="font-semibold">{f.name}</span>
            {f.zakatEligible && (
              <span className="rounded-pill bg-accent-soft px-3 py-1 font-body text-fs-xs uppercase tracking-caps text-fg1">Zakat</span>
            )}
          </button>
        ))}
      </div>

      <div className="mb-3 font-body text-fs-xs font-semibold uppercase tracking-caps text-fg3">Choose an amount</div>
      <div className="mb-3 grid grid-cols-3 gap-2">
        {(fund?.suggestedAmounts ?? [{ amount: 25 }, { amount: 50 }, { amount: 100 }]).map((a) => (
          <button key={a.amount} type="button" onClick={() => { setAmount(a.amount); setCustom('') }}
            className={`rounded-[var(--r-md)] border px-4 py-3 font-body text-fs-base font-semibold transition-colors ${
              !custom && amount === a.amount ? 'border-brand bg-brand-soft text-fg1' : 'border-border bg-bg-alt text-fg2 hover:border-border-teal'
            }`}>${a.amount}</button>
        ))}
      </div>
      <input type="number" inputMode="decimal" min={1} placeholder="Other amount" value={custom}
        onChange={(e) => setCustom(e.target.value)}
        className="mb-6 w-full rounded-[var(--r-md)] border border-border bg-white px-4 py-3 font-body text-fs-base text-fg1 placeholder:text-fg3 focus:border-brand focus:outline-none" />

      <div className="mb-3 font-body text-fs-xs font-semibold uppercase tracking-caps text-fg3">Frequency</div>
      <div className="mb-6 grid grid-cols-2 gap-2">
        {(['one_time', 'monthly'] as const).map((f) => (
          <button key={f} type="button" onClick={() => setFrequency(f)}
            className={`rounded-[var(--r-md)] border px-4 py-3 font-body text-fs-base font-semibold transition-colors ${
              frequency === f ? 'border-brand bg-brand-soft text-fg1' : 'border-border bg-bg-alt text-fg2 hover:border-border-teal'
            }`}>{f === 'one_time' ? 'One-time' : 'Monthly'}</button>
        ))}
      </div>

      {error && <p className="mb-3 font-body text-fs-sm text-danger">{error}</p>}

      <button type="button" disabled={pending || dollars < 1} onClick={submit}
        className="inline-flex w-full items-center justify-center gap-2 rounded-[var(--r-md)] bg-brand px-6 py-[14px] font-body text-fs-base font-semibold text-white shadow-sh-sm transition-all duration-base ease-out hover:-translate-y-px hover:bg-brand-hover hover:shadow-sh-md disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0">
        <Heart size={18} strokeWidth={1.75} />
        {pending ? 'Redirecting…' : `Give $${(dollars || 0).toFixed(0)} ${frequency === 'monthly' ? '/month' : ''}`}
      </button>
    </div>
  )
}
```

- [ ] **5.4 — Update `donate/page.tsx`**

Replace the disabled stripe panel branch with `<DonateForm funds={funds} />` when `mode === 'connect' && stripeChargesEnabled`. Fetch funds via `payload.find({ collection: 'donation-funds', where: { tenant: { equals: tenant.id }, active: { equals: true } }, sort: 'sortOrder' })`.

- [ ] **5.5 — Implement `donate/thanks/page.tsx`**

Branded thank-you page (token-compliant). No donor data. Single section with eyebrow / display headline / supporting copy / link back to home.

- [ ] **5.6 — Run tests + token grep**

```
pnpm exec vitest run tests/api/donations-checkout.test.ts tests/app/donate-page.test.tsx
grep -nE 'text-\[#|bg-\[#|rounded-lg|shadow-lg|border-gray-|bg-gray-' src/components/DonateForm.tsx src/app/\(site\)/donate/page.tsx src/app/\(site\)/donate/thanks/page.tsx && echo "TOKEN VIOLATION" || echo "tokens OK"
```

- [ ] **5.7 — Commit**

```
git add src/app/api/donations src/app/\(site\)/donate src/components/DonateForm.tsx tests/api/donations-checkout.test.ts tests/app/donate-page.test.tsx
git commit -m "feat(donations): public donate page redesign + checkout endpoint"
```

---

## Task 6 — Connect Page (admin) + Disconnect UI (Phase 2, parallel track B)

**Depends on:** Task 2 (OAuth endpoints exist).

**Files:**

- Create: `src/app/(payload)/admin/donations/connect/page.tsx`
- Create: `src/app/(payload)/admin/donations/connect/ConnectClient.tsx`
- Create: `src/admin/donations/DonationsNav.tsx` (Payload custom nav links)
- Test: `tests/app/admin-connect-page.test.tsx`

### Subtasks

- [ ] **6.1 — Failing render test** for the page (renders "Connect Stripe" button when no `stripeAccountId`; renders "Disconnect" + status when present).
- [ ] **6.2 — Implement page** (server component pulls tenant; passes to client).
- [ ] **6.3 — Implement `ConnectClient.tsx`**

Token-compliant. Two states:

- **Not connected:** eyebrow `tracking-caps text-brand`, `font-display` headline "Accept donations on your site", body copy `text-fg2`, primary button `bg-brand` link to `/api/stripe/connect/authorize` (`<a>` not `<button>`).
- **Connected:** card with status row showing `acct_•••` masked, two checkboxes (charges enabled, payouts enabled — render as green check / amber dot pills using `bg-success-soft` / `bg-accent-soft` tokens), "Open Stripe Dashboard" external link to `https://dashboard.stripe.com/<acct>/payments`, and a "Disconnect" button that POSTs to `/api/stripe/connect/disconnect` (with confirm dialog).

- [ ] **6.4 — Token grep + tests**

```
pnpm exec vitest run tests/app/admin-connect-page.test.tsx
grep -nE 'text-\[#|bg-\[#|rounded-lg|shadow-lg|border-gray-|bg-gray-' src/app/\(payload\)/admin/donations/connect/ConnectClient.tsx src/admin/donations/DonationsNav.tsx
```

- [ ] **6.5 — Commit**

```
git add src/app/\(payload\)/admin/donations src/admin/donations tests/app/admin-connect-page.test.tsx
git commit -m "feat(donations): admin connect page (status/connect/disconnect)"
```

---

## Task 7 — Connect Webhook Event Handlers (Phase 2, parallel track C)

**Depends on:** Task 1 (donations collection), Task 4 (webhook scaffold).

**Files:**

- Modify: `src/lib/donations-webhook.ts` (real `mapStripeEventToDonationAction`)
- Modify: `src/lib/donations-apply.ts` (real `applyDonationAction`)
- Test: `tests/lib/donations-webhook.test.ts` (replace skeleton with real cases)
- Test: `tests/lib/donations-apply.test.ts`

### Subtasks

- [ ] **7.1 — Define `DonationAction` shape**

```ts
export type DonationAction =
  | { kind: 'recordDonation'; tenantId: string; fundId: string; frequency: 'one_time' | 'monthly';
      amountCents: number; currency: string; status: 'succeeded';
      stripePaymentIntentId: string; stripeChargeId?: string;
      stripeSubscriptionId?: string; stripeAccountId: string }
  | { kind: 'refundDonation'; stripeChargeId: string }
  | { kind: 'syncAccount'; stripeAccountId: string; chargesEnabled: boolean; payoutsEnabled: boolean }
```

- [ ] **7.2 — Failing tests for each event type**

Cases (use fixtures inspired by `tests/lib/billing-webhook.test.ts`):

- `checkout.session.completed` (one_time): produces `recordDonation` action with metadata round-tripped, `frequency: 'one_time'`, `stripePaymentIntentId` from session.
- `checkout.session.completed` (subscription): same but `frequency: 'monthly'`, `stripeSubscriptionId` populated.
- `invoice.payment_succeeded`: subscription renewal — produces `recordDonation` with `frequency: 'monthly'`. Resolve `tenantId`/`fundId` from `subscription.metadata` (fetch via injected stripe client).

  **Note:** `event.data.object` is the invoice, which references `subscription` by id. Webhook handler must call `stripe.subscriptions.retrieve(id, { stripeAccount: event.account })` to read metadata, OR rely on Stripe expanding the subscription. Spec uses metadata duplicated onto the subscription at creation time (`subscription_data.metadata` in Task 5.2), so the metadata is available on the subscription object directly. The mapper accepts an optional `subscriptionResolver` parameter for testability.
- `charge.refunded`: produces `refundDonation` keyed by charge id.
- `account.updated`: produces `syncAccount`.
- Other event types: returns `null`.

- [ ] **7.3 — Implement mapper**

Pure function. Branch on `event.type`. For `invoice.payment_succeeded`, accept an injected resolver:

```ts
export async function mapStripeEventToDonationAction(
  event: Stripe.Event,
  resolveSubscriptionMetadata?: (subId: string, acctId: string) => Promise<Record<string, string>>,
): Promise<DonationAction | null> { /* ... */ }
```

For tests, pass a stub resolver. The route passes a real one that calls `stripe.subscriptions.retrieve`.

- [ ] **7.4 — Implement `applyDonationAction`**

```ts
// src/lib/donations-apply.ts
import type { Payload } from 'payload'
import type { DonationAction } from './donations-webhook'

export async function applyDonationAction(payload: Payload, action: DonationAction): Promise<void> {
  switch (action.kind) {
    case 'recordDonation': {
      // Idempotent insert keyed by stripePaymentIntentId.
      const existing = await payload.find({
        collection: 'donations',
        where: { stripePaymentIntentId: { equals: action.stripePaymentIntentId } },
        limit: 1, overrideAccess: true,
      })
      if (existing.docs.length > 0) return
      await payload.create({
        collection: 'donations',
        data: {
          tenant: action.tenantId, fund: action.fundId,
          amount: action.amountCents, currency: action.currency,
          frequency: action.frequency, status: 'succeeded',
          stripePaymentIntentId: action.stripePaymentIntentId,
          stripeChargeId: action.stripeChargeId, stripeSubscriptionId: action.stripeSubscriptionId,
          stripeAccountId: action.stripeAccountId,
        },
        overrideAccess: true,
      })
      return
    }
    case 'refundDonation': {
      const found = await payload.find({
        collection: 'donations',
        where: { stripeChargeId: { equals: action.stripeChargeId } },
        limit: 1, overrideAccess: true,
      })
      const doc = found.docs[0]
      if (!doc) return
      await payload.update({ collection: 'donations', id: doc.id, data: { status: 'refunded' }, overrideAccess: true })
      return
    }
    case 'syncAccount': {
      const found = await payload.find({
        collection: 'tenants',
        where: { 'donationConfig.stripeAccountId': { equals: action.stripeAccountId } },
        limit: 1, overrideAccess: true,
      })
      const tenant = found.docs[0]
      if (!tenant) return
      await payload.update({
        collection: 'tenants', id: (tenant as any).id, overrideAccess: true,
        data: {
          donationConfig: {
            stripeChargesEnabled: action.chargesEnabled,
            stripePayoutsEnabled: action.payoutsEnabled,
            stripeAccountLastSyncedAt: new Date().toISOString(),
          },
        },
      })
      return
    }
  }
}
```

- [ ] **7.5 — Update route to pass real resolver + await async mapper**

In `src/app/api/stripe/connect/webhook/route.ts`, change `mapStripeEventToDonationAction` call to await it and pass `(subId, acctId) => stripe.subscriptions.retrieve(subId, { stripeAccount: acctId }).then((s) => s.metadata as any)`.

- [ ] **7.6 — Run tests**

```
pnpm exec vitest run tests/lib/donations-webhook.test.ts tests/lib/donations-apply.test.ts
```

- [ ] **7.7 — Commit**

```
git add src/lib/donations-webhook.ts src/lib/donations-apply.ts src/app/api/stripe/connect/webhook tests/lib/donations-webhook.test.ts tests/lib/donations-apply.test.ts
git commit -m "feat(donations): webhook event handlers (record/refund/account.updated/subscription renewal)"
```

---

## Task 8 — Donations Dashboard (Phase 3, parallel track A)

**Depends on:** Task 1 (donations collection).

**Files:**

- Create: `src/app/(payload)/admin/donations/overview/page.tsx`
- Create: `src/app/(payload)/admin/donations/overview/OverviewClient.tsx`
- Create: `src/lib/donations-aggregates.ts` (pure aggregation functions, unit-testable)
- Create: `src/app/api/donations/export.csv/route.ts` (CSV export)
- Test: `tests/lib/donations-aggregates.test.ts`
- Test: `tests/api/donations-export.test.ts`

### Subtasks

- [ ] **8.1 — Failing tests for aggregate helpers**

```ts
// tests/lib/donations-aggregates.test.ts
import { computeAggregates } from '@/lib/donations-aggregates'
// Inputs: array of donation rows + month-anchor date.
// Outputs: { thisMonthCents, ytdCents, count, avgCents, monthlyDonorCount, byFund: [{ fundId, fundName, thisMonthCount, thisMonthCents, ytdCents }] }
```

Cover: refunded rows excluded from totals, monthly donor count = distinct `stripeSubscriptionId` with at least one succeeded row in the last 30 days, by-fund grouping.

- [ ] **8.2 — Implement `donations-aggregates.ts`** (pure functions over an array of rows).
- [ ] **8.3 — Implement overview page** (server component fetches rows for current tenant, calls aggregates, renders cards + table).
- [ ] **8.4 — Implement `OverviewClient.tsx`** with token-compliant cards/table.

Card pattern (mirror `donate/page.tsx` card styling):

```tsx
<div className="rounded-[var(--r-md)] border border-border bg-white p-6 shadow-sh-sm">
  <div className="mb-2 font-body text-fs-xs font-semibold uppercase tracking-caps text-fg3">This month</div>
  <div className="font-display text-[40px] font-medium leading-[1.05] text-fg1">${(thisMonthCents/100).toLocaleString()}</div>
</div>
```

Recent activity feed: each row is a card-like row with `border-border` divider; "View in Stripe" link uses `text-secondary hover:text-secondary-hover underline-offset-2 hover:underline` and opens `https://dashboard.stripe.com/<acct>/payments/<pi>` in new tab.

- [ ] **8.5 — Implement CSV export endpoint** (tenant-scoped, no PII columns).
- [ ] **8.6 — Token grep + run tests**

```
pnpm exec vitest run tests/lib/donations-aggregates.test.ts tests/api/donations-export.test.ts
grep -nE 'text-\[#|bg-\[#|rounded-lg|shadow-lg|border-gray-|bg-gray-' src/app/\(payload\)/admin/donations/overview/OverviewClient.tsx
```

- [ ] **8.7 — Commit**

```
git add src/lib/donations-aggregates.ts src/app/\(payload\)/admin/donations/overview src/app/api/donations/export.csv tests/lib/donations-aggregates.test.ts tests/api/donations-export.test.ts
git commit -m "feat(donations): tenant overview dashboard + csv export"
```

---

## Task 9 — Wizard Step Wiring (Phase 3, parallel track B)

**Depends on:** Task 2 (authorize endpoint exists).

**Files:**

- Modify: `src/admin/onboarding/MilestoneTile.tsx` or `MilestonePanel.tsx` for the `donations` milestone — repoint primary CTA to `/api/stripe/connect/authorize`.
- Verify the existing milestone `donations` already exists in `src/lib/onboardingHints.ts` (per the Tenants schema it does — value `donations` in the onboarding group).
- Test: `tests/admin/onboarding-donations-tile.test.tsx`

### Subtasks

- [ ] **9.1 — Read the milestone tile / panel to identify the donations slot.**
- [ ] **9.2 — Failing test:** rendering the donations milestone shows three actions: "Connect Stripe" (anchor to `/api/stripe/connect/authorize`), "Use external link" (links to tenant settings donate tab), "Skip for now" (POST that marks milestone `dismissed`).
- [ ] **9.3 — Implement** the panel update. Token-compliant. Mirror the visual pattern of existing milestone tiles.
- [ ] **9.4 — Token grep + tests**

```
pnpm exec vitest run tests/admin/onboarding-donations-tile.test.tsx
grep -nE 'text-\[#|bg-\[#|rounded-lg|shadow-lg|border-gray-|bg-gray-' src/admin/onboarding/MilestoneTile.tsx src/admin/onboarding/MilestonePanel.tsx
```

- [ ] **9.5 — Commit**

```
git add src/admin/onboarding tests/admin/onboarding-donations-tile.test.tsx
git commit -m "feat(donations): wizard donations milestone wired to connect oauth"
```

---

## Task 10 — Integration Verification (Phase 4, sequential)

End-to-end manual + automated verification. Run after all parallel work merges.

### Subtasks

- [ ] **10.1 — Full test run**

```
pnpm exec vitest run
pnpm exec tsc --noEmit
pnpm build
```

All green, zero TS errors, build succeeds.

- [ ] **10.2 — Token violation sweep across every file touched in this plan**

```
grep -rnE 'text-\[#|bg-\[#|rounded-lg|shadow-lg|border-gray-|bg-gray-' \
  src/components/DonateForm.tsx \
  src/app/\(site\)/donate \
  src/app/\(payload\)/admin/donations \
  src/admin/donations \
  src/admin/onboarding/MilestonePanel.tsx \
  src/admin/onboarding/MilestoneTile.tsx
```

Expected: no matches.

- [ ] **10.3 — Manual Stripe test-mode walkthrough** (documented in spec § "Setup"):

  - Set env: `STRIPE_CONNECT_CLIENT_ID`, `STRIPE_CONNECT_WEBHOOK_SECRET` (from `stripe listen --forward-connect-to localhost:3000/api/stripe/connect/webhook`).
  - Sign in as a tenant admin; go to wizard donations milestone; click Connect Stripe; complete OAuth on Stripe with "Skip this account form".
  - Land back on `/admin/donations/connect?status=success` with charges/payouts pills green.
  - Visit public `/donate`; pick Sadaqah, $50, one-time; complete checkout with `4242 4242 4242 4242`.
  - Land on `/donate/thanks`; verify `donations` row appears in admin overview within ~2 seconds.
  - Trigger a refund via the connected account dashboard; verify row flips to `refunded`.
  - Make a $10/month subscription; let Stripe CLI advance the clock or simulate via `stripe trigger invoice.payment_succeeded` against the connected account; verify a new succeeded row appears.

- [ ] **10.4 — Push branch and open draft PR**

```
git push -u origin feat/tenant-stripe-connect-donations
gh pr create --draft --title "feat: tenant stripe connect + donation funds" --body "..."
```

PR body summarizes what shipped, links the spec, and lists the manual verification steps from 10.3 as the test plan checklist.

---

## Spec Coverage Self-Review

| Spec section | Implementing task(s) |
|---|---|
| § Architecture — Standard / direct charges / no app fee | Task 5 (no `application_fee_amount` in `sessions.create`) |
| § Data Model — `donationFunds` collection | Task 1 |
| § Data Model — `donations` collection (no PII) | Task 1 |
| § Data Model — tenant field changes | Task 1 |
| § Data Model — seed Sadaqah + Zakat | Task 1.7 |
| § Stripe Connect Onboarding — OAuth | Task 2 |
| § Stripe Connect Onboarding — Disconnect | Task 2 |
| § Stripe Connect Onboarding — Capability sync | Task 7 (`account.updated`) |
| § Donor Checkout Flow | Task 5 |
| § Webhooks — five event types | Tasks 4 (scaffold) + 7 (handlers) |
| § Webhooks — idempotency by PI | Task 7.4 + Task 1 unique index |
| § Admin UI — Wizard step | Task 9 |
| § Admin UI — Overview / Funds / Connect | Tasks 8 / 3 / 6 |
| § Access Control | Tasks 1 + 2 + 5 + 8 (each access boundary covered by a test) |
| § Configuration — env vars | Task 2 + Task 4 |
| § Testing | Each task ships its own test files |

No spec gaps. Plan is ready to execute.

---

## Execution Notes for Subagent Dispatcher

When dispatching subagents:

- **Phase 0 (Task 1)** — single subagent. Wait for completion + review before Phase 1.
- **Phase 1 (Tasks 2, 3, 4)** — three parallel subagents. They touch disjoint files but all read the schema from Task 1.
- **Phase 2 (Tasks 5, 6, 7)** — three parallel subagents. Task 5 needs the schema; Task 6 needs Task 2's endpoints; Task 7 needs Task 4's scaffold + Task 1's schema.
- **Phase 3 (Tasks 8, 9)** — two parallel subagents.
- **Phase 4 (Task 10)** — single subagent (or do this yourself — manual steps).

Each subagent receives:

1. The full path to this plan.
2. Their task number.
3. The mandatory design-system block (verbatim).
4. The instruction to run the token grep before committing.
5. The instruction to TDD: write the failing test, see it fail, implement, see it pass, commit.
