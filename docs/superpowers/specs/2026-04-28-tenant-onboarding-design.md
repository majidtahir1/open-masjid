# Tenant Onboarding Flow — Design Spec

**Status:** Approved — implementing Option C (modal + persistent banner)
**Owner:** OpenMasjid platform
**Date:** 2026-04-28
**Audience:** Product designer producing visual comps; engineering reviewing scope.

---

## 1. Overview

A guided, post-login flow that helps a freshly-provisioned tenant move from "live with platform defaults" to "feels like ours" in roughly 15 minutes — and surfaces platform features the admin would not otherwise discover.

### Goals
- Get a non-technical board member or volunteer to a credible, branded, content-populated masjid site without writing a support ticket.
- Surface five or six high-leverage features (live preview, scheduled publishing, recurring patterns, auto-generated flyers, donations categories, multiple jummah slots) inside the flow itself, in context.
- Keep the celebratory moment ("your site is ready") at the end of a real, useful 15-minute session — not gated behind a setup wizard the user dreads.

### Audience
**Primary:** non-technical board members and volunteers who have never built a website. The wizard is built around them: opinionated defaults, plain language, every screen skippable, sample content prefilled where useful.

**Secondary:** tech-savvy volunteers and platform owners. They get a permanent "Skip the tour / take me to the admin" exit on every screen and dismissable cards. They never land on the wizard against their will.

### Launch model
The public tenant site is **live and viewable from the moment the tenant is provisioned**, populated with safe, neutral defaults: a default mihrab logo mark, the platform's navy/teal/gold palette, no events listed, no donate button, no prayer strip. Onboarding never blocks the public site. Completion is a celebratory milestone the user clicks themselves, not a precondition for going live.

### Non-goals
- Not a feature gate. Nothing in onboarding prevents viewing the site, accessing collections, or inviting users.
- Not a tutorial for Payload itself. Onboarding is about *the masjid site*, not how the CMS works.
- Not migration tooling — separate flow for "import from WordPress / MadinaApps."
- Not user/role provisioning — admins inviting more admins is a separate admin task.
- ~~Not a re-run path for already-set-up tenants.~~ **Updated:** the wizard is re-launchable from the dashboard tile's collapsed "Setup complete · review →" link and from a "Re-run onboarding" link in the user menu. Re-running resets dismissed milestones to `not started` (does not delete tenant data) and re-fires the welcome modal flow.

---

## 2. Trigger and resume model

### First-login welcome dialog
The first time an `admin`-role user signs into a given tenant, a centered welcome dialog appears once with two CTAs:

> **Welcome to OpenMasjid.**
> Your site at `<slug>.openmasjid.app` is already live with our defaults. Let's make it look like your masjid.
>
> [Set up your site (about 15 min)]   [Take me to the admin]

Whether the user accepts or declines, a permanent **Setup checklist tile** appears on the Payload Dashboard view (the screen behind `/admin`). The tile is the source of truth for resuming, skipping around, and tracking progress. There are no nag banners.

### Per-user trigger
The welcome dialog is per-user, per-tenant — every admin sees it once on their own first login.

- If a second admin signs in while onboarding is still in progress, they see the welcome dialog with current progress reflected ("3 of 6 done — pick up where {first admin} left off").
- If a second admin signs in after onboarding is complete or fully dismissed, the dialog does not fire — they see only the small "Setup complete · review →" form of the dashboard tile.

### Platform owners
Platform-owner-role users never see the welcome dialog or the dashboard tile. They use the regular admin.

### Persistent dashboard tile
The tile stays visible on the dashboard until *all six milestones are either complete or explicitly dismissed*. After that, it collapses into a smaller "Setup complete · review →" link the user can dismiss permanently.

---

## 3. Information architecture — the six milestones

The dashboard tile shows six milestone cards in a fixed order. Each card is independently startable and skippable; nothing depends on the order. None block site visibility. Each milestone is itself a 1–3-screen mini-wizard.

| # | Milestone | Sub-screens | What it covers | Marked complete when… |
|---|---|---|---|---|
| 1 | **Branding** | 3 | Logo upload (PNG/SVG/JPG), favicon (auto-derived from logo by default, overridable), three brand colors (brand / secondary / accent) prefilled with platform defaults, display-font picker (curated short list). Live tenant preview on the right. | The logo has been uploaded *or* the user clicks "Use defaults — looks good." |
| 2 | **Identity & Contact** | 2 | Public display name, masjid address (geocoded — populates location/timezone automatically via existing `geocodeTenantAddress` hook), phone, public email, social links (LinkedIn / Facebook / Instagram / X / YouTube — add what you have), footer tagline. | Address is set. Everything else optional. |
| 3 | **Prayer Times** | 2 | Choose calculation method + asr madhab (sensible defaults visible). Then a deep-link button that opens the existing admin **Prayer Schedule editor** (in a drawer for Option B, in a new tab for Options A/C). The wizard waits — when *any* prayer schedule for the tenant is saved, this milestone flips to done. | A prayer schedule exists for the tenant. |
| 4 | **Your first event** | 1 | A sample event is **prefilled** ("Friday Jummah Khutbah · this Friday · 12:45 pm · main prayer hall · Br. [imam name]"). User can edit-and-save, save-as-is, or skip. Showcases the recurrence field, audience tags, flyer-mode picker. | Any event exists for the tenant *or* the user clicks "Skip — I'll add later." |
| 5 | **Hero & homepage** | 1 | Pick a hero treatment: (a) generate a hero slide from the event they just created, (b) upload a photo, or (c) keep the platform default. Surfaces the photoTone picker briefly. | A hero slide exists *or* the user keeps default. |
| 6 | **Donations** | 1 | Three radio options: native Stripe (Sadaqah / Zakat / Building Fund tabs), external link (paste LaunchGood / PayPal URL), or "Hide donate button for now." Stripe path opens a deep-link to Stripe Connect — the wizard waits for return. | A donation mode is set (including "Hide"). |

### Celebratory "Site is ready" screen
The first time all six milestones are `complete` or `dismissed` — *or* the user explicitly clicks "I'm done — finish setup" before then — a celebratory screen appears once, then the dashboard tile collapses.

The screen shows:
- The live URL (`<slug>.openmasjid.app`) with a "Visit site ↗" button.
- Three "What's next" follow-ups, surfaced as soft links — none required:
  - **Connect a custom domain** → opens the existing custom-domains admin screen.
  - **Invite another admin** → opens the existing user-invite flow.
  - **Share with your jamaa** → copy-link button + pre-filled jummah-announcement template.

### Why custom domain is intentionally NOT a milestone
Most tenants will not have DNS access on day one (the address-having board member is rarely the one who can change DNS). Surfacing it as a required step would gate the celebratory moment behind external coordination. It lives as a "What's next" link instead.

---

## 4. Cross-cutting requirements

### 4.1 "Did you know?" rail
Every milestone screen has a sidebar (or, in narrower surface treatments, a collapsible panel) showing 3–5 hints contextual to the current milestone. **Hints render as a stacked list, not a rotating carousel** — better for accessibility and scanning. Each hint is a card with a one-line headline, a one-sentence body, and an inline link to the relevant admin section.

Hint card link behavior: clicking opens the destination in a new tab so the wizard does not lose state.

**Hint catalog (designer should comp 3–5 cards per milestone).**

**Branding**
- *Live preview is one click away.* — "Preview your site →" opens the public site in a new tab and reflects color edits in real time.
- *Upload an SVG logo — we'll resize for every screen.*
- *Your colors auto-derive into the full palette — you only pick three.*
- *Custom font? Paste a Google Fonts URL in advanced.*

**Identity & Contact**
- *Address auto-fills your map and timezone.*
- *Add only the socials you actually use — empty ones are hidden.*
- *Footer tagline shows above the legal line on every page.*

**Prayer Times**
- *Three ways to keep them current: Aladhan auto-update, CSV bulk import, or manual entry.*
- *Iqamah overrides let you tweak any single day without touching the rest.*
- *Multiple jummah slots are first-class — add as many as you need.*

**First event**
- *Recurring events: write them like you'd say them. "Mondays after Isha" is a real, supported value.*
- *Flyers can be uploaded, auto-generated in your colors, or text-only.*
- *Tag for sisters, brothers, youth, families — visitors filter themselves.*
- *Schedule events to publish later.*

**Hero & homepage**
- *Featured events automatically become hero slides — no duplicate work.*
- *PhotoTone picks colors from your image to keep text readable.*
- *Drag to reorder slides any time.*

**Donations**
- *Stripe charges Stripe's fee. We don't take a cut.*
- *Sadaqah, Zakat, Building Fund — donors pick at checkout, you get a real report.*
- *Already on LaunchGood? Just paste the URL.*

### 4.2 Microcopy principles
Voice from the marketing site:
- Warm, grounded, modern. **No exclamation marks.**
- No "users," "leverage," "engagement," "monetize."
- Use Islamic vocabulary naturally: *jamaa, jummah, khutba, sadaqah, zakat, niyyah, khidmah*.
- Buttons are plain verbs: *"Save & continue"* / *"Skip for now"* / *"Use defaults — looks good"* / *"I'll add later."* Never *"Submit"* or *"Continue >"* alone.
- Empty states are encouraging, not technical: *"No events yet — that's fine. Add one when you're ready."*

### 4.3 Completion behavior
- Each milestone independently flips `done` based on the rule in §3. No "all-or-nothing" save — partial progress sticks.
- Milestone state is a per-tenant boolean set (e.g. `tenant.onboarding.{branding | identity | prayer | firstEvent | hero | donations}: 'complete' | 'dismissed' | null`).
- A "skipped" milestone shows the same as "not started" but with a subtle "you skipped this — open anyway?" affordance so it does not disappear.
- Once a milestone is `complete`, it does NOT regress automatically if a relevant field is later cleared. Engineering should not silently un-complete things based on field state.
- The dashboard tile shows `n of 6 complete`. When all 6 are `complete` or `dismissed`, the celebratory "Site is ready" screen fires once, then the tile collapses.

### 4.4 Live preview affordance
Every milestone screen has a "Preview your site ↗" link in a fixed corner that opens the public site in a new tab at the tenant subdomain. On the Branding milestone the public-site tab auto-refreshes via the existing tenant theme CSS hot-swap so color edits are visible without reload.

### 4.5 Persistent exit affordance
Every screen has a top-right "Save & exit to admin" link (text-button, not primary). Closes the wizard, preserves progress.

### 4.6 Accessibility & responsive
- Every screen is keyboard-navigable. Visible focus rings on all interactive elements.
- Color picker provides hex input + visual swatch + a contrast preview against white and black so non-designers do not pick illegible brand colors.
- Mobile (<768px): the rail collapses below the form; primary CTA stays sticky at the bottom of the viewport.
- Mobile minimum target: 375px width.

### 4.7 Localization
English-only for v1. Microcopy must be authored as replaceable strings (no hardcoded copy in components) so a future i18n pass is not a rewrite.

### 4.8 Telemetry (engineering note)
The spec does not enumerate analytics events. Engineering should fire events for: welcome-dialog accept/decline, milestone start, milestone complete, milestone skip, "Did you know?" hint click, "Preview site" click, celebratory-screen view, celebratory-screen dismiss. Concrete event schema is out of scope for this spec.

---

## 5. Surface treatment — Option C (locked)

**Decision:** Implementing Option C — first-login modal + persistent banner. Options A and B remain documented below for reference but are not being built.

### Re-run path
The wizard is launchable on demand from two places, regardless of completion state:
1. **The collapsed dashboard tile** — once setup is complete, the "Setup complete · review →" link re-opens the welcome modal.
2. **The user menu** — a "Re-run onboarding" item under the user avatar dropdown (visible to `admin` and `platformOwner` roles only).

Re-running:
- Re-fires the welcome modal flow.
- Resets all `dismissed` milestones to `not started`. Milestones already `complete` stay `complete` (the user can re-open them as "Review").
- Does NOT delete or alter any tenant data (logo, colors, events, etc.). It only resets the *checklist state*.
- Does NOT re-prefill the sample event in the First Event milestone — the user already saw / interacted with it once.

---

## 5b. Surface treatments — alternates considered

The functional spec in §§1–4 is fixed. The designer is asked to produce mockups of the **same six milestones, same fields, same hints** in three different shells, so the team can pick a winner from real comps rather than diagrams.

### Required deliverables for each option
For each of A, B, C, the designer should produce **desktop and mobile** versions of:
1. The dashboard checklist tile.
2. The first-login welcome dialog.
3. A "wide" milestone (Branding) — has logo upload + color pickers + live preview + rail.
4. A "narrow" milestone (Donations) — radio modes + conditional fields + rail.
5. The "Site is ready" celebratory screen.
6. A milestone in each of these states: not-started, in-progress, complete, skipped, blocked-waiting.

### Option A — Full-screen takeover route
**Where it lives.** A dedicated `/admin/onboarding` route that hides the Payload sidebar and replaces it with a custom shell.

**Layout.** Three-pane: left rail = the six milestones as a vertical stepper with progress dots; center = the active milestone's mini-wizard (header, fields, primary CTA, "Skip" / "Save & exit"); right = the "Did you know?" rail. Top-right corner: "Preview site ↗" + "Exit to admin." Brand-tinted background to feel different from the standard admin chrome.

**Strengths.** Maximum focus. Feels like a polished consumer product. Designer has full canvas freedom. Best mobile story (single column with sticky stepper).

**Tradeoffs.** Lives outside Payload's standard CRUD shell, so forms must be custom-built (not Payload's auto-generated forms). Requires more designer + engineering investment.

### Option B — Dashboard-embedded checklist + drawers
**Where it lives.** Inside the standard Payload admin. The Dashboard view (the screen behind `/admin`) gains a new top section: a six-card checklist grid above any existing dashboard content.

**Layout.** Each card shows milestone title, one-line description, progress dot, and a CTA ("Start" / "Continue" / "Review"). Clicking a card opens a **right-side drawer** (~640px wide) containing the mini-wizard: stepper at top of drawer, fields below, "Did you know?" rail collapsed into a tab/accordion at the drawer's bottom on narrow screens, sidebar on wide. Drawer has its own "Save & continue / Skip for now / Close" footer. The Payload sidebar stays visible behind the drawer.

**Strengths.** Feels native to the admin. Cheap to build because Payload's drawer + auto-generated collection forms can be reused for many fields. Power users get a one-glance view of what's left and ignore the rest of the admin.

**Tradeoffs.** Constrained by drawer width — wide layouts (color picker + live preview side-by-side) get tight. Less "wow" than a takeover.

### Option C — First-login modal + persistent banner
**Where it lives.** First admin login fires a centered modal with the six-tile grid. After dismissal, a thin banner ("Setup checklist — 2 of 6 done · Resume →") sits at the top of every admin page until all six are complete or dismissed.

**Layout.** Modal opens; clicking a tile opens a **larger inner modal** (the mini-wizard) layered on top, with a back-arrow to return to the grid. Rail lives in the inner modal as a small expandable section beneath the form (not side-by-side — modal width forbids it).

**Strengths.** Cheapest to build. Maximum overlay focus on first run.

**Tradeoffs.** Modals-on-modals get clunky. The persistent banner pollutes every admin screen. Less canvas for "Did you know?" rail. Designer should explicitly call out where this option struggles.

### Decision criteria for the designer's deck
When the designer presents the three options, evaluate against:
1. **First-login emotional impact** — does it feel like a thoughtful welcome or a chore?
2. **Resumability** — how easy is it to come back two days later and finish?
3. **Power-user escape** — is "ignore this entirely and use the admin normally" friction-free?
4. **Live-preview ergonomics** — can the user see their colors apply in real time without losing the wizard?
5. **Build cost** — drawer/modal reuse vs. custom shell.
6. **Mobile** — does each option survive at 375px width?

---

## 6. States, edge cases, defaults

### 6.1 Per-milestone states (designer comps each)
1. *Not started* — neutral framing, primary "Start" CTA.
2. *In progress* — partial fields filled, "Continue" CTA, progress dot half-filled.
3. *Done* — checkmark, muted card, secondary "Review" CTA. Cannot regress automatically; user must explicitly re-open and edit.
4. *Skipped* — checkmark replaced with a small "skipped" pill, same muted styling, "Open anyway" CTA.
5. *Blocked / waiting* — applies to milestones that deep-link out (Prayer Times → schedule editor; Donations → Stripe Connect). Card shows "Waiting on Stripe…" / "Add a prayer schedule to mark this complete" with a "Resume" button that re-opens the relevant editor.

### 6.2 Empty / fresh-tenant defaults
- **Logo:** a neutral mihrab silhouette mark in the brand-default navy. Visible on the live site immediately so it never looks broken.
- **Colors:** brand `var(--icp-navy-700)` `#0F1E4A`, secondary `var(--icp-teal-500)` `#28A0B4`, accent `var(--icp-gold-500)` `#D9A84E`. Preserves a credible look until the user changes anything.
- **Hero:** a single platform-default slide reading *"Welcome to {tenant name}"* with a subdued background.
- **Prayer strip:** hidden until the first schedule exists. No "5:00 AM placeholder" data shown to the public.
- **Donate button:** hidden until the donations milestone is set to anything other than "Hide."

### 6.3 Edge cases
- *User refreshes mid-mini-wizard.* Field values persist (auto-save on blur, or on each Next). Re-entering the milestone resumes at the last saved step.
- *Two admins onboard simultaneously.* Last-write-wins on the tenant record (Payload default). The dashboard tile re-reads on focus; no realtime sync needed.
- *Onboarding completed, then a field is later cleared* (e.g., admin deletes the logo). Milestone state does NOT regress to "not started" — once done, it stays done. Copy/UI may show a soft warning on the public site if engineering decides; out of scope for this spec.
- *Admin signs in for the first time on a tenant where another admin already finished onboarding.* No welcome modal; the dashboard tile shows "Setup complete · review →" only.
- *Platform owner signs into a tenant.* Onboarding UI is hidden. Welcome modal never fires for them.
- *User explicitly dismisses the celebratory screen.* It does not return.
- *Rail hint links* point to admin screens; clicked links open in a new tab so progress is not lost.

### 6.4 Out of scope for v1
- Custom-domain wizard (lives as "What's next" link, opens the existing custom-domains admin screen).
- Inviting additional admins (separate flow; surfaced as a "What's next" link).
- WordPress / MadinaApps content migration (separate flow).
- A/B testing the wizard.
- Gamification beyond the celebratory "Site is ready" screen — no streaks, no badges.
- Concrete analytics event schema.
- Localization of microcopy.
- A/B test variants of the three surface treatments — designer picks one after comps.

---

## 7. Open questions for the designer / engineering

1. **Tone of the "Site is ready" screen.** Confetti? Quranic ayah? Plain text card? Designer's call; show two variants in the deck.
2. **"Did you know?" rail rendering.** Spec recommends stacked list for accessibility; designer to confirm or counter-propose.
3. **Color picker UX.** Eyedropper from logo? Hex/preset only? Contrast check against white/black backgrounds is required; designer to propose the picker shape.
4. **Stripe Connect embedding.** Engineering to confirm whether the Stripe Connect onboarding flow can be embedded in a drawer/modal vs. forced-redirect.
5. **Welcome dialog imagery.** Photo-led, illustration-led, or pure typography? Designer to propose.
6. **First-event sample copy.** Spec uses "Friday Jummah Khutbah · this Friday · 12:45 pm · main prayer hall · Br. [imam name]" as a placeholder. Confirm wording with stakeholders before locking.

---

## 8. Glossary

- **Tenant:** a single masjid (or umbrella organization) on the OpenMasjid platform, identified by a `slug` and rendered at `<slug>.openmasjid.app`.
- **Admin:** the Payload CMS interface at `admin.openmasjid.app/admin`, where tenant admins configure their site.
- **Milestone:** one of the six top-level setup steps (Branding, Identity & Contact, Prayer Times, First event, Hero & homepage, Donations).
- **Mini-wizard:** the 1–3-screen flow inside a single milestone.
- **Rail:** the "Did you know?" sidebar of contextual hints.
- **Live with defaults:** the state of a freshly-provisioned tenant before any onboarding — public, viewable, populated with platform defaults.
