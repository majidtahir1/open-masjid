# Ansari Web Chat for Tenant Admins — Design

**Date:** 2026-06-08
**Status:** Approved — building POC first
**Author:** Majid Tahir (with Claude)

## POC scope (build first)

Before the full v1, build a **proof-of-concept** proving the end-to-end path:
**an admin types a message in a web UI → OpenMasjid relays it → Hermes responds
back, streamed into the UI.** Everything else (image upload, polished UX, role
gating refinements, provisioning automation, secret-store hardening) is deferred
until the POC works.

**POC transport decision:** keep web03 (OpenMasjid) and Hermes on the **same
tailnet for now**. The "don't put web03 on a foreign tailnet" concern is real and
will be revisited before multi-tenant rollout (candidate: outbound HTTPS to a
TLS/mTLS-fronted Hermes endpoint, so web03 only makes one authenticated outbound
call and joins no foreign network). Not a POC blocker.

**POC done = ** a logged-in admin sends a text message from `/admin/ansari`, and
the agent's reply streams back in the browser, hitting a real Hermes profile's
API server over the tailnet.

## Problem

Tenant admins can today only talk to Ansari (the OpenMasjid AI assistant) through
**Telegram**, which Hermes owns as its chat channel. Requiring Telegram is an
adoption impediment: many masjid teams don't use it. We want admins to chat with
their masjid's Ansari **from inside the OpenMasjid admin UI**, with the same
capabilities they'd have over Telegram (prayer times, events, announcements,
forms, and flyer-to-event), so the assistant is usable without any third-party
messaging app.

Scope is **tenant admins only** — not congregants.

## Background / current architecture

- **OpenMasjid** (this repo) is the *brain*: Payload CMS + Next.js, multi-tenant,
  with a proven API-key + scope system. It is the authoritative owner of
  `user → tenant` identity and `tenant → Hermes profile` binding.
- **Hermes** (Nous Research `hermes-agent`, external) is the *mouth and ears*: a
  separate agent runtime, deployed **one profile per masjid**, each profile a
  separate gateway process with its own `.env`, scoped `OPENMASJID_API_KEY`,
  `SOUL.md`, and Telegram bot token. The architecture deliberately treats Hermes
  as "a thin, swappable delivery layer."
- **Skills** (prayer-times, events, announcements, forms, flyer-to-event) and the
  per-tenant `SOUL.md` persona run **inside Hermes's agent loop**, not in this
  repo. They are reachable today only via Telegram.

### The enabling fact

Hermes ships a **built-in, OpenAI-compatible HTTP API server** (per profile,
default port `:8642`, REST + SSE streaming, server-side conversation state via the
Responses API, image content parts supported). This means the existing agent loop,
skills, and `SOUL.md` are already reachable over HTTP — **we do not build a new
agent brain; we open a door that already exists.**

The one gap: the Hermes API server authenticates with a **single shared bearer
key per profile** — it has no concept of "which admin." This is exactly what
OpenMasjid is built to resolve, since it already owns identity and tenant binding.
OpenMasjid therefore acts as the **broker**, which keeps the brain/mouth split
intact.

## Goals

- Tenant admins chat with their masjid's Ansari from the OpenMasjid admin UI.
- Full Telegram capability parity, **including flyer image upload** so
  `flyer-to-event` works in the browser.
- Streaming (token-by-token) replies.
- Zero re-implementation of skills — reuse the exact agent loop Telegram uses.
- Tenant isolation enforced server-side; no Hermes credential ever reaches the
  browser.

## Non-goals (v1)

- Inline proactive nudges (`[Yes]/[No]/[Not now]`) in the web chat — Telegram-only
  for now.
- Persisted / audit chat history collection — v1 uses Hermes-side state with an
  ephemeral browser session.
- Multi-admin presence / shared live sessions.
- Congregant-facing chat.

## Chosen approach: OpenMasjid relays to the Hermes API server

Considered and rejected:

- **B — Custom Hermes web platform-adapter plugin.** A ~50–150 line
  `BasePlatformAdapter` plugin inside Hermes. More "native" to Hermes, but
  re-implements auth and *still* needs OpenMasjid to route multi-tenant traffic.
  More moving parts, less aligned with "brain owns identity."
- **C — Browser talks to Hermes directly** (e.g. Open WebUI / OpenAI SDK →
  `:8642`). Fastest demo, but the single shared key means no per-admin auth, CORS
  exposure, and no tenant brokering. Not safe for multi-tenant/multi-admin.

**Approach A** fits the existing identity model, solves the per-admin auth gap,
needs ~zero Hermes code change, and gives true Telegram parity.

## Architecture

```
Browser — admin chat page  /admin/ansari
   │  POST + SSE  (carries previous_response_id held in the tab)
   ▼
OpenMasjid relay route  /admin/api/ansari/chat        ← the broker
   │  1. authenticate admin via existing Payload session
   │  2. assert role = tenant admin/staff (NOT congregant)
   │  3. resolve session.user.tenant → { hermesApiBaseUrl (tailnet), API_SERVER_KEY }
   │  4. POST {hermesApiBaseUrl}/v1/responses  (stream=true, Bearer API_SERVER_KEY)
   │  5. pipe SSE straight back to the browser
   ▼
Hermes profile gateway API server  (:8642, bound to the tailnet interface)
   - SAME agent loop / skills / SOUL.md that Telegram already uses
   - calls back into OpenMasjid REST API with the profile's scoped OPENMASJID_API_KEY
```

### Network topology

OpenMasjid and the Hermes profile VMs are on **different networks**, joined via a
**Tailscale tailnet**. The Hermes API server binds to the tailnet interface (not
public). Tailnet ACLs restrict which hosts may reach `:8642`. The relay is the
only OpenMasjid-side caller.

### Conversation state

Per the "Hermes-side state, ephemeral UI" decision: the relay is **stateless**.
Hermes holds conversation state server-side (Responses API); the browser tab holds
the latest `previous_response_id` and sends it with each request. No new Payload
collection. History is lost on tab refresh — acceptable for v1.

## Components

1. **Admin chat page** — `src/app/(payload)/admin/ansari/`
   - `page.tsx` (server component): `getAdminUser`, role gate, and a
     "is Ansari connected for this tenant?" check; passes minimal, non-secret
     props to the client.
   - `AnsariChatClient.tsx` (client component): message list, streaming render of
     SSE tokens, text input, **image attach** control, error/empty states. Styled
     to match existing custom admin pages (e.g. `BillingClient`).
   - A nav link in the admin sidebar ("Ansari").

2. **Relay route** — `src/app/(payload)/admin/api/ansari/chat/route.ts`
   - Authenticates the Payload session; rejects unauthenticated (401) and
     non-admin roles (403).
   - Resolves `user.tenant` → `{ hermesApiBaseUrl, API_SERVER_KEY }`. **Tenant is
     derived from the session only, never from client input** — cross-tenant
     access is structurally impossible.
   - Accepts the user message, optional image(s) as content parts, and the
     `previous_response_id` from the client.
   - POSTs to `{hermesApiBaseUrl}/v1/responses` with `stream: true` and
     `Authorization: Bearer <API_SERVER_KEY>`; pipes the SSE stream back to the
     browser. Surfaces the new `response_id` so the client can chain the next turn.

3. **AnsariSettings extension** (existing per-tenant collection from the nudge
   design)
   - `webChatEnabled` (boolean toggle).
   - `hermesApiBaseUrl` (string, tailnet URL).
   - `API_SERVER_KEY` is a **server-only secret** — stored as an env var keyed by
     tenant slug, or an access-restricted field readable only server-side. **Never
     exposed to the client or in any API read a non-server caller can perform.**

4. **Provisioning additions** (to the existing Ansari provisioning script)
   - Per profile: set `API_SERVER_ENABLED=true`, generate `API_SERVER_KEY`, bind
     the API server to the tailnet interface.
   - Join the profile VM to the tailnet; apply ACLs for `:8642`.
   - Record `{ hermesApiBaseUrl, API_SERVER_KEY }` into OpenMasjid for the tenant.

## Image upload (flyer-to-event parity)

The web chat supports attaching an image. The relay forwards it to Hermes as an
OpenAI-style image content part on the `/v1/responses` call, so the same
`flyer-to-event` skill that runs over Telegram runs in the browser. Upload UI
(file picker / drag-drop, preview, size/type validation) lives in
`AnsariChatClient.tsx`. Image bytes pass through the relay to Hermes; they are not
persisted in OpenMasjid in v1.

## Error & edge handling

- Not authenticated → 401, redirect to admin login.
- Authenticated but not a tenant admin/staff → 403; chat page is hidden in nav.
- Tenant has no Ansari / `webChatEnabled` false → friendly empty state
  ("Ansari isn't set up for your masjid yet").
- Hermes unreachable (tailnet down, profile stopped, timeout) → graceful in-chat
  error with retry; do not leak internal details.
- Hermes API error response → surface a friendly message.
- SSE stream drop mid-reply → show "connection lost," allow resend.
- Oversized / unsupported image → client-side validation before upload.

## Security

- `API_SERVER_KEY` and `hermesApiBaseUrl` never leave the server.
- Tenant resolved from the authenticated session; client cannot select a tenant.
- Relay enforces admin/staff role explicitly (UI sessions are *not* scope-gated,
  so role enforcement is the relay's responsibility).
- Hermes API server bound to the tailnet, not public; tailnet ACLs limit reach.
- Optional (nice-to-have, not v1-blocking): basic per-user rate limiting on the
  relay.

## Testing

- **Relay unit tests:** rejects unauthenticated; rejects non-admin role; resolves
  the correct tenant→profile; rejects/ignores any client-supplied tenant;
  forwards `previous_response_id` and image parts.
- **Integration test:** against a mock Hermes API server — assert SSE passthrough,
  streaming chunks arrive in order, and `response_id` chaining works across turns.
- **Manual end-to-end:** real profile over the tailnet — text turn, multi-turn
  context, and a flyer image producing an event via `flyer-to-event`.

## Open items to resolve during planning

- Confirm the exact OpenMasjid role/field that distinguishes a tenant admin/staff
  from a congregant, for the relay's role gate.
- Confirm where the `API_SERVER_KEY` secret is best stored (env-by-slug vs.
  access-restricted Payload field) given current secret-handling conventions.
- Confirm the exact Hermes Responses API request/response shape and SSE event
  names for streaming + image content parts against the running version.
