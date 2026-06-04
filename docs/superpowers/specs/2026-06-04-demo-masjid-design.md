# Demo Masjid — Design Spec

**Date:** 2026-06-04
**Status:** Approved design, pending implementation plan

## Goal

Provide a public, always-on demo masjid at `demo.openmasjid.app` so prospective
masjid admins can explore the full OpenMasjid product — public site **and** admin
dashboard — including a working money layer (donations, memberships, paid forms)
using Stripe **test mode**, without any real money changing hands and without
polluting real tenants' data.

## Background: how Stripe is wired today

There are two distinct Stripe relationships in the codebase:

1. **Platform subscription billing (Relationship 1)** — the masjid pays OpenMasjid
   to use the SaaS. Collected in OpenMasjid's own Stripe account via
   `STRIPE_SECRET_KEY` + `STRIPE_PRICE_MONTHLY` / `STRIPE_PRICE_ANNUAL`. Handled by
   `/api/stripe/billing/*`.

2. **Connect charges (Relationship 2)** — a congregant pays the masjid (donations,
   memberships, paid forms). The masjid connects its **own** Stripe account via
   **OAuth Standard Connect**; only the connected account ID (`acct_…`) is stored
   on the tenant (`donationConfig.stripeAccountId`). Charges are created with the
   **platform** key plus a `{ stripeAccount: acct_… }` request option ("direct
   charges"). See `src/app/api/donations/checkout/route.ts:84,104` and
   `src/lib/stripe.ts`.

**Key consequence:** because Connect charges ride on `STRIPE_SECRET_KEY` via the
`stripeAccount` header, the **test-vs-live mode follows the platform key**. A live
platform key can only drive live connected accounts (real money); a test platform
key can only drive test connected accounts (`4242` cards). The two cannot mix in a
single API call. Today `getStripe()` caches **one** client built from
`STRIPE_SECRET_KEY`, so all tenants share one mode.

To let the demo tenant transact in test mode while every real tenant stays live,
the demo tenant must use a **test platform key**. This spec does that via
per-tenant key selection inside the live deployment (no separate environment).

## Architecture

### 1. The demo tenant

A new tenant seeded into the production database:

- **slug:** `demo`  → resolves at `demo.openmasjid.app`
- **name:** "Masjid al-Noor (Demo)"
- **status:** `grandfathered` — comped; Relationship-1 billing never charges it.
- **`demoMode: true`** — new field (see §2). Single source of truth that drives
  Stripe key selection, reporting exclusion, reset eligibility, and email
  sandboxing.
- **Seeded content:** prayer schedules (baseline + a seasonal range), events,
  announcements, services, hero slides, donation funds, membership tiers, and one
  signup/registration form.
- **No blog.** The blog ("The Minbar") lives on the marketing site, not on
  tenants, so the demo tenant has no blog content and no AI-draft surface.

### 2. `demoMode` field on Tenants

Add a boolean `demoMode` to the `Tenants` collection
(`src/collections/Tenants.ts`):

- Default `false`. Settable only by `platformOwner`; hidden from normal tenant
  admins.
- Read by: Stripe key router (§3), Connect webhook (§4), reset job (§5),
  reporting queries (§8), email layer (§8).

### 3. Per-tenant Stripe key routing (Connect only)

Refactor `src/lib/stripe.ts`:

- Keep `getStripe()` for **platform / billing** calls (Relationship 1) — always
  the live `STRIPE_SECRET_KEY`. Billing checkout/webhook are untouched; the demo
  is never billed.
- Add `getStripeForTenant(tenant)` for **Connect** calls (Relationship 2):
  - `tenant.demoMode === true` → cached client built from **`STRIPE_SECRET_KEY_TEST`**.
  - otherwise → the existing live client.
  - Cache both clients (keyed by mode) so we don't rebuild per request.
- Thread the resolved tenant into the four Connect call sites that already call
  `getCurrentTenant()`:
  - `src/app/api/donations/checkout/route.ts`
  - `src/app/api/membership/checkout/route.ts`
  - `src/lib/form-checkout.ts` (form payment checkout)
  - `src/app/api/membership/portal/route.ts`

**New env var:** `STRIPE_SECRET_KEY_TEST` (`sk_test_…`). Add to `.env.example`.

**Cross-mode safety:** routing keys on the hardcoded `demoMode` flag for a single
tenant, so misrouting is effectively impossible. Even if it occurred, Stripe
fails *closed* — a cross-mode `stripeAccount` call errors ("no such account in
this mode") rather than silently moving real money.

### 4. Demo connected account + dual-mode Connect webhook (the full loop)

**Connected account (no OAuth wiring):** Create one **test-mode** Standard
connected account once in the Stripe **test** dashboard. Seed its `acct_…`
directly onto the demo tenant's `donationConfig`
(`mode: 'connect'`, `stripeChargesEnabled: true`, `stripeAccountId: acct_…`). The
in-app "Connect Stripe" OAuth flow is **not** wired for test mode.

**Webhook:** `src/app/api/stripe/connect/webhook/route.ts` must verify the
signature against **both** secrets:

- `STRIPE_CONNECT_WEBHOOK_SECRET` (live, existing)
- `STRIPE_CONNECT_WEBHOOK_SECRET_TEST` (new) — register a **test-mode** webhook
  endpoint in the Stripe test dashboard pointing at the same URL.

Verification tries one secret, falls back to the other; rejects if neither
validates. Downstream handling (`handleMembershipEvent`, donations, form
submissions) is unchanged in logic. The existing tenant-ownership check
guarantees the test `acct_…` can only resolve to the `demo` tenant, so test
events cannot touch any real tenant's data.

**Follow-up API calls inside the webhook:** any outbound Stripe call the handler
makes while processing an event (e.g. retrieving a subscription or customer) must
use the **mode-correct** client. After the handler resolves the tenant from the
connected account, it uses `getStripeForTenant(tenant)` (§3) — so demo events use
the test client, real events the live client. (The verified event's `livemode`
flag is a secondary cross-check.)

**Result (full loop):** visitor on the demo pays with `4242` →
`checkout.session.completed` (test) → verified by the test secret → a real
`Member` / `Donation` / form-submission row is created, scoped to the demo
tenant, and appears in the corresponding admin section.

**New env var:** `STRIPE_CONNECT_WEBHOOK_SECRET_TEST`. Add to `.env.example`.

### 5. Nightly reset

`scripts/reset-demo.ts` — idempotent, runs with `overrideAccess`. It:

1. Deletes the demo tenant's **mutable** data: members, donations, form
   submissions, and any visitor edits to events / announcements / prayer schedules
   / services / hero slides.
2. Re-seeds the canonical demo content (shared with the demo seed in §1, factored
   into a reusable module so seed and reset stay in sync).

It does **not** delete the tenant itself, its `demoMode`/`grandfathered` status,
its `donationConfig.stripeAccountId`, or the shared demo admin user.

**Trigger:** Vercel Cron (matching the existing `/api/kiosk/cron` pattern in
`vercel.json`). Add a protected route `/api/demo/reset` that invokes the reset and
a cron entry:

```json
{ "path": "/api/demo/reset", "schedule": "0 6 * * *" }
```

- Desired: **1:00 AM Central**. Vercel crons are **UTC-only and do not observe
  DST**, so an exact 1am CT year-round is not possible with a single entry.
  `0 6 * * *` = 06:00 UTC = **1:00 AM CDT** (correct as of this writing); it drifts
  to 12:00 AM CST in winter. Reset timing is non-critical; this drift is accepted.
- The route is protected the same way `/api/kiosk/cron` is (Vercel cron
  secret / authorization header), and additionally no-ops unless the `demo` tenant
  exists with `demoMode: true`.

### 6. Shared-admin abuse hardening

The demo publishes shared admin credentials, so the demo admin user is
constrained. It **cannot**:

- delete or rename the tenant,
- change billing / subscription,
- connect, disconnect, or edit the Stripe account,
- edit domains,
- invite or manage users / API keys.

It **can** create/edit the demo's day-to-day content (events, announcements,
prayer times, services, hero, forms, funds, tiers) — these are what the nightly
reset restores. Enforced via a constrained role (e.g. a `demoAdmin` guardrail, or
`admin` with field/collection access checks gated on `demoMode`). Write
operations on the demo tenant are rate-limited.

### 7. Email + reporting isolation

- **Email:** all outbound email for a `demoMode` tenant (form confirmations,
  password resets, notifications) is routed to console/sandbox and **never** to
  real inboxes. Gated on `demoMode` in the email/notification layer
  (`src/lib/form-notifications.ts` and the Payload email adapter path).
- **Reporting:** audit cross-tenant aggregates (platform MRR / subscription
  metrics, platform-wide member counts, donation totals — e.g.
  `src/lib/donations-aggregates.ts`) to **exclude `demoMode` tenants**, so demo
  test-money never pollutes real metrics.

## Data flow (membership, full loop)

1. Visitor on `demo.openmasjid.app` clicks "Become a member".
2. `membership/checkout` resolves the demo tenant → `getStripeForTenant(demo)`
   returns the **test** client → creates a checkout session with
   `{ stripeAccount: <demo test acct_> }`.
3. Visitor pays with `4242`. Stripe emits `checkout.session.completed` (test mode).
4. The event hits `/api/stripe/connect/webhook`; signature verifies against
   `STRIPE_CONNECT_WEBHOOK_SECRET_TEST`.
5. `handleMembershipEvent` validates the connected account belongs to the demo
   tenant and creates/updates the `Member` row (scoped to `demo`).
6. The member appears in the demo admin's Members section.
7. Nightly, the reset job clears that member (and other mutable rows) and
   re-seeds clean demo content.

## Error handling

- **Missing `STRIPE_SECRET_KEY_TEST`** → demo Connect calls throw a clear error;
  real tenants are unaffected (separate code path).
- **Webhook signature** → try test secret then live secret; if neither validates,
  reject with 400 (unchanged contract for real tenants).
- **Reset job** → idempotent; safe to re-run; no-ops if the demo tenant is absent.
- **Cross-mode call** → fails closed at Stripe (errors, never misroutes money).

## Testing

- **Unit:** `getStripeForTenant` returns the test client iff `demoMode`, live
  otherwise; both clients are cached.
- **Unit:** Connect webhook accepts an event signed with the test secret, accepts
  one signed with the live secret, rejects a bad signature.
- **Unit/integration:** `reset-demo` is idempotent and only touches the demo
  tenant's mutable collections; preserves tenant config, Stripe account, and the
  demo admin user.
- **Manual E2E (test mode):** complete a `4242` membership on the demo and confirm
  a `Member` row appears in the demo admin section; confirm a real tenant's live
  checkout is unaffected.
- **Reporting:** assert demo tenant is excluded from platform aggregates.

## Scope / YAGNI

- No separate deployment or database — single live deployment, per-tenant key
  selection.
- No test-mode OAuth Connect UI — the demo's `acct_…` is seeded directly.
- No general-purpose per-tenant key routing — only the `demoMode` branch.
- No AI spend caps — the blog/AI-draft surface does not exist on tenants.
- Reuse and extend existing seed infrastructure (`scripts/seed.ts`) rather than
  rewriting it; factor shared demo content into a module used by both seed and
  reset.

## New configuration summary

| Env var | Purpose |
| --- | --- |
| `STRIPE_SECRET_KEY_TEST` | Test platform key for demo Connect charges |
| `STRIPE_CONNECT_WEBHOOK_SECRET_TEST` | Signing secret for the test-mode Connect webhook endpoint |

| Manual setup step | Where |
| --- | --- |
| Create test-mode Standard connected account; capture `acct_…` | Stripe test dashboard |
| Register test-mode Connect webhook → `/api/stripe/connect/webhook` | Stripe test dashboard |
| Add `demo.openmasjid.app` subdomain routing | DNS / hosting (matches existing subdomain tenants) |
