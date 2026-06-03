---
name: flyer-to-event
description: Use when the user wants to turn an event flyer or poster image into an OpenMasjid event and/or RSVP signup form — mentions "flyer", "poster", "make this an event", "create an RSVP/signup from this", or setting up event registration (with payment) from a flyer. OpenMasjid (Payload CMS) specific.
---

# Flyer → Event + RSVP Form

## Overview

Read an event flyer image with vision, then create a **draft** Event and a **draft** RSVP Form in OpenMasjid via its scoped REST API. If the flyer shows a price, wire up payment on the form. Always preview the parsed result and get explicit confirmation **before** writing anything.

This is OpenMasjid-specific (Payload CMS 3.x). It calls the API with an API key — it does not touch the database or repo directly.

## Prerequisites

- `OPENMASJID_API_KEY` — a Payload API key whose user is `admin`/`platformOwner` in the target tenant and carries the `events:write` and `forms:write` scopes — plus `media:write` if the user wants the **actual uploaded flyer** shown on the event page (step 4). **Abort with a clear message if unset or empty.**
- `OPENMASJID_BASE_URL` — default `http://localhost:3000`. This is the **API** base (bare host is fine; the key carries the tenant). Public links you print/embed need the tenant **subdomain** — see the public-URL gotcha.

Auth header on every call (Payload's API-key format, easy to get wrong):
`Authorization: users API-Key $OPENMASJID_API_KEY`

## Workflow

1. **Preflight.** Confirm `OPENMASJID_API_KEY` is set. Sanity-check connectivity + scope:
   ```bash
   curl -sS -o /dev/null -w "%{http_code}\n" \
     -H "Authorization: users API-Key $OPENMASJID_API_KEY" \
     "${OPENMASJID_BASE_URL:-http://localhost:3000}/api/events?limit=0"
   ```
   `200` = good. `401/403` = key/scope/tenant problem — stop and tell the user. Connection refused = dev server not running.
2. **Parse the flyer.** Extract: title, start/end date-time, location, a one-line blurb + fuller description, capacity, any custom questions (e.g. dietary), and pricing. **If a required detail is missing or ambiguous (no date, unreadable price, unknown timezone), ASK the user — never guess.**
3. **Ask: which event visual?** Ask the user whether the event page should show **(a) the actual uploaded flyer image**, or **(b) an auto-generated template card** from the title. Default to (b) if they don't care. Option (a) requires the flyer's local file path (e.g. the image they dropped in — Claude Code exposes it under `~/.claude/image-cache/...`) and the `media:write` scope.
4. **Diff-then-confirm (mandatory gate).** Print a human-readable preview of BOTH artifacts — event fields (incl. which visual), form fields, and the payment line ("$25.00 fixed, USD") — and ask for explicit "yes". Write nothing before confirmation.
5. **Create the Form first** (`POST /api/forms`), capture `doc.id` and `doc.slug`.
6. **If visual = uploaded flyer, upload it now** (`POST /api/media`, multipart) and capture the new media `doc.id`. See "Media upload". Skip this step for the template card.
7. **Create the Event** (`POST /api/events?draft=true`): set `displayMode` per the choice (`image` + `flyerImage: <media id>`, or `template` + `templateVariant`), and put the form's **public** URL into the description (there is no event↔form relationship field — the URL is the link). Use the tenant subdomain for that URL (see public-URL gotcha).
8. **Report**: form admin URL `/admin/collections/forms/<id>` + public `/forms/<slug>`; event admin URL `/admin/collections/events/<id>`. Remind the user both are **drafts** awaiting publish.

Build each JSON body with the Write tool into a temp file and send with `curl ... -d @/tmp/<name>.json` — don't inline complex JSON in the shell.

## Media upload (only for the uploaded-flyer option)

Upload the flyer to the `media` collection, then reference the returned id as the event's `flyerImage`. Multipart, not JSON — the file field must be named `file`:

```bash
curl -sS -X POST "${OPENMASJID_BASE_URL:-http://localhost:3000}/api/media" \
  -H "Authorization: users API-Key $OPENMASJID_API_KEY" \
  -F "file=@/Users/you/.claude/image-cache/<id>/1.png" \
  -F "alt=Eid Dinner 2026 flyer"
```

Response is `{ "doc": { "id": <N>, "url": "...", ... } }` — use `doc.id` as the event's `flyerImage`. `tenant` is set server-side; don't send it. A `403` here means the key lacks `media:write`.

## Form payload (`POST /api/forms`)

```jsonc
{
  "title": "Eid Dinner 2026 — RSVP",
  "status": "draft",                       // Forms draft = status field. NOT _status.
  "settings": { "capacity": 150 },         // omit if no capacity on the flyer
  "schema": {
    "steps": [{
      "id": "s1",
      "fields": [
        { "id": "f1", "type": "short-text", "name": "name",      "label": "Full name",        "required": true },
        { "id": "f2", "type": "email",      "name": "email",     "label": "Email",            "required": true },
        { "id": "f3", "type": "phone",      "name": "phone",     "label": "Phone",            "required": false },
        { "id": "f4", "type": "number",     "name": "attendees", "label": "Number attending", "required": true, "min": 1 }
        // + flyer-specific fields only (e.g. a "dietary" dropdown). Keep it lean.
      ]
    }]
  },
  "payment": {                             // include ONLY if the flyer shows a price
    "enabled": true,
    "mode": "fixed",                       // "fixed" for a set ticket price
    "priceCents": 2500,                    // cents (dollars × 100)
    "currency": "usd",                     // usd | cad | gbp — infer from symbol, default usd
    "description": "Eid Dinner 2026 ticket"
  }
}
```

Form-schema rules (server validates with Zod — violations return `400/422`):
- Field `name` must match `^[a-z][a-z0-9_]*$` and be **unique** across all steps.
- Field types: `short-text`, `email`, `phone`, `long-text`, `number`, `date`, `dropdown`, `radio`, `multiselect`, `checkbox-group`, `consent`, `page-break`. The option-bearing types (`dropdown`/`radio`/`multiselect`/`checkbox-group`) need `options: [{value,label}, ...]` (min 1).
- A `consent` field must have `"required": true` (literal).
- **Suggested-donation pricing:** drop `priceCents`; use `"mode": "suggested"`, `"suggestedAmountsCents": [{"amount": 1000}, {"amount": 2500}]`, `"allowCustomAmount": true`.

## Event payload (`POST /api/events?draft=true`)

```jsonc
{
  "_status": "draft",                      // Events draft = ?draft=true query + _status body
  "title": "Eid Dinner 2026",
  "shortDescription": "Community Eid dinner — RSVP required. $25/person.", // plain text (textarea)
  "description": { "root": {               // richText (Lexical) — OBJECT, never a string. See below.
    "type": "root", "version": 1, "direction": null, "format": "", "indent": 0,
    "children": [
      { "type": "paragraph", "version": 1, "direction": null, "format": "", "indent": 0,
        "children": [ { "type": "text", "version": 1, "text": "Catered halal dinner." } ] },
      { "type": "paragraph", "version": 1, "direction": null, "format": "", "indent": 0,
        "children": [ { "type": "text", "version": 1, "text": "RSVP: http://localhost:3000/forms/eid-dinner-2026-rsvp" } ] }
    ]
  } },
  "startDate": "2026-04-11T18:30:00-05:00", // ISO 8601 WITH offset — see timezone gotcha
  "endDate":   "2026-04-11T21:00:00-05:00",
  "location": "Main Prayer Hall",
  // Visual — pick ONE per step 3:
  "displayMode": "image", "flyerImage": 42 // (a) uploaded flyer; flyerImage = media doc id from step 6
  // OR (b) auto-branded card:  "displayMode": "template", "templateVariant": "default"
}
```

**richText fields are Lexical editor-state objects, never plain strings.** Passing a string crashes the admin ("The value passed to the Lexical editor is not an object"). This applies to Event `description`, Form `description`/`settings.successMessage`, and Announcement `body`. Build them with this shape (one `paragraph` node per blank-line-separated block; URLs go in as plain text — clickable link nodes are out of scope):

```jsonc
{ "root": { "type": "root", "version": 1, "direction": null, "format": "", "indent": 0,
  "children": [
    { "type": "paragraph", "version": 1, "direction": null, "format": "", "indent": 0,
      "children": [ { "type": "text", "version": 1, "text": "First paragraph." } ] },
    { "type": "paragraph", "version": 1, "direction": null, "format": "", "indent": 0,
      "children": [ { "type": "text", "version": 1, "text": "Second paragraph." } ] }
  ] } }
```

Put the one-line human summary in `shortDescription` (a plain `textarea` — a string is correct there). Put the full body + RSVP URL in the Lexical `description`. If you don't need a rich body, omit `description` entirely rather than sending a string.

## Gotchas (the things baseline agents get wrong)

| Gotcha | Rule |
|---|---|
| Auth header | `Authorization: users API-Key <key>` — the literal word `users`, then `API-Key`. |
| Draft, Forms | `status: "draft"` in the body. |
| Draft, Events | `?draft=true` query param **and** `"_status": "draft"` in the body (both). |
| Public URLs need the tenant subdomain | The site is multi-tenant by host. `localhost:3000/events/<slug>` 404s; the page only resolves under the tenant subdomain, e.g. `icp.localhost:3000/events/<slug>`. So **API calls** use the bare `$OPENMASJID_BASE_URL`, but every **public link** you embed (the RSVP URL in the description) or print (the report) must use `<tenant>.<host>`. Get the tenant slug from the key's user: `GET /api/users/me` → `user.tenant` (id) → `GET /api/tenants/<id>` → `.slug`. |
| Media upload | `POST /api/media` is **multipart** (`-F "file=@path"`), not JSON. Needs `media:write`. Use the returned `doc.id` as the event's `flyerImage` with `displayMode: "image"`. |
| richText fields | Event `description`, Form `description`/`successMessage`, Announcement `body` are **Lexical** — must be an editor-state **object**, never a plain string (a string crashes the admin page). Use the Lexical template above; one paragraph node per block. Plain one-liners go in `shortDescription` (textarea). |
| Tenant | **Never** send `tenant` — a server hook sets it from the key's user. Sending it does nothing useful and may be rejected. |
| Timezone | The flyer time is local. Emit ISO 8601 **with an explicit offset** (e.g. `-05:00`), not bare `Z`/UTC. If you don't know the masjid's timezone, **ask** — defaulting to UTC silently shifts the event by hours. |
| Per-guest price | `payment.priceCents` is one **flat** charge per submission, not price × `attendees`. If the flyer says "$25 per person" and you collect a headcount, tell the user in the confirm step that the form charges a single flat amount (true per-head billing isn't supported by the fixed price) and let them decide. |
| No relationship field | Events have no `rsvpForm` field. Link by putting the form's public URL in the event description. |
| Don't over-build | Default to name/email/phone/attendees + flyer-specific fields. Do **not** add confirmation-email flows, consent walls, or extra fields unless the flyer or user asks. |

## Error handling

- `401/403` → "API key is missing `events:write`/`forms:write` (or the user lacks tenant access). Add the scope in /admin → Users → API scopes." Stop; do not attempt the second create.
- `400/422` → show the server's response body verbatim (usually a form-schema or date-validation message) and fix the payload.
- Connection refused → "Is the dev server running at `$OPENMASJID_BASE_URL`?"
- **Form created but Event failed:** report the orphaned draft Form (id + URL) so the user can retry just the event — don't silently lose it.

## Out of scope

Auto-publishing, editing existing events/forms, and donations endpoints. (Uploading the flyer to `media` IS supported now — needs `media:write`.) Payment config is created, but it only charges if the tenant has Stripe Connect set up — note that to the user; it's not something this skill configures.
