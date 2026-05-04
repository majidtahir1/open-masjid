# Tenant Memberships — Paid Tiers with Recurring Dues

**Status:** Design approved, pending implementation plan
**Issue:** [#46](https://github.com/majidtahir1/open-masjid/issues/46)
**Depends on:** Tenant Stripe Connect donations (#47, shipped in #55)
**Date:** 2026-05-04

## Goal

Let masajid offer formal membership with one or more paid recurring tiers (monthly or yearly). Congregants subscribe via Stripe Connect; the masjid sees a clean roster of who is a current member. No content gating, no member-side login, no free directory in v1.

This is the "B" milestone of a planned A→B→C progression (free directory → paid dues → gated content). The data model is shaped to extend cleanly into A and C later.

## Non-goals (v1)

- **Free / non-paying members** — every member in v1 has an active or formerly-active Stripe subscription.
- **Member-side login or self-service UI on the tenant site** — managed via Stripe's Customer Portal (link delivered in receipts).
- **Public member directory.**
- **Gated content** (members-only pages/announcements/events).
- **Multiple concurrent subscriptions per member** at the same tenant.
- **Family memberships modeled as multiple humans** — a "Family" tier is one record paid by one person.
- **User-controllable date range filters** in admin reporting (matches the donations module's current scope).

## Architecture

Two new Payload collections plus routes that mirror the existing donations Connect plumbing.

```
src/collections/
  MembershipTiers.ts            ← tenant-scoped; auto-syncs Stripe Product/Price
  Members.ts                    ← tenant-scoped; one (tenant, email) per row

src/app/(site)/membership/
  page.tsx                      ← lists active tiers + "Become a member" CTAs
  thanks/page.tsx               ← post-checkout landing

src/app/api/membership/
  checkout/route.ts             ← creates Stripe Checkout Session (mode: subscription)
  portal/route.ts               ← creates Stripe Customer Portal session

src/app/(payload)/admin/membership/
  overview/page.tsx             ← roster + per-tier counts (mirrors donations/overview)
  overview/OverviewClient.tsx

src/app/api/members/
  export.csv/route.ts           ← roster CSV

src/lib/
  membership-stripe.ts          ← Tier ↔ Stripe Product/Price sync helpers
  membership-webhook.ts         ← subscription lifecycle handlers
```

Webhooks land on the existing donations Stripe Connect webhook route. The handler dispatches by `event.type` prefix and by metadata: events with `metadata.kind === 'membership'` (set on the Checkout Session and propagated to the subscription) route to `membership-webhook.ts`. Donation events with no kind, or `kind === 'donation'`, continue to the existing handler.

## Data model

### `MembershipTiers`

```ts
{
  id: string
  tenant: ref<Tenants>                   // tenant-scoped, indexed
  name: string                            // e.g. "Supporting Member"
  description?: richText                  // optional, shown on /membership
  amountCents: number                     // required; 2500 = $25.00
  cadence: 'monthly' | 'yearly'           // required
  active: boolean                         // soft-delete flag (default true)
  sortOrder?: number                      // ascending; ties broken by createdAt

  // Managed by hooks — not editable in admin
  stripeProductId?: string
  stripePriceId?: string                  // current price; rotates on amountCents change
  archivedPriceIds?: string[]             // historical prices live subs may still ride
  lastStripeSyncAt?: date
  lastStripeSyncError?: string            // surfaced in admin if non-null

  createdAt, updatedAt
}
```

Indexes: `(tenant, active, sortOrder)`.

### `Members`

```ts
{
  id: string
  tenant: ref<Tenants>                    // tenant-scoped, indexed
  email: string                            // unique per tenant
  name: string
  phone?: string
  tier: ref<MembershipTiers>              // current tier
  status: 'active' | 'grace' | 'inactive' // bucketed lifecycle (see below)

  stripeCustomerId?: string
  stripeSubscriptionId?: string
  stripeSubscriptionStatus?: string       // raw Stripe status, debug/audit

  joinedAt: date                          // first activation; preserved across tier changes
  currentPeriodEnd?: date
  canceledAt?: date
  notes?: textarea                        // admin-only

  createdAt, updatedAt
}
```

Indexes: `(tenant, email)` unique; `(tenant, status)`.

### Status bucket mapping

| Stripe status                      | Bucket     |
|------------------------------------|------------|
| `active`, `trialing`               | `active`   |
| `past_due`, `unpaid`               | `grace`    |
| `canceled`, `incomplete_expired`   | `inactive` |
| `incomplete`                       | `inactive` (until first payment succeeds) |
| `paused`                           | `inactive` |

The raw Stripe status is always stored on `stripeSubscriptionStatus` for debugging and audit.

## Tier ↔ Stripe sync

**On tier create:**
- `afterChange` hook calls `ensureStripeProductAndPrice(tier)` against the tenant's Connect account.
- Creates a `Product` (name = tier name, metadata `{ kind: 'membership', tierId, tenantId }`) and a recurring `Price` (`amountCents`, `cadence` → `interval`).
- Stores `stripeProductId` and `stripePriceId` on the tier.

**On tier amount or cadence change:**
- Stripe Prices are immutable. Hook creates a new `Price`, archives the old one (`stripe.prices.update(oldId, { active: false })`), pushes the old ID into `archivedPriceIds`, and points `stripePriceId` at the new one.
- Existing subscribers continue billing on the archived Price (Stripe behavior). New checkouts use the new Price.

**On tier name or description change:**
- Updates the Stripe `Product` in place. No price churn.

**On tier `active = false` (soft delete):**
- Archives the current `stripePriceId` and the `stripeProductId`. Existing subscribers keep billing; new checkouts cannot start. The tier is hidden from `/membership` but remains visible in admin (shown with a "Archived" badge) so historical members display their tier name.

**Hard delete is forbidden** in v1 — admin UI hides the delete button and access control denies it. Tenant must `active = false` instead.

**Sync failures** are caught, the error message is stored on `lastStripeSyncError`, and the admin shows a banner on the tier with a "Retry sync" action that re-runs the hook. The save still succeeds in Payload — we never block CMS saves on Stripe availability.

**Tier creation requires** `tenant.stripeChargesEnabled === true`. The admin form blocks save with a helpful error otherwise; the public `/membership` page hides any tier whose Stripe sync hasn't completed.

## Public signup flow

1. Visitor lands on `/membership`. Server component fetches `tenant.stripeChargesEnabled` and active tiers (sorted by `sortOrder`).
2. If Stripe Connect isn't live or no active tiers exist, the page shows a placeholder ("Memberships coming soon") and no form.
3. Each tier renders as a card with name, description, price, cadence, and a "Become a member" button.
4. Clicking the button posts to `/api/membership/checkout` with the tier ID. The endpoint:
   - Loads the tier, validates `active` and Stripe-synced.
   - Creates a Stripe Checkout Session on the connected account: `mode: 'subscription'`, `line_items: [{ price: stripePriceId, quantity: 1 }]`, `metadata: { kind: 'membership', tenantId, tierId }`, `customer_creation: 'always'`, `customer_email` (if known), `success_url: /membership/thanks?session_id={CHECKOUT_SESSION_ID}`, `cancel_url: /membership`.
   - Returns the session URL; client redirects to Stripe.
5. After payment, Stripe redirects to `/membership/thanks?session_id=...`. The thanks page reads the session, displays a confirmation with the member's name, tier, and a "Manage your membership" button that calls `/api/membership/portal`.

The portal endpoint creates a Stripe Customer Portal session for the customer ID and returns the URL. The Customer Portal handles update-card / cancel / view invoices / change payment method behind Stripe-managed email auth.

**No name/phone form on the tenant site.** Stripe Checkout collects email and (optionally, configurable in the Connect dashboard) phone and address. We extract name from Stripe's customer record on webhook.

## Webhook handling

Subscriptions emit a sequence of events; we handle the lifecycle ones we care about and ignore the rest.

| Stripe event                        | Action                                                                 |
|-------------------------------------|------------------------------------------------------------------------|
| `checkout.session.completed`        | Find or create `Member` row by `(tenant, email)`. Persist `stripeCustomerId`, `stripeSubscriptionId`, name, phone, tier. Set `status` from subscription status, `joinedAt = now` if new. |
| `customer.subscription.updated`     | Look up member by `stripeSubscriptionId`. Update `status`, `stripeSubscriptionStatus`, `currentPeriodEnd`, `tier` (if Price changed via portal upgrade/downgrade). |
| `customer.subscription.deleted`     | Set `status = 'inactive'`, `stripeSubscriptionStatus = 'canceled'`, `canceledAt = now`. Keep the row.                       |
| `invoice.payment_failed`            | Stripe will move the subscription to `past_due`; the subsequent `subscription.updated` will flip our bucket to `grace`. No direct action needed but logged. |
| `invoice.payment_succeeded`         | Bumps `currentPeriodEnd`; covered by `subscription.updated`.           |

**Idempotency**: the donations webhook already deduplicates on `event.id`; membership reuses that table.

**Tenant resolution**: the connected account ID on the event payload maps to a tenant via `Tenants.stripeAccountId` (already indexed for donations).

**Tier resolution on subscription updates**: look up `stripePriceId` (current or archived) → `MembershipTier`. If a member upgraded via the Customer Portal, the new Price ID won't match an archived ID — it'll match the new tier's current Price. We update `member.tier` accordingly.

## Admin experience

Two surfaces, both tenant-scoped, both gated to `admin` role (not `staff` — memberships involve PII and money):

**`/admin/collections/membership-tiers`** — standard Payload list/edit. Fields hidden from the editor: `stripeProductId`, `stripePriceId`, `archivedPriceIds`, `lastStripeSyncAt`. `lastStripeSyncError` shows in a banner with a "Retry sync" action.

**`/admin/membership/overview`** — custom view mirroring `/admin/donations/overview`:
- Stat cards: `Active members`, `In grace`, `Inactive (lifetime)`, `Monthly recurring revenue` (sum of active members' tier amounts, normalized to monthly).
- Per-tier table: tier name, active count, grace count, MRR contribution.
- Recent activity feed: 20 most recent member status changes (joined, canceled, payment failed) — derived from `Members.updatedAt` desc.
- Filter by status; click-through to the standard `Members` collection list filtered.

**`/api/members/export.csv`** — admin-auth, tenant-scoped, returns name, email, phone, tier name, status, raw Stripe status, joinedAt, currentPeriodEnd, canceledAt, stripeCustomerId, stripeSubscriptionId. UTF-8 with a BOM so Excel renders Arabic names correctly. Filename: `members-{slug}-{YYYY-MM-DD}.csv`.

**Sidebar navigation** under the existing "Donations" group, since it shares Stripe Connect plumbing — or a sibling "Membership" group if the donations group gets crowded. Decide during implementation.

## Access control

- **`Members` collection**: `tenantScopedRead`, `tenantScopedUpdate` for `admin` role only; create is webhook-internal (`overrideAccess`); delete forbidden.
- **`MembershipTiers` collection**: `tenantScopedRead | Create | Update` for `admin`. Hard delete denied; soft-delete via `active`.
- **Public `/membership` page**: no auth; reads tiers via `overrideAccess: true` filtered to `active = true` and Stripe-synced.
- **`/api/membership/checkout`**: no auth required (it's a public donation/signup-style endpoint); validates tier active + tenant Connect live.
- **`/api/membership/portal`**: takes a session ID or customer ID and verifies the customer belongs to the resolved tenant.
- **`/api/members/export.csv`**: requires authenticated `admin` user with matching tenant.

## Testing

Unit + integration tests under `tests/lib/` and `tests/collections/`, mirroring donations test layout:

- `tests/collections/membershipTiers.access.test.ts` — access control
- `tests/collections/membershipTiers.stripeSync.test.ts` — afterChange hook creates/rotates Prices, soft-delete archives
- `tests/collections/members.access.test.ts` — admin-only writes; staff blocked
- `tests/lib/membership-webhook.test.ts` — each Stripe event type maps to the expected member state, idempotency on replay
- `tests/lib/membership-checkout.test.ts` — Checkout Session creation requires Connect live + tier synced
- `tests/lib/members-export.test.ts` — CSV format, BOM, filename, tenant scoping
- `tests/lib/membership-status-buckets.test.ts` — Stripe status → bucket mapping

E2E smoke (manual, documented in PR test plan): create tier → public signup → Stripe test card → admin sees member → cancel via Customer Portal → admin sees inactive.

## Migration

Two new collections; a Payload migration adds:

- `membership_tiers` and `_membership_tiers_v` tables with all fields.
- `members` and `_members_v` tables.
- FK from `members.tier_id` → `membership_tiers.id` with `ON DELETE SET NULL`.
- Indexes listed above.
- Webhook event dedup table is reused from donations — no schema change there.

No data migration. Generated via `npx payload migrate:create membership_collections`. **Critical**: the migration must be committed in the same PR as the collection schema (the donations work in #58 missed this step and required a hot-fix PR — apply the lesson here).

## Open questions for implementation

These are intentionally deferred to the implementation plan, not the spec:

- Email notifications (welcome message, payment failure nudge, cancellation receipt) — Stripe sends transactional receipts by default; do we want our own branded "Welcome to {Masjid}" email on `checkout.session.completed`? Recommend deferring to the C milestone unless a tenant explicitly asks.
- Whether to expose member count publicly on the marketing homepage ("Join 240 members of {Masjid}") — out of scope; trivial to add later if desired.
- How "trialing" gets used. Stripe supports trial periods on Prices, but our admin doesn't expose the field. Decision: omit in v1; add a `trialDays?: number` field on `MembershipTiers` only if a tenant requests it.
- Refunds on cancellation — Stripe Connect Customer Portal lets the tenant configure prorated refund behavior. We don't model refunds on memberships; the donations module already handles refund webhooks for one-time charges.

## Future-proofing for A and C milestones

The data model accommodates the deferred milestones with no migration:

- **A (free signup)**: add a "Free" tier where `amountCents = 0` and `stripePriceId` is null; checkout endpoint short-circuits, creating the `Member` directly without Stripe. Or add a separate `MembershipApplications` flow if we want approval gates.
- **C (gated content)**: add a `membersOnly: boolean` field to Pages/Announcements/Events; add member-side magic-link auth (separate Payload `members` auth collection) so we can resolve "is this requester an active member of this tenant?" at request time.

Neither requires changing the v1 model; both extend it.
