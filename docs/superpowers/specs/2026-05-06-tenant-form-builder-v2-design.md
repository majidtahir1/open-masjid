# Tenant Form Builder v2 — Design Spec

**Status:** Approved 2026-05-06 — implementation plan to follow
**Author:** Majid Tahir
**Companion v1 spec:** `docs/superpowers/specs/2026-05-05-tenant-form-builder-design.md`

## What's in v2

Four enhancements layered on top of the v1 form builder shipped in PR #67:

1. **Standalone public-form layout** — no main-site header, prayer strip, or footer. Just tenant logo + form + minimal "Powered by OpenMasjid" footer.
2. **Single-question display mode** — Typeform-style one-question-per-page navigation, opt-in per form.
3. **Form-level look-and-feel customization** — display mode, intro message, submission message, background color, background gradient.
4. **Custom Forms admin edit view** — replace Payload's default edit view with our own 3-tab layout (Build / Settings / Submissions) so the tabs work as page-level tabs instead of being trapped inside the `schema` field's render slot.

## Audiences (unchanged from v1)

- **Masjid admin** building forms — wants confidence that the form looks right and the visitor will find it easy.
- **Visitor** filling forms — wants a fast, focused, branded experience.

## v2 boundaries

**In:**
- Standalone public-form layout (route-group split)
- `displayMode: 'all-at-once' | 'one-per-page'` (default `'all-at-once'`)
- `introMessage` (richText, optional, rendered above the first field)
- `submissionMessage` (richText, optional — replaces `settings.successMessage`; backwards-compat reads both)
- `backgroundColor` (hex), `backgroundGradient` (`from`, `to`, `direction: 'vertical' | 'diagonal'`)
- Custom `FormEditView` admin component replacing Payload's default
- Page-level Build/Settings/Submissions tabs, URL-driven (`?tab=`)
- Save action wired through Payload's form context (no more disabled "Save" stub)

**Out (still deferred):**
- Conditional logic, file uploads, anonymous submissions, per-email dedupe, CAPTCHA, per-field pricing, embed-on-Pages, autosave-to-backend, signature fields, multi-image gradients, animated transitions, real-time editing/lock

## Where v2 lives

Same constraints as v1: this is part of the **OpenMasjid admin** (Payload v3 + Next 15 App Router). The custom edit view replaces only the Forms collection's edit screen — every other admin view stays untouched.

The public form site moves out of the tenant `(site)` route group into a new `(forms)` route group. URL stays `/forms/<slug>` on the tenant subdomain. Brand color and brand logo continue to come from the tenant.

## Architecture

### 1. Standalone public-form layout

- **New route group:** `src/app/(forms)/forms/[slug]/...`
  - `page.tsx` (move from `(site)/forms/[slug]/page.tsx`)
  - `PublicFormClient.tsx` (move)
  - `thanks/page.tsx` (move)
- **Delete the old paths** in `(site)/forms/...`
- **New layout** `src/app/(forms)/layout.tsx`:
  - HTML root, fonts (project's existing font setup)
  - Resolves tenant via `getCurrentTenant()`; sets `--pf-brand` and the new `--pf-bg` on the body
  - Renders a minimal top header with tenant logo (32px) + masjid name (sans-serif, 14px), centered or left-aligned per artboard 5.x
  - Renders a thin footer: "Powered by OpenMasjid · Submissions are private to your masjid"
  - **No** Header, PrayerStrip, Footer, or any tenant-site chrome
- **Middleware:** no changes — route groups don't affect URLs.

### 2. Display mode

- Add field `appearance.displayMode: 'all-at-once' | 'one-per-page'` to Forms collection (default `'all-at-once'`).
- `PublicFormClient` reads this once at mount and pre-computes the step list:
  - `'all-at-once'`: existing behavior — `schema.steps` directly drives the step list. Page breaks split steps.
  - `'one-per-page'`: flatten all non-page-break fields, treat each as its own virtual step. Page breaks are ignored in this mode.
- Progress bar continues to show `Step N of M`.
- Auto-advance hint: when `displayMode === 'one-per-page'`, show a small ghost text "Press Enter ↵ to continue" beneath the focused field. Pressing Enter on a single-line input advances if the step validates. Pressing Enter on a textarea inserts a newline (don't intercept).

### 3. Look-and-feel customization

New Payload group on Forms collection: `appearance`
- `displayMode` (select; described above)
- `introMessage` (richText) — rendered ABOVE the first field card, below the title/description block
- `submissionMessage` (richText) — replaces `settings.successMessage`. Reader preference: read `appearance.submissionMessage` if set, else fall back to `settings.successMessage`. Existing data continues to work.
- `backgroundColor` (text; hex like `#FAF9F4`)
- `backgroundGradient` (group, optional)
  - `from` (text; hex)
  - `to` (text; hex)
  - `direction` (select: `vertical | diagonal | horizontal`, default `vertical`)
  - When `from` is set, `appearance.backgroundColor` is ignored.

**Rendering:**
- The `(forms)/layout.tsx` (or the page itself) computes a CSS string for `--pf-bg`:
  - Gradient when set: `linear-gradient(<angle>, <from>, <to>)` — angles: vertical=`180deg`, horizontal=`90deg`, diagonal=`135deg`
  - Else solid color when set
  - Else default `#f7f8fa` (current default)
- `.om-pf-shell` background uses `var(--pf-bg, #f7f8fa)`.

**Submission message rendering:**
- `PublicFormSuccess` reads `form.appearance.submissionMessage` first, falls back to `form.settings.successMessage`. If both are absent, renders a default "We received your submission" line.

### 4. Custom Forms admin edit view

- **New file:** `src/admin/forms/FormEditView.tsx` (`'use client'`)
- **Wire-up:** in `src/collections/Forms.ts`, set
  ```ts
  admin: {
    components: {
      views: {
        edit: {
          default: { Component: '/src/admin/forms/FormEditView#default' },
        },
      },
    },
  }
  ```
- Remove `admin.components.Field` from the `schema` field; FormEditView mounts the builder directly.
- **FormEditView layout:**
  - Top metadata bar: form title (inline-editable via `useField('title')`), status pill, slug (mono, with public URL preview), Save button (wired to Payload's form processing context — see below), View live button.
  - Below: 3 tabs — Build / Settings / Submissions — driven by `?tab=` query param.
    - **Build tab:** mounts `<FormBuilderFieldClient>` directly. Uses `useField('schema')` for read/write.
    - **Settings tab:** mounts `<SettingsPanel>` (existing component). Full page width. Sub-nav still on the left within the panel.
    - **Submissions tab:** renders a small `<SubmissionsTab formId={doc.id} />` component that lists the most recent 10 submissions in a compact table and links to `/admin/collections/form-submissions?where[form][equals]=<id>` for the full list.
- **Save wiring:** use Payload v3's `useForm()` from `@payloadcms/ui`. Hook into `submit()` (or equivalent — verify in Payload docs). Disable Save when not dirty; show "Saving…" while in flight.
- **Old toolbar deletion:** `FormToolbar.tsx` is replaced by the metadata bar inside `FormEditView`. Delete the old file.

### Form schema (after v2)

```ts
{
  title, slug, status, description (richText),
  schema: json,
  settings: { submitButtonLabel, capacity, closedMessage, notificationEmails, sendConfirmation, confirmationSubject, confirmationBody, successMessage(deprecated, read fallback) },
  appearance: { displayMode, introMessage, submissionMessage, backgroundColor, backgroundGradient: { from, to, direction } },
  payment: { ...unchanged... },
  tenant
}
```

## Migrations

One new Payload migration adds the `appearance` group columns. `settings.successMessage` stays in place for backwards compatibility — no destructive change.

## File map

**New:**
- `src/app/(forms)/layout.tsx`
- `src/app/(forms)/forms/[slug]/page.tsx` (moved)
- `src/app/(forms)/forms/[slug]/PublicFormClient.tsx` (moved)
- `src/app/(forms)/forms/[slug]/thanks/page.tsx` (moved)
- `src/admin/forms/FormEditView.tsx`
- `src/admin/forms/SubmissionsTab.tsx`
- `src/admin/forms/settings/sections/Appearance.tsx` — new section in the settings sub-nav for the appearance fields

**Modified:**
- `src/collections/Forms.ts` — add `appearance` group; remove `admin.components.Field` from schema; set `admin.components.views.edit.default.Component`
- `src/app/(site)/forms/[slug]/...` — DELETED (moved to `(forms)`)
- `src/components/PublicFormSuccess.tsx` — read appearance.submissionMessage with fallback
- `src/styles/public-forms.css` — add `--pf-bg` consumption; minor adjustments to header/footer for standalone layout
- `src/admin/forms/settings/SettingsNav.tsx` — add "Appearance" item
- `src/admin/forms/FormToolbar.tsx` — DELETED (replaced by FormEditView's metadata bar)

**Generated:**
- `src/migrations/<timestamp>_forms_appearance.ts` — adds appearance columns
- `src/payload-types.ts` — regenerated

## Testing

- Unit: `appearance` interpolation (computeBackgroundCss, displayMode flatten), submission message fallback resolution
- Integration: existing v1 tests must still pass; add tests for the displayMode flatten path and the appearance field in submissions / form rendering edge cases
- Manual:
  - Open a form with `displayMode='all-at-once'` — same as v1
  - Switch to `'one-per-page'` — each non-page-break field becomes own step
  - Set background color — public form shows it
  - Set gradient — overrides color
  - Set intro message — renders above first step
  - Set submission message — renders on success
  - Edit view in admin: Build / Settings / Submissions tabs swap content as expected; Save commits; View live opens correct host

## Out of scope (recap)

- Conditional logic
- File uploads
- Anonymous submissions toggle (email still optional, not anon)
- Per-email dedupe
- CAPTCHA
- Per-field pricing
- Embed on Pages
- Background images / video / multi-stop gradients
- Animations between questions in one-per-page mode (just basic fade-in is acceptable; nothing fancy)
- Drag-to-reorder of step ordering separate from field reordering (already handled in v1)

## Reference

- Companion v1 spec: `docs/superpowers/specs/2026-05-05-tenant-form-builder-design.md`
- v1 plan: `docs/superpowers/plans/2026-05-05-tenant-form-builder.md`
- Designer's package: `design_handoff_forms_unpacked/design_handoff_forms/`
