# Design: AI Agent — Capability Surface v1

- **Date:** 2026-05-31
- **Status:** Implemented (backend scopes) — see [plan](../plans/2026-06-01-ai-agent-capability-surface-v1.md)
- **Scope:** Backend (scopes + agent-reachable reads/writes) beyond prayer times.
- **Related:** [Marketing Spotlight](./2026-05-31-ai-assistant-marketing-spotlight-design.md), [Proactive Nudge Engine](./2026-05-31-proactive-nudge-engine-design.md)

## Context

Today the AI assistant — **Ansari** (Hermes agent on a VM, via Telegram) — can only read and write **prayer times**, gated by `prayer-times:read` / `prayer-times:write` scopes on a user's API key. The plumbing already exists:

- `src/access/apiScoped.ts` — `isApiKeyAuth()`, `gateByApiKeyScope()`, `withApiKeyScopeEnforcement()`.
- `src/collections/Users.ts` (~322–336) — `apiScopes` field with `prayer-times:read|write` options; `enableAPIKey`.
- `src/payload.config.ts` — applies `withApiKeyScopeEnforcement` to all collections.
- Every collection is already **tenant-scoped** and behind a **billing lock**; API-key scopes default-deny unscoped operations even when the role would allow them.

This doc expands what the agent can touch. Same proven pattern throughout: **chat → Hermes agent → scoped REST → Payload**, always **diff-then-confirm** before a write.

## Goal

Define the v1 capability surface and the scope model that gates it, so the assistant can manage prayer times, announcements, forms/RSVPs, and events, and answer questions about members, signups, and donations.

## Capability matrix (v1)

| Domain | Agent **reads** | Agent **writes** | In v1 |
|---|---|---|---|
| Prayer times | today/any day adhan+iqamah, jummah | update iqamah rules | ✅ shipped |
| Announcements | list active notices | post / edit / expire (→ pushes to kiosks via existing hook) | ✅ |
| Forms & RSVPs | signup counts, response summary | create an RSVP/form (capacity, price, fields) | ✅ |
| Events | upcoming events, **signup counts** | create / update / cancel; from text or forwarded flyer image | ✅ |
| Members | count, new-this-month, search | — | ✅ read only |
| Donations | totals by fund, by month, campaign progress | — | 🔜 v1.1 (needs sum endpoint) |
| Kiosks/displays | what's showing | push/schedule a slide | ❌ later |
| Prayer (advanced) | — | per-day overrides, jummah writes, Ramadan/seasonal bulk | ❌ later |
| Donations (write) | — | create campaign/goal | ❌ later |

**v1 in one line:** the agent *answers* about prayer times, members, event signups, and donations; and *acts* on prayer times, announcements, forms, and events.

## Scope model: per-entity scopes

Extend `apiScopes` (in `Users.ts`) from the current two options to a per-entity set. **Chosen over** a coarse `agent:read/write` pair because narrow scopes are more secure and are exactly what per-tenant key minting will need when we productize multi-tenant.

New scope options:

- `prayer-times:read`, `prayer-times:write` (exist)
- `announcements:read`, `announcements:write`
- `forms:read`, `forms:write`
- `events:read`, `events:write`
- `members:read`
- `donations:read`

(No `members:write` / `donations:write` in v1 — those rows are read-only.)

### Enforcement

- `gateByApiKeyScope()` already maps an operation on a collection to a required scope. Extend its collection→scope map to cover Announcements, Forms, Events, Members, Donations.
- Reads require the `:read` scope; create/update/delete require `:write`.
- Default-deny stays: a key without the relevant scope is rejected even if the underlying role permits the action.
- Tenant scoping and billing lock are unchanged and still apply on top.

## Agent UX patterns (carry forward from the prayer-times skill)

- **Diff-then-confirm:** every write previews the change ("Fajr iqamah 5:30 → 5:45; apply? yes/no") before executing.
- **Disambiguation:** natural-language resolution of which entity ("the Eid dinner" → the matching Event).
- **Flyer → event:** a forwarded image is OCR/vision-parsed by the agent into title/date/time/location, then created as an Event (and can trigger the existing branded-flyer generation).
- **Reporting Q&A:** read scopes power "how many new members this month?", "RSVPs for the fundraiser?", "building fund progress?".

## Security considerations

- Per-entity scopes shrink blast radius of a leaked key.
- Writes remain tenant-scoped and billing-gated server-side; the agent cannot cross tenants regardless of prompt.
- Members/donations are read-only in v1 — no PII writes, no money moves, through the agent.

## Out of scope (v1)

- Kiosk slide control, advanced prayer writes (per-day, jummah, Ramadan bulk), donation-campaign writes.
- Multi-tenant key productization (Hermes per-tenant) — separate, not yet designed.

## Open questions (resolved in implementation)

- **Dry-run/preview endpoint for create flows?** No — the agent's own confirm step plus server-side validation (`validateSchema` on forms, Payload field validation) is sufficient for v1. No new endpoint added.
- **Members search PII?** `members:read` returns full member documents at the collection level (same data an admin sees in the UI); field-level redaction is deferred. The agent layer must avoid echoing Stripe IDs into chat. Because `Members` role-access denies `staff`, the agent key's user must be `admin`/`platformOwner` for reads to return data.
- **Event signup counts** flow through `form-submissions` (gated by `forms:read`), since events have no form relationship field; an agent key needing them carries both `events:read` and `forms:read`.

**Deferred to v1.1:** Donations read (`donations:read`). Payload REST has no SUM/group-by, so "totals by fund/month" and "building-fund progress" need a custom aggregation endpoint (`GET /api/donations/summary`, DB-level sum, scope-gated, mirroring `/api/apply-iqamah-rules`). There is also no `goal`/`target` field on funds, so "progress" would mean "total raised," not "% of goal." Tracked separately.
