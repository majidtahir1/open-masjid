# Tenant Stripe Connect + Donation Funds — Design

**Date:** 2026-04-30
**Status:** Approved (pending user review)
**Scope:** MVP for tenant-owned donation processing

## Summary

Enable each tenant (masjid) to accept donations on their public site via their own Stripe account. Congregants can donate to tenant-managed categories ("funds") such as Sadaqah, Zakat, Building Fund, etc. Platform takes no fee — 100% of donations (less Stripe processing) flow to the masjid.

## Goals

- Each tenant onboards their own Stripe account via Stripe Connect Standard.
- Tenants manage a list of donation funds; donors pick a fund at checkout.
- Donors complete payment via Stripe-hosted Checkout on the tenant's connected account.
- Support one-time and monthly recurring donations.
- Platform stores aggregate donation records (no PII) for reporting.
- Tenants view aggregate dashboard; deep-link to Stripe for individual donor data.

## Non-Goals (this spec)

- Tax-receipt emails from the platform (Stripe handles default receipts).
- Embedded Stripe Elements checkout — hosted Checkout only.
- Donor self-service portal (deferred; Stripe billing portal link can be added later).
- Multi-currency (USD only).
- Application fees / platform revenue share. The model leaves room to add this later as an optional per-tenant field, but it is not implemented.
- Automated provisioning of Stripe Connect application (`ca_…` is set as platform env var).

## Architecture

### Stripe Account Model

- **Connect type:** Standard.
- **Charge type:** Direct charges on the tenant's connected account, via the `Stripe-Account` header on every API call.
- **Application fee:** None. Donations are processed entirely on the masjid's account; the masjid is the merchant of record.
- **Receipts:** Sent automatically by Stripe from the masjid's account (their branding, their tax compliance).

### Existing State (preserved)

- Platform Stripe Billing (subscription `tenant → platform`) is unchanged.
- The platform's existing `STRIPE_SECRET_KEY` is reused for the Connect OAuth handshake and account fetches.
- Existing `donationConfig.mode` field gains a `connect` value; the previous `stripe` value is renamed to `connect` (no production data exists with `mode === 'stripe'` since the UI was disabled).

## Data Model

### New Collection: `donationFunds`

Tenant-scoped, like `events` and `services`.

| Field | Type | Notes |
|---|---|---|
| `tenant` | relationship | required |
| `name` | text | "Sadaqah", "Zakat", "Building Fund" |
| `slug` | text | URL-safe; unique per tenant |
| `description` | textarea | optional; rendered on the donate page |
| `zakatEligible` | checkbox | default `false`; `true` on the seeded Zakat fund |
| `suggestedAmounts` | array of number | e.g. `[25, 50, 100, 250]` |
| `sortOrder` | number | |
| `active` | checkbox | default `true` |

**Seeding:** When a tenant is created, two funds are auto-inserted via an `afterChange` (create) hook on the `tenants` collection:

1. **Sadaqah** — `slug: "sadaqah"`, `zakatEligible: false`, `sortOrder: 0`, `active: true`
2. **Zakat** — `slug: "zakat"`, `zakatEligible: true`, `sortOrder: 1`, `active: true`

Tenant admins can edit, archive, reorder, or delete these.

### New Collection: `donations`

Aggregate-only. **No PII.**

| Field | Type | Notes |
|---|---|---|
| `tenant` | relationship | required, indexed |
| `fund` | relationship to `donationFunds` | required |
| `amount` | number (cents) | |
| `currency` | text | default `usd` |
| `frequency` | select | `one_time` \| `monthly` |
| `status` | select | `succeeded` \| `refunded` \| `failed` |
| `stripePaymentIntentId` | text | unique index |
| `stripeChargeId` | text | |
| `stripeSubscriptionId` | text | only set for `monthly` |
| `stripeAccountId` | text | which connected account |
| `createdAt` | auto | |

**Explicitly NOT stored:** donor email, name, billing address, phone, card fingerprint, IP address, payment method details. Anyone needing donor identity clicks the "View in Stripe" link, which deep-links to `https://dashboard.stripe.com/<stripeAccountId>/payments/<stripePaymentIntentId>`.

### Tenant Field Changes

The existing `donationConfig` group on `tenants` is extended:

| Field | Action | Notes |
|---|---|---|
| `mode` | modify | options become `external` \| `connect` (rename `stripe` → `connect`) |
| `externalUrl` | unchanged | |
| `stripeAccountId` | promoted | populated by OAuth callback (not manually entered) |
| `stripeAccountConnectedAt` | new (date) | |
| `stripeChargesEnabled` | new (checkbox) | from `account.capabilities.card_payments` |
| `stripePayoutsEnabled` | new (checkbox) | from `account.capabilities.transfers` |
| `stripeAccountLastSyncedAt` | new (date) | updated by `account.updated` webhook |

Migration: rename any existing `mode === 'stripe'` rows to `mode === 'connect'` (defensive — UI never allowed it but tests/seeds may have set it).

## Stripe Connect Onboarding

### OAuth Flow (Standard)

```
[Admin clicks "Connect Stripe" in wizard or /admin/donations/connect]
    ↓
GET /api/stripe/connect/authorize
  - Build URL: https://connect.stripe.com/oauth/authorize
      ?response_type=code
      &client_id={STRIPE_CONNECT_CLIENT_ID}
      &scope=read_write
      &redirect_uri={origin}/api/stripe/connect/callback
      &state={signedJWT: { tenantId, userId, nonce, expiresAt }}
  - Redirect to Stripe
    ↓
[Stripe-hosted OAuth — masjid signs in or creates a Stripe account]
    ↓
GET /api/stripe/connect/callback?code=...&state=...
  - Verify state JWT (signed with PAYLOAD_SECRET, max 10-min lifetime)
  - Reject if tenantId in JWT ≠ tenantId of authenticated session
  - POST https://connect.stripe.com/oauth/token { grant_type: "authorization_code", code }
  - Response: { stripe_user_id: "acct_…" }
  - Fetch: stripe.accounts.retrieve(acct_id)
  - Update tenant:
      stripeAccountId         = acct_id
      stripeChargesEnabled    = account.charges_enabled
      stripePayoutsEnabled    = account.payouts_enabled
      stripeAccountConnectedAt = now
      stripeAccountLastSyncedAt = now
      donationConfig.mode     = 'connect'
  - Redirect → /admin/donations/connect?status=success
```

### Disconnect

```
DELETE /api/stripe/connect
  - stripe.oauth.deauthorize({ client_id, stripe_user_id: tenant.stripeAccountId })
  - Clear tenant.stripeAccountId / capabilities / connectedAt
  - Flip donationConfig.mode = 'external'
  - Public donate page falls back to external/disabled UI
```

### Capability Sync

Connect-mode webhook subscribes to `account.updated`. On each event, sync `chargesEnabled` / `payoutsEnabled` to the matching tenant. If `chargesEnabled` flips false (Stripe restricted the account), the public donate page shows a "Donations temporarily unavailable" state.

## Donor Checkout Flow

Public donate page (`/donate`) when `donationConfig.mode === 'connect'` and `tenant.stripeChargesEnabled`:

1. Donor selects **fund** (radio cards), **amount** (suggested chips or custom input, min $1), **frequency** (one-time / monthly).
2. `POST /api/donations/checkout` with `{ fundId, amountCents, frequency }`.
3. Server validates:
   - `fund.tenant === currentTenant.id`
   - `fund.active === true`
   - `amountCents >= 100`
   - `tenant.stripeChargesEnabled === true`
4. Server creates a Checkout Session **on the connected account**:
   ```
   stripe.checkout.sessions.create({
     mode: frequency === 'monthly' ? 'subscription' : 'payment',
     line_items: [{
       price_data: {
         currency: 'usd',
         product_data: { name: `${tenant.name} — ${fund.name}` },
         unit_amount: amountCents,
         ...(frequency === 'monthly' && { recurring: { interval: 'month' } }),
       },
       quantity: 1,
     }],
     metadata: { tenantId, fundId, frequency },
     subscription_data: frequency === 'monthly'
       ? { metadata: { tenantId, fundId, frequency } }
       : undefined,
     payment_intent_data: frequency === 'one_time'
       ? { metadata: { tenantId, fundId, frequency } }
       : undefined,
     success_url: `${origin}/donate/thanks?session_id={CHECKOUT_SESSION_ID}`,
     cancel_url: `${origin}/donate`,
   }, { stripeAccount: tenant.stripeAccountId })
   ```
5. Redirect donor to `session.url`.
6. After payment → Stripe redirects to `/donate/thanks` → generic thank-you (no donor data shown, no receipt rendered locally; Stripe emails the receipt from the masjid's account).

If `mode !== 'connect'` or `!chargesEnabled`: existing external-link or disabled UI is preserved.

## Webhooks

Single endpoint: `POST /api/stripe/connect/webhook`.

A **Connect-mode webhook** is registered on the platform's Stripe account; Stripe forwards events from all connected accounts to this URL. Each event payload includes `account: "acct_…"` so we know which connected account it came from.

| Event | Action |
|---|---|
| `checkout.session.completed` | Resolve `tenantId` + `fundId` from `session.metadata`. Insert a `donations` row with `status: 'succeeded'`, capture `payment_intent`, `subscription` (if mode=subscription), connected account ID. |
| `charge.refunded` | Find donation by `stripeChargeId`; set `status: 'refunded'`. |
| `invoice.payment_succeeded` | Subscription renewal. Resolve `tenantId` + `fundId` from `invoice.subscription_details.metadata`. Insert a new donation row (`frequency: monthly`, fresh `stripePaymentIntentId`). Skip the very first invoice that came from `checkout.session.completed` (idempotency on PI ID handles this). |
| `customer.subscription.deleted` | No-op (prior `succeeded` rows are preserved as historical record). |
| `account.updated` | Sync tenant `stripeChargesEnabled` / `stripePayoutsEnabled` / `stripeAccountLastSyncedAt`. |

**Signature verification:** `stripe.webhooks.constructEvent(rawBody, sig, STRIPE_CONNECT_WEBHOOK_SECRET)`.

**Idempotency:** Unique index on `donations.stripePaymentIntentId`. Duplicate insert attempts are caught and ignored.

## Admin UI

### Wizard Step (`donations` milestone, already in `tenant.onboarding` state)

Three actions on the panel:

- **Connect Stripe** → kicks off OAuth flow. On return, shows green-checked "Connected to acct_•••" with **Manage** link to `/admin/donations/connect`.
- **Skip for now** → marks milestone `dismissed`. Step can be revisited from the milestone panel.
- **Use external link instead** → flips `donationConfig.mode = 'external'`, prompts for `externalUrl`.

### `/admin/donations` Section (new top-level Payload nav group "Donations")

- **Overview** (`/admin/donations/overview`):
  - Aggregate cards: this-month total, YTD total, donation count (succeeded), average gift, active monthly donor count (distinct `stripeSubscriptionId` with at least one succeeded row in the last month).
  - By-fund table: Fund name × (this-month count, this-month total, YTD total).
  - Recent activity feed (paginated): `date | fund | amount | frequency | status | [View in Stripe →]`. The link opens `https://dashboard.stripe.com/{stripeAccountId}/payments/{stripePaymentIntentId}` in a new tab.
  - CSV export button: same columns as the feed (no PII).
- **Funds** (`/admin/collections/donation-funds`):
  - Standard Payload list view; CRUD by tenant admins. Reorderable via `sortOrder`.
- **Connect** (`/admin/donations/connect`):
  - Card showing account status: account ID, charges enabled, payouts enabled, last synced.
  - Buttons: **Open Stripe Dashboard** (deep-link), **Disconnect** (confirm modal).

## Access Control

- `donationFunds`:
  - Tenant `admin` and `staff`: full CRUD on own tenant's funds.
  - Tenant users on other tenants: no access.
  - Platform owner: full CRUD on all.
- `donations`:
  - Tenant `admin` and `staff`: read-only on own tenant's donations.
  - No create/update/delete from any UI; webhook is the only writer.
  - Platform owner: read-only on all.
- `/api/stripe/connect/authorize`, `/callback`, `/disconnect`: tenant `admin` role required; scoped to authenticated user's tenant.
- `/api/donations/checkout`: public (donors are anonymous). Rate-limited by IP (basic).
- `/api/stripe/connect/webhook`: signature-verified, no session auth.

## Configuration

New environment variables:

| Var | Purpose |
|---|---|
| `STRIPE_CONNECT_CLIENT_ID` | `ca_…` from Stripe Connect application settings |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | `whsec_…` for the Connect-mode webhook |

Reused (no change):

- `STRIPE_SECRET_KEY` — used for OAuth token exchange and `accounts.retrieve`.

## Testing

Unit / integration:

- **Connect OAuth:** mocked `oauth.token` and `accounts.retrieve`; assert tenant fields persisted; state JWT signature verification rejects forged or expired states; cross-tenant state replay rejected.
- **Checkout endpoint:** validates fund-tenant ownership, rejects inactive funds, rejects amounts < $1, calls `stripe.checkout.sessions.create` with the connected account header, metadata round-trips correctly.
- **Webhook handler:** signature verification rejects bad signatures; `checkout.session.completed` inserts donation row with correct fields; duplicate event for same PI is idempotent (single row); `charge.refunded` flips status; `invoice.payment_succeeded` for renewal inserts a new row; `account.updated` syncs capabilities.
- **Access control:** tenant A cannot read tenant B's funds or donations; staff cannot mutate donation rows.

E2E (Stripe CLI):

- `stripe listen --forward-connect-to localhost:3000/api/stripe/connect/webhook`
- `stripe trigger checkout.session.completed --stripe-account acct_test_…`

## Implementation Phasing

This spec is a single deliverable, but implementation can stage in order:

1. Data model + migrations (`donationFunds`, `donations`, tenant field extensions, fund seed hook).
2. Connect OAuth (authorize, callback, disconnect endpoints + Connect admin page).
3. Funds management (collection registration, default seeding verified end-to-end).
4. Checkout endpoint + public donate-page redesign with fund/amount/frequency picker.
5. Connect webhook (all five event types).
6. Donations dashboard (Overview page + CSV export).
7. Wizard step wiring (donations milestone tile updated to launch OAuth).

Each step is independently testable and ships behind the existing `donationConfig.mode` gate (an unconnected tenant continues to use external/disabled UI).

## Future Iterations (not in scope)

- Donor PII collection + automated 501(c)(3) acknowledgment letters.
- Stripe Elements (embedded) checkout for tighter brand control.
- Donor self-service portal via Stripe Billing Portal link (manage their own monthly subscription).
- Multi-currency.
- Optional per-tenant application fee.
- Apple Pay / Google Pay domain verification automation (Stripe Checkout handles this transparently for hosted; would matter only if we move to Elements).
- Connect Express as an alternative onboarding path for masajid that don't want a full Stripe account.
