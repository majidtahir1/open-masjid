---
name: open-masjid-forms
description: Use when the user wants to create, edit, or check signup/registration forms in OpenMasjid via natural language — "make a signup form", "build a registration form", "add a field to the form", "open / close the form", "how many people signed up / RSVP'd?", "who registered?", "what's the form's submission count?". OpenMasjid (Payload CMS) specific; covers forms:write (forms) and forms:read (forms + read-only submissions). For building a form from a flyer image, use flyer-to-event.
---

# OpenMasjid Forms & Submissions

Create and manage signup/registration forms, and read their submissions (RSVP counts, who registered), by chatting. Talks to a running OpenMasjid instance via Payload's REST API with a scoped API key.

**REQUIRED FIRST:** read `../_shared/openmasjid-api.md` for auth, session bootstrap, the tenant rule, Lexical richText, the diff-then-confirm gate, and error handling.

**Scopes:** `forms:write` (create/edit forms), `forms:read` (read forms **and** their submissions). Submissions are **read-only** even with a write key — they're created only by the public submit endpoint.

**Boundary with flyer-to-event:** that skill builds a form *from a flyer image* (often paired with an event). Use this skill for forms created/edited by description, and for all submission-reading.

## Collection: `forms`

| Field | Type | Notes |
|---|---|---|
| `title` | text | Required. |
| `status` | select | `"draft"` (default) \| `"published"` \| `"closed"`. **This is the publish control — NOT `_status`, and no `?draft=true`.** Only `published` accepts submissions; `closed` shows the closed message. |
| `slug` | text | Auto-generated from title if omitted. Public page is `/forms/<slug>` (on the tenant subdomain). |
| `description` | richText (Lexical) | Optional, shown above the form. Lexical object, never a string. |
| `schema` | json | Required. The form definition — `{ steps: [{ id, title?, fields: [...] }] }`, min 1 step. See field rules below. |
| `settings` | group | `capacity` (number, auto-closes when reached), `successMessage` (richText), `submitButtonLabel`, `closedMessage`, `notificationEmails: [{email}]`, `sendConfirmation`, `confirmationSubject`, `confirmationBody` (plain text, supports `{{name}}`). |
| `payment` | group | See payment block. Omit unless collecting money. |
| `tenant` | relationship | Server-side — never send. |

### Field schema rules (server validates with Zod — violations 400/422)

Field `type` is one of exactly:
`short-text` · `email` · `phone` · `long-text` · `number` · `date` · `dropdown` · `radio` · `multiselect` · `checkbox-group` · `consent` · `page-break`

Every field (except `page-break`) needs `id`, `type`, `name`, `label`. Plus:
- `name` must match `^[a-z][a-z0-9_]*$` and be **unique across all steps**.
- `required` defaults false. **A `consent` field must have `"required": true`** (literal — enforced).
- `number` may add `min` / `max`.
- `dropdown` / `radio` / `multiselect` / `checkbox-group` **require** `options: [{value, label}, ...]` (min 1 each).
- `page-break` carries only `id` + `name` (splits into multiple steps/pages).

### Payment block (include only if collecting money)

```jsonc
"payment": {
  "enabled": true,
  "mode": "fixed",            // "fixed" (set price) | "suggested" (donation-style)
  "priceCents": 2500,         // fixed only; cents = dollars × 100
  "currency": "usd",          // usd | cad | gbp
  "description": "Eid Dinner ticket"
}
```

Suggested-donation variant: drop `priceCents`; use `"mode": "suggested"`, `"suggestedAmountsCents": [{"amount": 1000}, {"amount": 2500}]`, `"allowCustomAmount": true`. Payment only actually charges if the tenant has Stripe Connect configured — tell the user; this skill doesn't set that up. `priceCents` is one flat charge per submission, not per-attendee.

## Creating a form (`POST /api/forms`)

Keep it lean — name/email/phone plus only what's asked. Example "registration form for the youth retreat, ask for grade and a dietary note":

```jsonc
{
  "title": "Youth Retreat 2026 — Registration",
  "status": "published",
  "settings": { "capacity": 60 },
  "schema": { "steps": [{ "id": "s1", "fields": [
    { "id": "f1", "type": "short-text", "name": "name",    "label": "Full name", "required": true },
    { "id": "f2", "type": "email",      "name": "email",   "label": "Email",     "required": true },
    { "id": "f3", "type": "phone",      "name": "phone",   "label": "Phone",     "required": false },
    { "id": "f4", "type": "dropdown",   "name": "grade",   "label": "Grade",     "required": true,
      "options": [ {"value":"9","label":"9"}, {"value":"10","label":"10"}, {"value":"11","label":"11"}, {"value":"12","label":"12"} ] },
    { "id": "f5", "type": "long-text",  "name": "dietary", "label": "Dietary notes", "required": false }
  ] }] }
}
```

Default `status` to `"draft"` unless the user wants it live now. Diff-preview the form (fields + payment line if any) and get a yes before POSTing. After create, report the admin URL `/admin/collections/forms/<id>` and the public `/forms/<slug>` on the **tenant subdomain**.

## Editing a form (`PATCH /api/forms/<id>`)

- Open / close / publish: `{ "status": "published" }` (or `"closed"` / `"draft"`).
- Add a field: PATCH the **whole** `schema` with the new field appended (keep existing ids/names; new `name` must be unique + match the regex).
- Set a cap: `{ "settings": { "capacity": 100 } }`.

Resolve the id from a read first. Show the diff and get a yes. Note that changing field `name`s can orphan existing submission data keyed by the old name — warn before renaming.

## Reading submissions (RSVP counts, who signed up)

Submissions live in `form-submissions` (read-only). First resolve the form id (by title): `GET /api/forms?where[title][like]=<keyword>`.

**Count** ("how many signed up?") — `limit=0` returns just `totalDocs`:
```
GET /api/form-submissions?where[form][equals]=<form-id>&limit=0
```

**Who / summary**:
```
GET /api/form-submissions?where[form][equals]=<form-id>&limit=100&sort=-submittedAt&depth=0
```
Useful fields per submission: `submitterName`, `submitterEmail`, `data` (the answers, keyed by field `name`), `status` (`new`/`reviewed`/`archived`), `paymentStatus` (`na`/`pending_payment`/`paid`/`expired`), `amountCents`, `submittedAt`. For "how many paid?", add `&where[paymentStatus][equals]=paid&limit=0`. Compare a count against `settings.capacity` to answer "how many spots left?".

You **cannot** create/edit/delete submissions via API (read-only) — if asked, say so and point to the admin UI for status changes.

## Common mistakes

- Using `_status` / `?draft=true` for forms → wrong. Forms publish via the `status` field.
- A `name` that breaks `^[a-z][a-z0-9_]*$`, or duplicate `name`s across steps → 400.
- An option-bearing field without `options`, or a `consent` field without `required: true` → 400.
- `description` / `settings.successMessage` as a string → admin crash. Lexical object or omit.
- Sending `tenant` → ignored; the hook sets it.
- Trying to write submissions → not permitted; they're read-only.
