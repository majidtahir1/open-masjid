# Submissions Spreadsheet View — Design

**Date:** 2026-06-10
**Status:** Approved

## Problem

Viewing form submissions today means using Payload's default list table (meta columns
only — submitter, status, payment) with a filter toolbar bolted on top. You can't see
the actual answers without opening each submission one by one. The desired experience
is JotForm Tables: pick a form, see every submission as a row with one column per form
field, and sort/filter columns like a spreadsheet.

## Decisions (from brainstorming)

1. **Entry point:** a "Submissions" tab on each form's edit view. The top-level
   "Form Submissions" nav item is removed.
2. **Row click:** opens a slide-over detail panel (no navigation).
3. **Filtering:** type-aware per-column filters + global search.
4. **Table tech:** `@tanstack/react-table` (headless), styled to match the admin theme.

## Design

### Navigation & entry point

- `FormSubmissions` collection gets `admin.hidden: true`. The collection, REST API,
  access control, hooks, and CSV/status endpoints are untouched — only the nav item
  and default list UI go away. The old `SubmissionsList` toolbar component and the
  full-page `SubmissionDetail` view are deleted.
- The **Forms list** becomes the landing page. Two new columns:
  - **Submissions** — total count, with a badge showing the count of `status: new`.
  - **Last submission** — most recent `submittedAt`, or "—".
  - Implemented as `ui` fields with custom Cell components that fetch stats
    client-side (shared per-form request cache). Virtual fields with afterRead
    hooks were rejected: they would run count queries on every form read,
    including public form-page renders.
- A **Submissions tab** is registered as a Payload custom edit-view tab on the Forms
  collection at `/admin/collections/forms/:id/submissions`, alongside the existing
  form editor. Tenant scoping is inherited from existing access control: staff can
  only open forms (and therefore submissions) belonging to their tenant.

### Spreadsheet view (per form)

**Columns**, left to right:

1. **Submitted** (date+time) — default sort, newest first.
2. One column per schema field, in form order (page-break pseudo-fields excluded).
3. **Status** (new / reviewed / archived pill — reuses existing pill styling).
4. **Payment** — only rendered when the form has payments enabled.

**Value rendering:** multiselect/checkbox-group → comma-separated; consent → Yes/No;
null/missing → "—"; long-text truncated to one line (full value in the slide-over).

**Toolbar:** global search input (substring match across all columns), status filter
pills (All / New / Reviewed / Archived), active-filter chips with a "clear all", and
the existing **Download CSV** button calling `/api/forms/[slug]/submissions.csv`.

**Column header menu** ("⋮"): Sort ascending, Sort descending, Filter. Filter UI is
type-aware:

| Field type | Filter |
|---|---|
| short-text, long-text, email, phone | contains (text input) |
| dropdown, radio, multiselect, checkbox-group | checklist of the field's options |
| number, date, submitted-date | min–max range |

A column with an active filter shows a badge on its header.

**Data handling:** fetch all submissions for the form through the existing
tenant-scoped REST API (`/api/form-submissions?where[form][equals]=:id`), paginating
internally, hard-capped at 2,000 rows (a notice is shown if the cap is hit). Sorting
and filtering run client-side via TanStack Table. Current volumes are tens of
submissions per form, so client-side is instant; the cap is a guardrail.

### Slide-over detail

Clicking a row opens a right-hand drawer over the table:

- All answers with field labels (form-schema order).
- Status toggle (Mark reviewed / Mark as new) — reuses the existing
  `PATCH /api/forms/submissions/[id]/status` endpoint; the table row updates in place.
- Payment details (amount, status, Stripe ids) when present.
- Reply `mailto:` link to the submitter.
- Esc / click-outside / close button dismisses; table scroll, sort, and filters persist.

### Styling & testing

- CSS modules + Payload theme CSS variables (dark/light safe), lucide-react icons —
  the established pattern in `src/admin/forms/`.
- Unit tests for the pure logic: schema → column definitions, value formatting, and
  the type-aware filter predicates. Existing CSV and status-endpoint tests unchanged.

## Out of scope

- Column hide/reorder/resize/freeze, summaries, charts (JotForm features the user
  explicitly doesn't need).
- Server-side pagination/sorting (revisit if a form ever exceeds the 2,000-row cap).
- Editing submission answers (submissions remain read-only by design).
