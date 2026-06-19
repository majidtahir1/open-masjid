# Paid Programs: Tuition & Multi-Child Registration — Feature Spec

**Status:** Draft (brainstorm complete; awaiting masjid pricing inputs)
**Date:** 2026-06-19
**Author:** Brainstormed with Majid Tahir
**Product area:** OpenMasjid → Programs (Sunday school, Qur'an Academy, …)
**Implementation:** **PR #140** is the umbrella for this whole effort — registration-details snapshot, the grade→`gradeLevel` mapping, the multi-child tuition subsystem, and the Enrollment hub (§9).
**Related:** parent check-in kiosk (shipped), `docs/superpowers/specs/2026-06-18-parent-checkin-kiosk-design.md`

---

## 1. Summary

Masjid programs need **configurable registration + billing**. There is **one dedicated, configurable program-registration flow**; each program sets a few independent knobs:

- **Payment model** — `free`, `one-time`, or `monthly recurring`.
- **Participant model** — `self` (an adult registers themselves) or `children` (a guardian registers one or more children — a repeatable section).
- **Pricing model** (when paid) — how each participant's price is set:
  - **per-program** — one price at the program level, same for everyone. *Example: Sunday school (monthly).*
  - **per-class** — price set on each class; the participant picks a class and the price follows. The pick is a **requested placement**, not an auto-enrollment. *Example: Qur'an Academy (monthly).*
- **Fields / sections** — configurable per program (see *Form flexibility*, §10), so e.g. an adults program omits the child/guardian sections.

Paid programs check out via Stripe: **one-time** payment, or a **monthly family subscription** (reusing the existing **membership subscription** infra) for recurring. **Free** programs skip checkout.

**Built generically.** Sunday school and Qur'an Academy are **examples**, not special cases — all behavior is driven by the per-program/per-form config above, so the same mechanism fits free or paid, one-time or recurring, adult-self or guardian-for-children programs (camps, weekend academies, adult halaqas, etc.).

**Placement:** for **class-based** programs, every registration creates the participant **unenrolled**; an admin places them via the **Enrollment hub** (§9) — never auto-enrolled. This sidesteps level/capacity mismatches; billing is adjusted manually if placement differs from a requested class.

When a paid program has **multiple participants** (e.g. siblings), an **automatic percentage discount** (configured on the form, within the program) applies, and **handed-out Stripe promotion codes** can stack on top.

---

## 2. Goals & non-goals

### Goals
- One **dedicated, configurable program-registration flow** driven by per-program config.
- **Payment model** per program: `free` | `one-time` | `monthly recurring`.
- **Participant model** per program: `self` (adult) | `children` (guardian registers ≥1, repeatable).
- **Pricing model** (when paid): **per-program** or **per-class**.
- **Configurable fields/sections** per program (sections toggle by participant model; custom fields reuse form-builder field types).
- For recurring: **one Stripe customer + one monthly subscription per family**, one line item per participant; for one-time: a single Stripe payment; for free: no checkout.
- **Automatic percentage multi-participant (sibling) discount**, configured **on the form**, **within a program**; **Stripe promo codes** stack on top.
- For **class-based** programs: registration **creates participants unenrolled** (with grade / requested-class hints); **admin places** — no auto-enrollment.

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
| Registration UX | **Extend the existing form builder** (option A — chosen): registration is a form built in the one form tool, with new configurable **section** capabilities. One place for all form creation. |
| Payment model | Per-program: **free** \| **one-time** \| **monthly recurring** |
| Participant model | Per-program: **self** (adult) \| **children** (guardian registers ≥1, repeatable) |
| Pricing model (when paid) | **per-program** (one program-level price) or **per-class** (price on each class) |
| Recurring cadence | **Monthly** (v1) |
| Fields / sections | **Configurable per program**; sections toggle by participant model; custom fields reuse form-builder field types |
| Billing entity (recurring) | **One Stripe customer per family** (key = guardian email) |
| Subscription shape (recurring) | **One monthly subscription, one line item per participant** |
| Class selection at registration | **Per-class programs** capture the **requested class** (drives price + placement hint); class-based programs capture **grade**. |
| Enrollment / placement | **Always admin-placed** — every registration produces an **unenrolled** student; admin enrolls via the new **Enrollment hub** (§9). Placement is **removed from Setup**. No auto-enroll, any program. |
| Sibling discount | **Automatic, percentage-off by child rank**, configured **on the form**, **within a program** |
| Which child discounted | Most-expensive line pays full; **discount rolls down** to lower-priced children (trivial under per-program pricing, where all children are the same price) |
| Promo codes | **Stripe promotion codes** (`allow_promotion_codes`); sibling discount is computed pricing so it doesn't consume Stripe's discount slot |
| Cross-program discount | Handed-out coupon codes only |
| Class change / add child later / lapsed payment | **Manual** for v1 |

---

## 4. Registration UX

A **form built in the existing form builder** (served like other forms, e.g. `/forms/[slug]`), using the new section capabilities (§10). Sections render from the form/program config. Example below is the `children`, paid model:

1. **Guardian / family info** — guardian name, **email** (family key), phone, address, authorized pickups, etc. Entered once. *(Omitted for `self` — the adult is the contact.)*
2. **Add children** — repeatable per child (always: name, age, **grade**, allergies; **per-class programs:** select a **class**). *(For `self`: a single participant section, no repetition.)*
3. **Review** — line items (participant → program price *or* class price), the **computed sibling discount**, optional **promo code**, total. *(Free programs: no totals.)*
4. **Checkout** — per payment model: **subscription** (recurring, reuses membership flow), **one-time** Stripe payment, or **none** (free).
5. **Confirmation** — for class-based programs, each participant is created **unenrolled** on confirmation; an admin places them afterward.

The existing generic forms feature (`/forms/[slug]`) stays for **free / non-tuition** signups (events, RSVPs, volunteer sign-ups, etc.) — a separate path from paid program registration. (Paid programs do **not** use it.)

---

## 5. Data model

Prefer extending/mirroring the **membership** collections over bespoke ones.

- **Program (`terms`)** — `pricingModel`: `per-program` | `per-class`; for `per-program`, a program-level `tuitionCents` (monthly).
- **`school-classes`** — for `per-class` programs, `tuitionCents` (monthly) + Stripe recurring **price id**.
- **Forms (`forms` + `form-schema`)** — extend with: **sections** + a **repeatable section** field type (→ nested submission data, a participants array); a **priced-option / class field**; payment model `free | one-time | monthly recurring` (extends `forms.payment`); and registration settings (`participantModel`, `pricingModel`, target program, `multiChildDiscount`: percentage tiers by rank). All additive — flat forms unaffected.
- **Family/tuition record** — one per family subscription (mirrors `members`): guardian email, `stripeCustomerId`, `stripeSubscriptionId`, `status`, `currentPeriodEnd`, tenant. Forward-compatible with a future `families` entity.
- **`students`** — link to the family/tuition record; store `gradeLevel` (all programs) and, for per-class programs, the **requested class** (a placement hint, like `registeredProgram`); reuse the `registrationDetails` snapshot (PR #140). Created **unenrolled** = the existing "unplaced" state (active student, no active `enrollments` row).
- **`enrollments`** — created by **admin** during placement for **all** programs (registration never auto-enrolls), in the Enrollment hub (§9); reuses `unplacedForProgram`.

Exact shapes finalized at planning time.

---

## 6. Billing & Stripe

- **One Stripe customer per family** (lookup-or-create by guardian email).
- **One monthly subscription**, **one line item per child** (the program-level price for per-program, or the child's class price for per-class).
- **Sibling discount = computed line-item pricing** (amounts reduced by us), leaving Stripe's discount slot free for **promo codes** (`allow_promotion_codes`).
- **Webhook** (reuse `membership-webhook.ts` patterns): on subscription active → create each student **unenrolled** (with grade / requested-class hints) and the family/tuition record. **No automatic enrollment** — admin places afterward, any program. On status change → update the record. Lapsed/canceled → record updated; enrollment changes **manual** in v1.
- Reuse `membership-stripe.ts` / `membership-checkout.ts` patterns and the existing Stripe **billing portal** (future family self-service).

---

## 7. Discount logic

- Configured **on the form** as **percentage-off tiers by child rank**.
- Children ranked by price **descending**; most expensive pays full; configured percentages apply to subsequent children (under per-program pricing all children are the same price, so ranking is moot — e.g. 2nd child X% off the program fee).
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

## 9. Enrollment hub (placement) — first-class admin view

Since most registrations arrive via the form (producing a steady stream of unenrolled students), placement is an **ongoing operational workflow**, not a one-time setup step. Promote it to a dedicated, re-enterable tab.

- **Route/nav:** a top-level **"Enrollment"** tab in the Programs nav (alongside Students / Classes / Attendance / Who's here), program-scoped via the picker.
- **Zone 1 — Needs placement:** live queue of unenrolled students for the program (active, `registeredProgram` = this program, no active enrollment), each with placement **hints** — grade (Sunday school) and **requested class** (Qur'an Academy) — plus a registration-details peek. Actions: **Place into &lt;class&gt;**, a **"place as requested"** shortcut for Qur'an Academy, and the **inline "Add & enroll a new student"** (moved out of Setup).
- **Zone 2 — Class rosters:** per active class, who's enrolled, with **move between classes** and **withdraw**.
- **Setup change:** **remove the placement step** from the Setup wizard (Setup = program config only: dates, meeting days, classes, teachers). Repoint the dashboard **"N students to place"** banner to the Enrollment tab.
- **Semantics (assumed — confirm):** "move" = withdraw the old enrollment (status `withdrawn`, history kept) + create a new active one; **capacity is informational** (don't block over-capacity placement).
- **Independence:** this is valuable **today**, independent of the tuition subsystem — it just promotes the existing manual placement out of Setup. Can land earlier within PR #140.
- **Students tab stays the directory** (edit details); Enrollment is the class-assignment workflow.

---

## 10. Form flexibility & sections

Registration is **section-based and config-driven**, not a fixed form. A program's registration assembles from sections that toggle on its participant / payment / pricing config:

- **Participant section** (always) — for `self`: the adult's own details; for `children`: a **repeatable** child section ("add another child").
- **Guardian / family section** — present for `children` (guardian name, **email** = family key, phone, address, authorized pickups). Omitted for `self`.
- **Class selection** — only for `per-class` programs (participant picks a priced class).
- **Class-program fields** — e.g. grade, allergies — for class-based programs; omitted otherwise.
- **Payment section** — none (free), one-time, or subscription, per the payment model.
- **Custom fields** — programs add extra questions reusing the existing **form-builder field types** (text, email, phone, number, date, dropdown, radio, multiselect, checkbox, consent); captured into the `registrationDetails` snapshot as today.

So an **adults program** = `participant: self` with no guardian/child/grade sections; a **kids program** = `participant: children` with guardian + repeatable child sections.

**Approach (option A — chosen):** add these as **new capabilities in the existing form builder**, so registration is just a (richer) form and there's one place for all form creation. New primitives to add:

- **Sections** — group fields; show/hide by config.
- **Repeatable section** — the core new primitive (the child section repeats: "add another child"). Submissions become **nested** (a participants array) rather than flat.
- **Priced option / class field** — a choice whose selection carries a price (per-class), feeding the computed total.
- **Payment model on the form** — extend `forms.payment` from one-time-only to `free | one-time | monthly recurring` (recurring reuses the membership subscription infra).
- **Registration settings on the form** — participant model, pricing model, discount tiers, target program.

**Backward compatibility:** all additive — existing flat forms keep working (one implicit section, one-time/free payment unchanged). The submission→student mapping (`createStudentFromRegistration`) iterates the repeatable participant section to create N students, reads the guardian/family section once, and snapshots each participant into `registrationDetails`.

**Build note:** this is the larger build (vs. a purpose-built flow), but it's the agreed long-term foundation. Suggest **phasing**: land the section/repeatable + payment-model primitives needed for the first programs, then generalize. Must not regress the existing simple forms.

---

## 11. Forward-compatibility (north star, not built now)

- **Family records:** promote guardian-email grouping into a real `families`/household entity owning students + Stripe customer + subscription; backfill from distinct guardian emails.
- **Parent portal:** Stripe billing portal (already used for memberships) + an OpenMasjid "your children" view (attendance, check-in log, progress).
- **Student tracking:** mostly a read view over data we already capture (attendance-records, kiosk check-in log), grouped by family.
- **In-app coupon manager:** create coupons/promo codes in OpenMasjid and push to Stripe via API — everything in one place.

---

## 12. Reused infrastructure

`membership-tiers`, `members`, `membership-checkout.ts`, `membership-webhook.ts`, `membership-stripe.ts`, `membership-aggregates.ts`, the Stripe billing portal (`/api/membership/portal`), Stripe Connect wiring. The tuition subscription mirrors the membership subscription lifecycle.

---

## 13. Open inputs to confirm (masjid)

1. **Sibling discount percentages** per child rank (2nd child __%, 3rd+ __%) — per program/form.
2. **Sunday school program-level monthly price**; **Qur'an Academy monthly price per class**.
3. Confirm **most-expensive-pays-full / discount-rolls-down** convention.
4. Confirm **Sunday school also gets the multi-child flow + sibling discount** (assumed here), just with per-program pricing.

These are data/config, not blockers for building the mechanism.

**Architecture: decided — option A** (extend the existing form builder with configurable sections + repeatable sections + priced options + payment models). One place for all form creation; build additively without regressing existing forms.

---

## 14. Out of scope (this spec)

**In scope of PR #140** (this whole effort): registration-details snapshot, grade→`gradeLevel` mapping, multi-child tuition subsystem, and the Enrollment hub. **Future / not in #140:** class-change automation, mid-stream child adds, lapsed-payment enrollment automation, the `families` entity, parent portal, and the in-app coupon manager.
