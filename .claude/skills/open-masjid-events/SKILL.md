---
name: open-masjid-events
description: Use when the user wants to manage EXISTING OpenMasjid events via natural language — "list upcoming events", "reschedule the Eid dinner", "change the location", "edit the event description", "publish / unpublish that event", "find the youth halaqa event", "delete the old fundraiser". OpenMasjid (Payload CMS) specific; covers events:read and events:write. For CREATING an event from a flyer image, use the flyer-to-event skill instead.
---

# OpenMasjid Events (manage existing)

Read and edit a tenant's events by chatting. Talks to a running OpenMasjid instance via Payload's REST API with a scoped API key.

**REQUIRED FIRST:** read `../_shared/openmasjid-api.md` for auth, session bootstrap, the tenant rule, Lexical richText, the diff-then-confirm gate, drafts/publish, and error handling.

**Scopes:** `events:read` / `events:write`.

**Boundary with flyer-to-event:** that skill *creates* an event (and optional RSVP form) from a flyer image. This skill is for *managing* events that already exist — list, find, edit fields, reschedule, change visual, publish/unpublish, delete. If the user drops a flyer to make a new event, defer to flyer-to-event.

## Collection: `events`

| Field | Type | Notes |
|---|---|---|
| `title` | text | Required. |
| `shortDescription` | textarea | Plain text (~160 chars), shown on cards. A string is correct here. |
| `description` | richText (Lexical) | Full body. **Lexical object, never a string.** Omit if not editing it. |
| `tag` | select | One of `weekly-class`, `ramadan`, `eid`, `sisters`, `youth`, `brothers`, `community`. |
| `audience` | select (hasMany) | Any of `families`, `sisters`, `youth`, `brothers`, `all`. |
| `when` | text | Human cadence, e.g. "Mondays after Isha". |
| `startDate` / `endDate` | date | ISO 8601 **with explicit offset** (e.g. `2026-06-15T18:30:00-05:00`), not bare UTC. `endDate` optional. |
| `location` | text | Inside-masjid location. `address` is a separate optional full address; `contact` is an optional email. |
| `displayMode` | select | Required, default `text`. `text` (no visual), `template` (auto card), `image` (uploaded flyer). |
| `flyerImage` | upload (media id) | Only used when `displayMode: "image"`. Needs `media:write` to upload a new one (see flyer-to-event). |
| `templateVariant` | select | `default` \| `navy` \| `gold`; only when `displayMode: "template"`. |
| `featured` | checkbox | Default false; include in homepage hero. `heroAccent` (`cream`/`teal`/`navy`/`gold`) only applies when featured. |
| `slug` | text | Auto-generated from title on create; **stable** after — editing the title does NOT change the slug. |
| `_status` | — | Draft/publish (see below). |
| `tenant` | relationship | Server-side — never send. |

## Reading / finding events

List upcoming for the tenant:

```
GET /api/events?where[startDate][greater_than_equal]=<today-iso>&sort=startDate&limit=100&depth=0
```

All (incl. past): drop the date filter, `sort=-startDate`. Find one to edit by title: `?where[title][like]=<keyword>`. To see a draft, append `&draft=true`. The list response includes `totalDocs` for counts. Report `title`, `startDate`, `location`, and `_status` (draft vs published). Resolve the `id` from a read before any edit — never guess it.

## Editing an event (`PATCH /api/events/<id>`)

Send only the changed subtree, then GET it back and show the user the updated field.

- Reschedule: `{ "startDate": "2026-07-04T19:00:00-05:00", "endDate": "2026-07-04T21:30:00-05:00" }` — keep the **date** from the existing event (you fetched it above; only swap the time), and if an `endDate` exists, shift it by the same delta to preserve the duration. Confirm the new end if the user only gave a new start.
- Move it: `{ "location": "Sister's Hall" }`
- Edit body: a new Lexical `description` object (never a string).
- Switch visual to a branded card: `{ "displayMode": "template", "templateVariant": "navy" }`.

Always show the `old → new` diff and get an explicit yes (shared doc). Editing the title will **not** update the slug or any links pointing at it — call that out if they rename.

## Publish / unpublish

Events use Payload drafts. To **publish** a draft: `PATCH /api/events/<id>` with `{ "_status": "published" }`. To pull a live event back to draft (hide it): `{ "_status": "draft" }`. Confirm first — unpublishing removes it from the public site.

## Deleting

`DELETE /api/events/<id>` is permanent. Confirm clearly; prefer unpublish (`_status: "draft"`) if they just want it hidden.

## Common mistakes

- `description` as a string → admin crash. Lexical object or omit.
- Expecting the slug (or its public URL) to change when you rename the event — it doesn't; the slug is frozen at creation.
- Bare-UTC dates when the user means local time → event shifts hours. Use an explicit offset or ask the timezone.
- Sending `tenant` → ignored; the hook sets it.
- Setting `displayMode: "image"` without a valid `flyerImage` media id → no visual renders. Uploading media needs `media:write` (out of scope here; see flyer-to-event).
