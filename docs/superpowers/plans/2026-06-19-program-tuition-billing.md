# Recurring Program Tuition: Family Subscriptions, Per-Class Pricing & Sibling Discounts — Implementation Plan (Phase 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make program registration **paid** — per-program or per-class pricing, with payment model `free | one-time | monthly recurring`. A family pays **one monthly subscription** (one Stripe customer per guardian email, one line item per child) with an **automatic percentage sibling discount** baked into the per-child amounts, and **handed-out Stripe promotion codes** that stack on top. Students + a family/tuition record are created by the payment **webhook**.

**Architecture:** Runs on the **Stripe Connect** layer (per-tenant connected account), mirroring the membership flow (`membership-checkout.ts` / `membership-webhook.ts` / `membership-stripe.ts`, all using `{ stripeAccount }`). Subscription-mode Checkout requires recurring **price ids**, so per-child discounted amounts are realized by creating per-child recurring Prices on the connected account, then one subscription Checkout Session with one line item each + an explicit guardian-email Customer + `allow_promotion_codes`. Discount math and the session-args builder are **pure** (unit-tested per repo convention). Student creation is **deferred to the webhook** for paid programs (free programs still create at submit, via Phase 2).

**Tech Stack:** Next.js, Payload 3, Stripe (Connect, API `2025-02-24.acacia`), vitest.

**Branch:** `feat/registration-details-on-student` (PR #140).

**Depends on:** Phase 2 (repeatable participant sections + `materializeStudentsFromSubmission`).

**Fidelity note:** Pricing data, discount math, the checkout-args builder, and the webhook handler get full TDD code (pure; the repo tests Stripe logic this way, including security cases). The Stripe SDK calls (customer/price/session creation) and the route wiring are thin integration shells specified by exact files + the calls to make.

**Security (must follow):** Stripe Connect webhooks attribute by `event.account` → tenant via `tenantIdForConnectedAccount` and require `metadata.tenantId` to match (CWE-639 guidance in `src/lib/stripe-connect-binding.ts`). The tuition handler does the same. All Stripe calls pass `{ stripeAccount: connectedAccountId(tenant) }` via `getStripeForTenant(tenant)`.

---

## File structure

- **Modify** `src/collections/Terms.ts` — `pricingModel` (`per-program`|`per-class`), `tuitionCents` (per-program).
- **Modify** `src/collections/SchoolClasses.ts` — `tuitionCents` (per-class).
- **Modify** `src/collections/Forms.ts` — `payment.paymentModel` (`free`|`one-time`|`monthly`); discount tiers (`multiChildDiscount`).
- **Create** `src/lib/tuition-pricing.ts` — pure: `participantPricesCents`, `computeSiblingDiscount`.
- **Create** `src/lib/tuition-checkout.ts` — pure: `buildTuitionLineItems`; Stripe shell `createTuitionCheckout`.
- **Create** `src/lib/tuition-webhook.ts` — `handleTuitionEvent`.
- **Modify** `src/app/api/stripe/connect/webhook/route.ts` — add `handleTuitionEvent` to the parallel dispatch.
- **Create** `src/collections/ProgramSubscriptions.ts` — the family/tuition record (mirrors `Members`).
- **Modify** `src/collections/Students.ts` — `programSubscription` relationship.
- **Modify** `src/hooks/createStudentFromRegistration.ts` — skip student creation when payment pending; extract `materializeStudentsFromSubmission`.
- **Create** `src/app/api/programs/register/checkout/route.ts` (or extend the form submit path) — start the paid checkout.
- **Modify** `src/app/(forms)/forms/[slug]/PublicFormClient.tsx` — redirect to checkout for paid programs (one-time path already exists).
- **Migration** for new columns + the new collection.
- **Tests** under `tests/lib/`.

---

## Task 1: Pricing data model

**Files:** Modify `src/collections/Terms.ts`, `src/collections/SchoolClasses.ts`, `src/collections/Forms.ts`; generate migration.

- [ ] **Step 1: Terms** — add:

```ts
{ name: 'pricingModel', type: 'select', defaultValue: 'per-program',
  options: [ { label: 'Per program (one price)', value: 'per-program' }, { label: 'Per class', value: 'per-class' } ] },
{ name: 'tuitionCents', type: 'number', min: 0, admin: { description: 'Monthly price for the whole program (per-program pricing).', condition: (_, sib) => sib?.pricingModel === 'per-program' } },
```

- [ ] **Step 2: SchoolClasses** — add `{ name: 'tuitionCents', type: 'number', min: 0, admin: { description: 'Monthly price for this class (per-class pricing).' } }`.

- [ ] **Step 3: Forms `payment` group** — add a `paymentModel` and discount tiers:

```ts
{ name: 'paymentModel', type: 'select', defaultValue: 'free',
  options: [ { label: 'Free', value: 'free' }, { label: 'One-time', value: 'one-time' }, { label: 'Monthly recurring', value: 'monthly' } ] },
{ name: 'multiChildDiscount', type: 'array', labels: { singular: 'Discount tier', plural: 'Discount tiers' },
  admin: { description: 'Percentage off by child rank. e.g. rank 2 = 25 (2nd child 25% off).' },
  fields: [ { name: 'rank', type: 'number', required: true, min: 2 }, { name: 'percentOff', type: 'number', required: true, min: 0, max: 100 } ] },
```

- [ ] **Step 4:** `npm run generate:types`; `npx payload migrate:create program_tuition_pricing`; verify the generated SQL adds the columns (+ enum). `npx tsc --noEmit`.

- [ ] **Step 5: Commit**

```bash
git add src/collections/Terms.ts src/collections/SchoolClasses.ts src/collections/Forms.ts src/migrations/* src/payload-types.ts
git commit -m "feat(school): pricing model + tuition prices + payment model + discount tiers"
```

---

## Task 2: Discount math (pure, TDD)

**Files:** Create `src/lib/tuition-pricing.ts`; Test `tests/lib/tuition-pricing.test.ts`.

Rule: rank participants by price **descending**; the most expensive pays full; configured `percentOff` tiers apply to subsequent ranks (rank 2 = 2nd-most-expensive, etc.). Discount scope is one program.

- [ ] **Step 1: Failing tests**

```ts
import { describe, it, expect } from 'vitest'
import { computeSiblingDiscount } from '@/lib/tuition-pricing'

const tiers = [{ rank: 2, percentOff: 50 }, { rank: 3, percentOff: 100 }]

describe('computeSiblingDiscount', () => {
  it('charges the most expensive full, discounts the rest by rank', () => {
    // prices 10000, 8000, 6000 → ranks 1,2,3 → 10000, 4000, 0
    expect(computeSiblingDiscount([8000, 10000, 6000], tiers)).toEqual([10000, 4000, 0])
  })
  it('per-program (equal prices) — 2nd child half off', () => {
    expect(computeSiblingDiscount([5000, 5000], [{ rank: 2, percentOff: 50 }])).toEqual([5000, 2500])
  })
  it('no tiers → no discount', () => {
    expect(computeSiblingDiscount([5000, 5000], [])).toEqual([5000, 5000])
  })
  it('single child → full price', () => {
    expect(computeSiblingDiscount([5000], tiers)).toEqual([5000])
  })
})
```

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement `src/lib/tuition-pricing.ts`**

```ts
export interface DiscountTier { rank: number; percentOff: number }

/**
 * Returns discounted cents per input price, preserving input order.
 * Ranking is by price descending (most expensive = rank 1, pays full).
 */
export function computeSiblingDiscount(pricesCents: number[], tiers: DiscountTier[]): number[] {
  const byRank = new Map<number, number>()
  for (const t of tiers) byRank.set(t.rank, t.percentOff)
  // index sorted by price desc, ties keep original order
  const order = pricesCents.map((p, i) => ({ p, i })).sort((a, b) => b.p - a.p || a.i - b.i)
  const out = new Array<number>(pricesCents.length)
  order.forEach((entry, idx) => {
    const rank = idx + 1
    const pct = byRank.get(rank) ?? 0
    out[entry.i] = Math.round(entry.p * (1 - Math.min(Math.max(pct, 0), 100) / 100))
  })
  return out
}
```

- [ ] **Step 4: Run — PASS. Commit.**

```bash
git add src/lib/tuition-pricing.ts tests/lib/tuition-pricing.test.ts
git commit -m "feat(school): sibling discount computation (rank-based percentage)"
```

---

## Task 3: Resolve participant prices (pure, TDD)

**Files:** add `participantPricesCents` to `src/lib/tuition-pricing.ts`; extend the test.

- [ ] **Step 1:** Test: per-program → every participant gets `programTuitionCents`; per-class → each participant gets their selected class's `tuitionCents` (looked up from a `classId → cents` map; participant carries `class` selection from the priced field).

```ts
import { participantPricesCents } from '@/lib/tuition-pricing'

it('per-program: all participants pay the program price', () => {
  expect(participantPricesCents(
    [{}, {}], { pricingModel: 'per-program', programTuitionCents: 5000, classPrices: {} },
  )).toEqual([5000, 5000])
})
it('per-class: each participant pays their class price', () => {
  expect(participantPricesCents(
    [{ class: '3' }, { class: '8' }], { pricingModel: 'per-class', programTuitionCents: 0, classPrices: { '3': 9000, '8': 6000 } },
  )).toEqual([9000, 6000])
})
```

- [ ] **Step 2:** Implement:

```ts
export interface PricingContext { pricingModel: 'per-program' | 'per-class'; programTuitionCents: number; classPrices: Record<string, number> }
export function participantPricesCents(participants: Record<string, unknown>[], ctx: PricingContext): number[] {
  return participants.map((p) =>
    ctx.pricingModel === 'per-class' ? (ctx.classPrices[String(p.class)] ?? 0) : ctx.programTuitionCents)
}
```

- [ ] **Step 3:** Run PASS; commit `feat(school): resolve per-participant tuition prices`.

---

## Task 4: Tuition checkout — line items builder (pure) + Stripe shell

**Files:** Create `src/lib/tuition-checkout.ts`; Test `tests/lib/tuition-checkout.test.ts`.

- [ ] **Step 1: Pure builder test**

```ts
import { describe, it, expect } from 'vitest'
import { buildTuitionLineItems } from '@/lib/tuition-checkout'

it('builds one line item per participant at the discounted amount with monthly recurring price_data', () => {
  const items = buildTuitionLineItems([10000, 4000], 'usd', 'Sunday School')
  expect(items).toHaveLength(2)
  expect(items[0]).toMatchObject({
    price_data: { currency: 'usd', unit_amount: 10000, recurring: { interval: 'month' }, product_data: { name: expect.stringContaining('Sunday School') } },
    quantity: 1,
  })
  expect(items[1].price_data.unit_amount).toBe(4000)
})
```

- [ ] **Step 2: Implement the pure builder** (note: inline `price_data.recurring` is valid for `stripe.subscriptions.create`; for **Checkout subscription mode** we instead pre-create Prices — see Step 3. We expose the builder shape so both paths share amounts.)

```ts
import type Stripe from 'stripe'
export function buildTuitionLineItems(discountedCents: number[], currency: string, programName: string): Stripe.SubscriptionCreateParams.Item[] {
  return discountedCents.map((amount, i) => ({
    price_data: { currency, unit_amount: amount, recurring: { interval: 'month' }, product_data: { name: `${programName} — child ${i + 1}` } },
    quantity: 1,
  })) as unknown as Stripe.SubscriptionCreateParams.Item[]
}
```

- [ ] **Step 3: Stripe integration shell `createTuitionCheckout`** in the same file (not unit-tested; thin wrapper, mirrors `membership-checkout.ts` + `membership-stripe.ts`). Responsibilities (document each as a code comment + call):
  1. `const stripe = getStripeForTenant(tenant)`, `const account = connectedAccountId(tenant)`.
  2. **Customer per guardian email:** `const found = await stripe.customers.list({ email, limit: 1 }, { stripeAccount: account })`; reuse `found.data[0]` or `stripe.customers.create({ email, name }, { stripeAccount: account })`.
  3. **Per-child recurring Prices** (Checkout subscription mode needs price ids): for each discounted amount, `stripe.prices.create({ currency, unit_amount, recurring: { interval: 'month' }, product_data: { name: '<program> — child N' } }, { stripeAccount: account })`; collect `price.id`.
  4. `stripe.checkout.sessions.create({ mode: 'subscription', customer: customerId, line_items: priceIds.map(price => ({ price, quantity: 1 })), allow_promotion_codes: true, success_url, cancel_url, metadata: { kind: 'tuition', tenantId, submissionId, programId }, subscription_data: { metadata: { kind: 'tuition', tenantId, submissionId, programId } } }, { stripeAccount: account })`.
  5. Return `session.url`.

  (Amounts come from Tasks 2-3; metadata carries `submissionId` so the webhook can materialize students. `allow_promotion_codes: true` lets handed-out codes stack on the pre-discounted amounts.)

- [ ] **Step 4:** `npx vitest run tests/lib/tuition-checkout.test.ts` PASS; `npx tsc --noEmit`. Commit `feat(school): tuition subscription checkout (line items + Connect session)`.

---

## Task 5: Family/tuition record collection + student link

**Files:** Create `src/collections/ProgramSubscriptions.ts`; modify `src/collections/Students.ts`; register the collection in `src/payload.config.ts`; migration.

- [ ] **Step 1:** Create `ProgramSubscriptions` mirroring `Members` (create/delete `() => false`; webhook writes via `overrideAccess`): fields `tenant` (rel, indexed), `guardianEmail` (text, indexed), `program` (rel→terms), `stripeCustomerId`, `stripeSubscriptionId`, `stripeSubscriptionStatus`, `status` (active/past_due/canceled), `currentPeriodEnd`, `createdAt`. Unique-ish index `(tenant, stripeSubscriptionId)`.
- [ ] **Step 2:** `Students` — add `{ name: 'programSubscription', type: 'relationship', relationTo: 'program-subscriptions', admin: { readOnly: true, description: 'Family tuition subscription this student was registered under.' } }`.
- [ ] **Step 3:** Register in `payload.config.ts` collections array. `npm run generate:types`; `npx payload migrate:create program_subscriptions`. `npx tsc --noEmit`.
- [ ] **Step 4: Commit** `feat(school): program-subscriptions collection + student link`.

---

## Task 6: Defer student creation for paid programs (refactor + extract)

**Files:** Modify `src/hooks/createStudentFromRegistration.ts`; export `materializeStudentsFromSubmission`.

- [ ] **Step 1:** Extract the Phase-2 student-creation body into an exported async `materializeStudentsFromSubmission(payload, submission, opts?)` that creates the N students (+ auto-enroll/default-class) and optionally links them to a `programSubscriptionId`. Returns the created student ids.
- [ ] **Step 2:** In the `createStudentFromRegistration` afterChange hook, after confirming `schoolRegistration`, branch on the form's `payment.paymentModel`:
  - `free` → call `materializeStudentsFromSubmission` now (current behavior).
  - `one-time` | `monthly` → **do not** create students here (payment pending); return. (Students are created by the payment webhook in Task 7.)
- [ ] **Step 3:** Tests: keep `tests/hooks/createStudentFromRegistration.test.ts`; add a case asserting that with `paymentModel: 'monthly'` the hook does **not** call `payload.create` for students. (Mock payload like `tests/lib/membership-webhook.test.ts`.) Run.
- [ ] **Step 4: Commit** `refactor(school): defer student creation to payment webhook for paid programs`.

---

## Task 7: Tuition webhook handler

**Files:** Create `src/lib/tuition-webhook.ts`; modify `src/app/api/stripe/connect/webhook/route.ts`; Test `tests/lib/tuition-webhook.test.ts`.

Mirror `handleMembershipEvent` exactly, including the **security binding** and idempotency.

- [ ] **Step 1: Failing tests** (mirror `tests/lib/membership-webhook.test.ts` `makePayload` mock; assert security + creation):

```ts
import { describe, it, expect, vi } from 'vitest'
import { handleTuitionEvent } from '@/lib/tuition-webhook'
// ... build a checkout.session.completed event with metadata { kind:'tuition', tenantId:'1', submissionId:'9', programId:'7' }, account 'acct_x'
// makePayload: find tenants by donationConfig.stripeAccountId → tenant 1; findByID form-submissions → a submission with participants

it('ignores non-tuition events', async () => { /* metadata.kind !== 'tuition' → no writes */ })
it('rejects when event.account maps to a different tenant than metadata.tenantId', async () => { /* no writes */ })
it('creates a program-subscription and materializes students on checkout.session.completed', async () => {
  // expect payload.create called with collection 'program-subscriptions' (overrideAccess)
  // expect students materialized (spy on materializeStudentsFromSubmission or on payload.create 'students')
})
it('is idempotent on duplicate events (existing subscription id → no duplicate students)', async () => { /* ... */ })
```

- [ ] **Step 2: Implement `handleTuitionEvent(event, payload)`** following `membership-webhook.ts`:
  1. Switch on `event.type`; handle `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`. Ignore others.
  2. `const md = session.metadata; if (md?.kind !== 'tuition') return`.
  3. **Bind:** `const tenantId = await tenantIdForConnectedAccount(payload, event.account)`; require `String(tenantId) === md.tenantId` (else return — log a security warning).
  4. Idempotency: `payload.find({ collection: 'program-subscriptions', where: { stripeSubscriptionId: { equals: session.subscription } } })`; if exists, update status only and return.
  5. Create the `program-subscriptions` row (guardianEmail from session customer email, stripeCustomerId, stripeSubscriptionId, status from `bucketFromStripeStatus`, currentPeriodEnd, program).
  6. `await materializeStudentsFromSubmission(payload, submission, { programSubscriptionId })` using `md.submissionId` (loaded via `findByID`, `overrideAccess`).
  7. `customer.subscription.updated/deleted` → update the subscription row status/currentPeriodEnd/canceledAt (no student changes — enrollment changes are manual per spec).

- [ ] **Step 3: Register the handler** in `src/app/api/stripe/connect/webhook/route.ts` dispatch (add `handleTuitionEvent(event, payload)` to the existing parallel `Promise.all([...])`).

- [ ] **Step 4:** Run tests PASS; `npx tsc --noEmit`. Commit `feat(school): tuition webhook — create family subscription + students on payment`.

---

## Task 8: Wire registration → checkout

**Files:** Modify the submit path (`src/app/api/forms/[slug]/submit/route.ts` or a new `src/app/api/programs/register/checkout/route.ts`); `src/app/(forms)/forms/[slug]/PublicFormClient.tsx`.

- [ ] **Step 1:** On submit of a registration form (submission persisted as today), branch on `payment.paymentModel`:
  - `free` → return success (Phase 2 hook created students).
  - `one-time` → compute total via `participantPricesCents` + `computeSiblingDiscount` (sum), reuse the existing `createFormCheckoutSession` (`mode: 'payment'`, inline `price_data`) with the discounted total; return `checkoutUrl`.
  - `monthly` → resolve `PricingContext` (program `tuitionCents` / `pricingModel`; per-class prices from the program's classes), compute discounted per-child amounts, call `createTuitionCheckout(...)` (Task 4) with the guardian email + `submissionId` metadata; return `checkoutUrl`.
- [ ] **Step 2:** `PublicFormClient` already redirects to `checkoutUrl` when present (one-time path) — confirm it triggers for the `monthly` response too (same `j.checkoutUrl` handling). Show per-child line items + the computed discount + total on the review step (read amounts from a lightweight pricing-preview endpoint or compute client-side from the form's published prices).
- [ ] **Step 3:** Manual end-to-end (Stripe test mode / demo tenant): register a family of 2 in a monthly per-class program → Stripe subscription checkout shows two line items (2nd discounted) + promo-code box → on test payment, the webhook creates 2 students + a program-subscription; students appear in the Enrollment hub (or auto-enrolled if single class). Verify a promo code stacks on the discounted amounts.
- [ ] **Step 4: Commit** `feat(school): registration checkout — free / one-time / monthly subscription`.

---

## Task 9: Full verification

- [ ] `npm run test`, `npm run lint`, `npx tsc --noEmit`, `npm run build`.
- [ ] Manual matrix: (free) immediate students; (one-time) single payment, discounted total; (monthly) family subscription with per-child discounted line items + promo code; per-program vs per-class pricing; single-class auto-enroll vs multi-class queue; lapsed/canceled subscription updates the program-subscription status (enrollment unchanged — manual).
- [ ] `git push origin HEAD`. Note for deploy: `npx payload migrate`; set Stripe Connect webhook secrets; tenant must have a connected account with charges enabled.

---

## Self-review (run before executing)
- **Spec coverage:** payment models free/one-time/monthly ✔ (1,8); per-program & per-class pricing ✔ (1,3); one Stripe customer per family + one subscription/line-item-per-child ✔ (4); computed sibling discount + stackable promo codes ✔ (2,4); webhook creates students + family record ✔ (6,7); manual class-change/lapsed-payment ✔ (7 leaves enrollment manual).
- **Type consistency:** `PricingContext`/`DiscountTier` shared across Tasks 2-3-4-8; `computeSiblingDiscount(prices, tiers)` and `participantPricesCents(participants, ctx)` signatures stable; `materializeStudentsFromSubmission(payload, submission, opts)` defined in Task 6, consumed in Task 7.
- **Security:** webhook binds `event.account` → tenant and matches `metadata.tenantId` (Task 7); all Stripe calls use `{ stripeAccount }`.

## Out of scope (future)
Real `families` entity + parent portal; in-app coupon manager (push to Stripe via API); mid-stream add-a-child automation; automated proration on class/price change; lapsed-payment auto-unenroll. (Per spec §11/§14.)
