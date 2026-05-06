# Tenant Form Builder — UX Design Brief

**Status:** Draft for design comps
**Author:** Majid Tahir
**Date:** 2026-05-05
**For:** UX designer producing visual comps

---

## What we're building

A form builder inside OpenMasjid that lets a masjid admin create a form (RSVP, class registration, volunteer signup, survey) with a visual drag-and-drop interface, publish it at a shareable URL, and collect submissions. Visitors fill out the form on the masjid's public site. Optional fixed-price payment via Stripe Checkout.

Think Jotform / Typeform, but simpler, scoped to what masajid actually need, and styled to fit the OpenMasjid admin it lives inside.

## Where this feature lives

**This is not a standalone product.** It's a new section inside the existing **OpenMasjid admin** — the same back-office area where masjid admins already manage their site content (pages, events, prayer times, donations, members, etc.). A new "Forms" item gets added to the admin's left navigation, alongside the existing collections.

A few things follow from that:

- The admin shell — left sidebar nav, top bar with breadcrumbs, user menu, save/publish controls — is **already designed and shipped**. The designer should treat it as fixed and design only the working area inside it. The shell uses Payload CMS (the underlying admin framework) and follows its conventions; the form builder needs to feel native to the rest of the OpenMasjid admin, not like a third-party tool bolted on.
- The masjid admin reaches the builder by clicking "Forms" in the admin nav, then "Create form" — same pattern as Pages, Events, etc.
- Submissions live in the same admin too (a sibling list), so the designer should style the submissions list and detail views to match how Events / Donations / Members lists already look.
- The **public** form (what visitors fill out) lives on the masjid's public site, which has a totally different visual system (the tenant's brand, the public site's header/footer/prayer strip). Two distinct visual contexts to comp: admin (OpenMasjid admin styling) and public (masjid's branded site).

A designer onboarding screenshot pack of the existing OpenMasjid admin and a sample public site is available — request from engineering.

## Audiences

| Audience | Skill level | What they need |
| --- | --- | --- |
| **Masjid admin** (form author) | Volunteer-grade. Probably has built a Google Doc but never a SaaS form. Comfortable with WordPress at best. | A builder that's obvious without a tutorial. No empty canvas. Defaults that work. |
| **Visitor** (form filler) | Anyone in the community. Phone-first. Often older. Often non-native English speakers. | A form that loads fast, looks like part of the masjid's site, doesn't ask anything weird, and gives clear feedback when something's wrong or done. |

## Primary use cases

The builder must comfortably support these without bespoke modes:

1. **Event RSVP with capacity** — iftar, halaqa, fundraiser dinner. "How many will attend?" with a per-form capacity ceiling.
2. **Class / program registration with optional fee** — kids' Quran, Sunday school. May charge a flat registration fee.
3. **Volunteer signup** — Ramadan crews, cleanup, security. Multi-select roles, contact info.
4. **Surveys / feedback** — short answer, scaled choice, open-ended.

(All four are flat forms; some span multiple steps for length, none use conditional logic in v1.)

## v1 boundaries

**In:**

- Visual builder with drag-to-reorder, click-to-edit
- Field types: short text, email, phone, long text, number, date, dropdown, radio, multi-select, checkbox group, single consent checkbox, page break
- Multi-step forms via page-break field
- Per-form settings: title, description, success message, submit button label, capacity limit, notification email recipients, optional confirmation email to submitter
- Optional fixed-price Stripe Checkout (one price per form, applied per submission)
- Public shareable URL: `yourmasjid.org/forms/<slug>`
- Admin submissions viewer + CSV export
- Honeypot anti-spam

**Out (intentionally deferred):**

- Conditional logic ("if X then show Y")
- File / photo uploads
- Anonymous submissions (email is always required in v1)
- Per-email dedupe ("one RSVP per person")
- CAPTCHA / Turnstile
- Per-field pricing or quantity-based totals
- Embedding a form inline on a Page (only standalone URLs in v1)
- Form templates / starter library
- Branching, calculations, signatures

These are real future requirements. The design should leave room — but **don't** mock them.

## Brand constraints

- Reuse the masjid's brand colors and typography (logo, three brand colors, font — already configured per-tenant)
- The public form lives under the masjid's existing site shell (header, footer, prayer strip)
- The admin builder lives inside the existing **OpenMasjid admin chrome** — left sidebar, top bar, breadcrumbs, save/publish controls. Designer should treat that chrome as fixed; design only the working area inside it. (See "Where this feature lives" above.)
- Existing OpenMasjid type tokens: Fraunces (display), Inter (body), Amiri (Arabic). Brand neutrals: cream `#FAF9F4`, navy `#1B3358`, night `#0E1B2C`, gold `#C9A45A`.

## Screen inventory (what to comp)

### Admin — building

1. **Forms list page** (Payload collection list)
   - Empty state: "No forms yet. Create your first form."
   - Populated: table — title, status (draft/published), submissions count, last edited, public URL
2. **New form** (or edit existing) — **the builder**, layout B (canvas-first, single column)
   - Empty canvas state with a primary "+ Add field" CTA centered
   - Populated canvas: stack of field cards with hover toolbar (drag handle, edit ✎, delete)
   - "+ Add field" popover/menu listing field types with icon + label
   - Field properties slide-over (right side) — fields: label, placeholder, helper text, required toggle, options editor (for select/radio/multi-select), validation hints
   - Step header — "Step 1 of N", inline-editable step name, "Add step" affordance
   - Top action bar: form title (inline-editable), draft/published toggle, "View public form" link, Save button
   - Sidebar (Payload's native style): notifications recipients, capacity, payment toggle + price + currency, success message editor
3. **Submissions list** (filtered to one form)
   - Table — submitted at, submitter email, status (received / paid / cancelled), preview of first 1–2 fields
   - Row click → submission detail drawer / page
   - "Export CSV" button
4. **Submission detail**
   - All fields rendered with their answers
   - Status, submitted timestamp, payment info if applicable
   - "Resend confirmation email" action

### Visitor — filling

5. **Form landing** (`/forms/<slug>`)
   - Form title, description, the form fields
   - Single-step: all fields visible, single submit button
   - Multi-step: progress indicator (Step 1 of 3 + bar), Next button, current step's fields
   - Validation states (inline error per field, summary if needed)
6. **Form full / closed** state — when capacity is reached or form unpublished. Configurable message.
7. **Submitting** — pending state on the submit button (disabled, spinner)
8. **Success** — friendly thank-you page with the configured success message; if confirmation email is on, mention "we've emailed you a copy"
9. **Payment redirect** — brief interstitial before Stripe Checkout (or seamless redirect)
10. **Payment cancelled / returned** — back to the form, fields preserved, gentle "looks like the payment was cancelled — try again" notice

### States to remember

For every screen above, comp at minimum: default, hover, focus, error, empty, loading. Plus mobile (375px) and desktop (1280px) for visitor screens. Admin screens: comp at 1280px (Payload admin's working width).

## Field-type visual inventory

The designer should comp how each field type *looks on the public form* and *looks as a card in the builder canvas*:

- Short text, email, phone, number, date — all single-line inputs
- Long text — textarea
- Dropdown — native select
- Radio group — vertical stack
- Multi-select — multi-checkbox stack (not a chip multi-select; phone-friendly)
- Checkbox group — multiple independent checkboxes
- Consent — single checkbox with rich label (e.g. "I agree to the masjid's media release policy")
- Page break — divider in the builder canvas; not visible on the public form (just splits steps)

Each public field needs: label, optional helper text, required indicator, error message slot.

## Key flows to walk through in the comps

1. **Admin builds an RSVP form with capacity** — opens builder, names form, adds name/email/phone/attendees, sets capacity to 80, sets notification email, publishes, copies public URL.
2. **Admin adds a paid registration form** — same as above + flips payment on, sets price to $40 USD, edits success message to mention "you'll receive a receipt".
3. **Visitor fills a 2-step form on mobile** — sees step 1, fills, taps Next, validation catches a missing field, fixes, advances, submits, sees success.
4. **Visitor hits a full RSVP** — lands on form URL, sees the closed-message state instead of the form.
5. **Admin reviews submissions** — opens the form's submissions list, exports CSV, opens one submission to see the answers.

## Tone

- Plain English. No "Submit your application now!" or other hype.
- Quiet UI. Generous whitespace. No celebratory animations on submit beyond a checkmark.
- Hijri date alongside Gregorian where dates appear publicly (existing platform pattern).
- Right-to-left readiness in the field labels (some masajid have Arabic-language forms in the future).

## Accessibility

- WCAG AA contrast everywhere
- Native HTML form elements wherever possible (real `<input>`, `<select>`, etc.)
- Visible focus states on every interactive element in the builder and the public form
- Builder must be keyboard-navigable (drag-and-drop has a keyboard fallback for reordering)
- Field labels are always visible, not placeholder-only
- Errors announced to screen readers on submit attempts

## Open questions for design

- Where does "Save" live in the builder — sticky top, sticky bottom, or only on blur? (Payload convention is top.)
- How do we make the builder discoverable to a volunteer who's never seen one? Empty-state copy + a single example field pre-inserted on first form?
- Should the public form show the masjid's logo + name above the form, or just blend into the existing site header?
- Visual style for the "page break" affordance in the builder — divider line, "fold" icon, "step header" card?

## Out of scope for design comps

- Email templates (notification + confirmation) — separate brief, can reuse the existing transactional template
- Stripe Checkout screen styling (we don't control it)
- Conditional logic UI (deferred)
- File-upload UI (deferred)

## Design package addendum (2026-05-05)

The UX designer delivered comps in `OpenMasjid_forms_design.zip` (unpacked: `design_handoff_forms_unpacked/design_handoff_forms/`). 13 hi-fi artboards covering admin and public surfaces. **The designer's package supersedes any conflict with the brief above.** Read `design_handoff_forms_unpacked/design_handoff_forms/README.md` for the full handoff.

Notable refinements / additions over the original brief — these are **in v1**:

- **Form-level navigation tabs:** Build / Settings / Submissions (sticky toolbar in the editor).
- **Properties drawer tabs:** General / Validation / Logic. Logic tab renders but its content is disabled in v1 (placeholder for future conditional logic).
- **"Show on review step"** toggle in field properties — render but disable in v1 (no review step yet).
- **Settings sub-nav:** Basics / Submission limits / Notifications / Payment / Confirmation / Webhooks / Embed & share. Webhooks and Embed-share are net-new vs the brief; ship at least the page shells in v1, full functionality can phase per the plan.
- **Field name (slug)** auto-generates from the label; editable, with a warning when changed (will break existing webhook/CSV consumers).
- **Submission statuses:** `new` / `reviewed` / `archived` plus payment status. Submissions list has filter + Export CSV; submission detail has Reply / Export / Mark reviewed actions and side cards for Status + Payment.
- **Payment block reshape:** designer changed "single fixed price" to **suggested-amount tiles + optional custom amount** (mirrors the donation widget). Update the data model: `payment` has `mode: 'fixed' | 'suggested'`, `suggestedAmounts: number[]`, `allowCustomAmount: boolean`, `priceCents` (used when `mode === 'fixed'`).
- **Stripe pattern locked in:** Hosted Checkout (redirect), **Stripe Connect direct charges** to the tenant's connected account. No Elements, no platform-and-transfer.
- **Submission states for payments:** `pending_payment` → `paid` (Checkout success) | `expired` (no callback). Source of truth = `checkout.session.completed` webhook; success-URL handler is best-effort UX only.
- **Public form** uses tenant brand color via CSS var `--pf-brand` (fallback to a teal default). **Admin chrome stays neutral navy** — brand color does NOT propagate into admin.
- **Success page** renders submitter's first name, optional Stripe receipt strip (amount + last4 + payment_intent), and "Add to calendar" + "Back to {masjidName}" actions.

Tokens, type, spacing, radii, shadows: take from `colors_and_type.css` and `forms.css` in the package. Icons in the package are Lucide-conformant — import from the existing `lucide-react` instead of inlining the JSX.

## Reference

- Existing tenant theming: every tenant picks logo + 3 colors + 1 font; the system derives the rest of the palette
- Existing public-site shell: header with prayer strip, branded footer
- Existing admin chrome: Payload v3 admin (sidebar nav, top breadcrumbs)
- Brand assets: `public/brand/openmasjid-favicon.svg`; full set in `public/brand/`
- Companion technical design (data model, endpoints, builder architecture) lives in this repo's git history alongside this file once implementation begins
