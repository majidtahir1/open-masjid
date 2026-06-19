# Paid Programs: Tuition & Multi-Child Registration — Feature Spec

**Status:** Draft (brainstorm complete; awaiting masjid pricing inputs)
**Date:** 2026-06-19
**Author:** Brainstormed with Majid Tahir
**Product area:** OpenMasjid → Programs (Sunday school, Qur'an Academy, …)
**Related:** parent check-in kiosk (shipped), registration-details (PR #140), `docs/superpowers/specs/2026-06-18-parent-checkin-kiosk-design.md`

---

## 1. Summary

Masjid programs charge a **recurring monthly fee**. Parents register **all their children at once** through a dedicated multi-child flow and pay a **single monthly family subscription**. The only thing that differs between programs is **how each child's price is determined**:

- **Sunday school** — a **flat** monthly price per child (does not vary by class). Parents provide the child's **grade**; admins place into a class afterward.
- **Qur'an Academy** — **per-class** pricing (level-based classes: hifdh, nazirah, qaidah, …). Parents pick the class at registration; the price follows the class; the child is auto-enrolled.

Both apply an **automatic percentage multi-child (sibling) discount** within a program, and accept **handed-out coupon codes** (Stripe promotion codes) on top. This reuses the platform's existing **membership subscription** infrastructure (Stripe subscriptions + webhooks), not the one-time forms payment path.

---

## 2. Goals & non-goals

### Goals
- One **dedicated multi-child registration flow** for paid programs: family info once → add N children → one checkout.
- **Per-program pricing model:** flat (Sunday school) or per-class (Qur'an Academy), as a setting.
- **One Stripe customer + one monthly subscription per family**, one line item per child.
- **Automatic percentage sibling discount**, configured **on the form**, applied **within a program**.
- **Handed-out promo codes** (Stripe) that combine with the sibling discount.
- On payment: **auto-create students**; **auto-enroll** for per-class programs; create unplaced student + **grade** for flat programs (admin places later).

### Non-goals (v1)
- Mid-stream "add a child later" automation — manual.
- Automated class-change / proration — manual in Stripe.
- Automated lapsed-payment enrollment changes — manual (flag for follow-up).
- Real `families` entity, parent accounts, or parent portal — guardian email is the family key.
- In-app coupon manager — coupons created in the Stripe dashboard.
- Cross-program bundle discounts — only via handed-out coupon codes.

---

## 3. Locked decisions

| Decision | Choice |
|---|---|
| Registration UX | **Dedicated multi-child flow** (custom, not the generic form), used by all paid programs |
| Pricing model | **Per-program setting**: flat per-child (Sunday school) or per-class (Qur'an Academy) |
| Cadence | **Monthly** |
| Billing entity | **One Stripe customer per family** (key = guardian email) |
| Subscription shape | **One monthly subscription, one line item per child** |
| Class selection at registration | **Per-class programs only** (Qur'an Academy → auto-enroll). Flat programs capture **grade**; admin places. |
| Sibling discount | **Automatic, percentage-off by child rank**, configured **on the form**, **within a program** |
| Which child discounted | Most-expensive line pays full; **discount rolls down** to lower-priced children (trivial when flat) |
| Promo codes | **Stripe promotion codes** (`allow_promotion_codes`); sibling discount is computed pricing so it doesn't consume Stripe's discount slot |
| Cross-program discount | Handed-out coupon codes only |
| Class change / add child later / lapsed payment | **Manual** for v1 |

---

## 4. Registration UX (multi-child flow)

A dedicated paid flow (separate route/component from the generic `/forms/[slug]`), used by both programs:

1. **Family info** — guardian name, **email** (family key), phone, address, authorized pickups, etc. Entered once.
2. **Add children** — repeatable per child:
   - always: name, age, **grade**, allergies;
   - **per-class programs only:** select a **class** from the program's priced classes.
3. **Review** — line items (child → flat price *or* class price), the **computed sibling discount**, optional **promo code**, **monthly total**.
4. **Checkout** — Stripe **subscription** checkout (reuses membership flow) against one family customer.
5. **Confirmation** — students/enrollments created on webhook confirmation.

The generic free form remains for any non-tuition / free registrations (events, RSVPs, etc.).

---

## 5. Data model

Prefer extending/mirroring the **membership** collections over bespoke ones.

- **Program (`terms`)** — `pricingModel`: `flat` | `per-class`; for `flat`, a program-level `tuitionCents` (monthly).
- **`school-classes`** — for `per-class` programs, `tuitionCents` (monthly) + Stripe recurring **price id**.
- **Registration form** — `multiChildDiscount`: enabled + **percentage tiers by child rank** (2nd child X%, 3rd+ Y%); admin enters per form. (Cadence fixed monthly in v1.)
- **Family/tuition record** — one per family subscription (mirrors `members`): guardian email, `stripeCustomerId`, `stripeSubscriptionId`, `status`, `currentPeriodEnd`, tenant. Forward-compatible with a future `families` entity.
- **`students`** — link to the family/tuition record; store `gradeLevel` (all programs) and, for per-class, the chosen class; reuse the `registrationDetails` snapshot (PR #140).
- **`enrollments`** — per-class: created on payment into the selected class. Flat: created by admin during placement (student is created with grade, unplaced).

Exact shapes finalized at planning time.

---

## 6. Billing & Stripe

- **One Stripe customer per family** (lookup-or-create by guardian email).
- **One monthly subscription**, **one line item per child** (flat program price, or the child's class price).
- **Sibling discount = computed line-item pricing** (amounts reduced by us), leaving Stripe's discount slot free for **promo codes** (`allow_promotion_codes`).
- **Webhook** (reuse `membership-webhook.ts` patterns): on subscription active → create students, enrollments (per-class) / unplaced students (flat), and the family/tuition record; on status change → update it. Lapsed/canceled → record updated; enrollment changes **manual** in v1.
- Reuse `membership-stripe.ts` / `membership-checkout.ts` patterns and the existing Stripe **billing portal** (future family self-service).

---

## 7. Discount logic

- Configured **on the form** as **percentage-off tiers by child rank**.
- Children ranked by price **descending**; most expensive pays full; configured percentages apply to subsequent children (with flat pricing, ranking is moot — e.g. 2nd child X% off the flat fee).
- Applies **within one program** only.
- Computed at checkout, baked into per-child line-item amounts.
- **Handed-out coupon codes** (Stripe promotion codes) combine on top for ad-hoc / cross-program deals.

---

## 8. Edge cases & manual-for-v1

| Case | v1 behavior |
|---|---|
| Add a child after initial registration | Manual (admin) |
| Change a child's class / program | Manual (admin adjusts Stripe + re-enrolls) |
| Failed / lapsed payment | Family/tuition record reflects Stripe status; enrollment changes manual (follow-up) |
| Different guardian emails per child | Family grouping keyed on email — same data-quality caveat as the kiosk phone lookup |
| Family with kids in two programs | Separate per-program line items on the same family customer; sibling discount per program; cross-program via coupon code |

---

## 9. Forward-compatibility (north star, not built now)

- **Family records:** promote guardian-email grouping into a real `families`/household entity owning students + Stripe customer + subscription; backfill from distinct guardian emails.
- **Parent portal:** Stripe billing portal (already used for memberships) + an OpenMasjid "your children" view (attendance, check-in log, progress).
- **Student tracking:** mostly a read view over data we already capture (attendance-records, kiosk check-in log), grouped by family.
- **In-app coupon manager:** create coupons/promo codes in OpenMasjid and push to Stripe via API — everything in one place.

---

## 10. Reused infrastructure

`membership-tiers`, `members`, `membership-checkout.ts`, `membership-webhook.ts`, `membership-stripe.ts`, `membership-aggregates.ts`, the Stripe billing portal (`/api/membership/portal`), Stripe Connect wiring. The tuition subscription mirrors the membership subscription lifecycle.

---

## 11. Open inputs to confirm (masjid)

1. **Sibling discount percentages** per child rank (2nd child __%, 3rd+ __%) — per program/form.
2. **Sunday school flat monthly price**; **Qur'an Academy monthly price per class**.
3. Confirm **most-expensive-pays-full / discount-rolls-down** convention.
4. Confirm **Sunday school also gets the multi-child flow + sibling discount** (assumed here), just with flat pricing.

These are data/config, not blockers for building the mechanism.

---

## 12. Out of scope (this spec)

The small Sunday-school **grade → `gradeLevel`** mapping for the generic form rides with PR #140. Class-change automation, mid-stream child adds, lapsed-payment enrollment automation, the `families` entity, parent portal, and in-app coupon manager are all future.
