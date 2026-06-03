---
name: open-masjid-announcements
description: Use when the user wants to read, post, edit, or remove a masjid announcement / banner notice in OpenMasjid via natural language — "post an announcement", "put up a banner", "what announcements are live?", "make that one high priority", "take down / expire the Jumu'ah notice", "edit the announcement". OpenMasjid (Payload CMS) specific; covers announcements:read and announcements:write.
---

# OpenMasjid Announcements

Read and manage a tenant's announcements (the banner notices on the site) by chatting. Talks to a running OpenMasjid instance via Payload's REST API with a scoped API key.

**REQUIRED FIRST:** read `../_shared/openmasjid-api.md` for auth, session bootstrap, the tenant rule, Lexical richText, the diff-then-confirm gate, and error handling. This file only covers what's specific to announcements.

**Scopes:** `announcements:read` for reads, `announcements:write` for create/update/delete.

## Collection: `announcements`

| Field | Type | Notes |
|---|---|---|
| `title` | text | **Required.** The headline shown in the banner. The only field a create must include. |
| `body` | richText (Lexical) | Optional supporting detail shown when expanded. **Lexical object, never a string** — see shared doc. Omit if not needed. |
| `priority` | select | `"normal"` (default) or `"high"`. `high` = emphasized banner styling. |
| `active` | checkbox | Default `true`. Manual on/off; overrides expiry. Set `false` to hide without deleting. |
| `expiresAt` | date | Optional ISO 8601 datetime; auto-hides past this moment. Blank = evergreen. Emit with an explicit offset (e.g. `-05:00`), not bare UTC, or ask the tenant's timezone. |
| `tenant` | relationship | Server-side — **never send it.** |

Drafts: announcements support Payload drafts (`?draft=true` + `_status`), but a normal live announcement just needs `active: true` and no `_status`. Only use draft mode if the user explicitly wants to stage one unpublished.

## Reading announcements

"What's live / what announcements are up?":

```
GET /api/announcements?where[active][equals]=true&sort=-createdAt&limit=50&depth=0
```

Show `title`, `priority`, and `expiresAt` (note any expired/upcoming). For "everything incl. hidden", drop the `active` filter. To find a specific one to edit, match on `title`: `?where[title][like]=<keyword>` (resolve to a single id — see the shared doc on 0/multiple matches). Answer in plain English; if empty, say "no announcements" — don't invent. (Don't `sort` by `priority` — it's a string, so `normal` sorts after `high`, not by importance.)

## Posting an announcement (`POST /api/announcements`)

Minimum is just a title. Example body for "post a high-priority notice that Jumu'ah is at 1:30 this week":

```jsonc
{
  "title": "Jumu'ah is at 1:30 PM this week",
  "priority": "high",
  "active": true,
  "body": { "root": { "type": "root", "version": 1, "direction": null, "format": "", "indent": 0,
    "children": [
      { "type": "paragraph", "version": 1, "direction": null, "format": "", "indent": 0,
        "children": [ { "type": "text", "version": 1, "text": "First khutbah begins promptly at 1:30 PM. Please arrive early." } ] }
    ] } }
}
```

Omit `body` entirely if the title says it all (don't send `body: ""` — a string crashes the editor). Diff-preview the full object and get a yes before POSTing (see shared doc).

## Editing / taking one down

PATCH only the changed subtree to `/api/announcements/<id>` (resolve `<id>` from a read first; never guess).

- Bump priority: `{ "priority": "high" }`
- Take it down (keep the record): `{ "active": false }` — preferred over delete.
- Expire it at a time: `{ "expiresAt": "2026-06-06T23:59:00-05:00" }`
- Edit wording: send `title` and/or a new Lexical `body`.

Show the `old → new` diff and wait for an explicit yes. **Deleting** (`DELETE /api/announcements/<id>`) is permanent — prefer `active: false` unless the user clearly wants it gone, and confirm extra-clearly for a delete.

## Common mistakes

- Sending `body` as a plain string → admin crash. Use the Lexical object, or omit.
- Sending `tenant` → ignored/rejected; the hook sets it.
- Using `_status`/`?draft=true` for a normal post — not needed; that's only for staging an unpublished draft. Live announcements use `active`.
- Bare-UTC `expiresAt` when the user means local time → it hides at the wrong hour. Use an explicit offset or ask.
