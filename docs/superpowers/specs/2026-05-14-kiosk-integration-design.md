# Kiosk Integration — Design

**Date:** 2026-05-14
**Status:** Approved, ready for implementation planning
**Source app being ported:** `~/personal/kiosk` (React + Vite + Express + Supabase monorepo)
**Target:** `open-masjid` (Next.js 16 + Payload CMS 3.84, multi-tenant)

---

## Goal

Bring kiosk/display-monitor functionality into open-masjid as native, tenant-scoped Payload collections plus a Next.js display route. Reuse the visual components and slide templates from the existing kiosk repo; replace its Express/Supabase backend with Payload.

Out of scope for v1: monthly calendar slides, blackout-during-prayer mode, scheduled activation/deactivation, two-way remote commands, Announcements surfacing on kiosk.

---

## Decisions locked

1. **Approach:** Port the kiosk *display* into open-masjid as a Next.js route per tenant; admin functionality lives in Payload. The standalone kiosk repo is not deployed.
2. **v1 features:** carousel slides, sponsor slides, weekly events slide, kiosk device registration + status, real-time-ish push (polling + push-now), QR-code content library, content/media via Payload Media, kiosk-manager role.
3. **QR codes** are a content library (reusable PNGs attached to slides for congregants to scan) — *not* a device-pairing mechanism.
4. **Device pairing:** typed 6-char pairing code (TVs have no cameras). Admin binds the code on a Kiosk record; server mints deviceId + secret.
5. **Multi-display targeting:** tenant-global slides by default; opt-in per-kiosk override (`overrideEnabled` + `slideOverrides`). Mirrors the existing kiosk repo's `kiosk_configuration` model.
6. **Realtime mechanism:** 60s polling + admin "push now" button (bumps a version timestamp). No WebSocket or SSE in v1.
7. **Data reuse:** prayer times from existing `PrayerSchedules`; images/logos/QR PNGs from existing `Media`; tenant branding from `Tenants`. Weekly events is its own collection (distinct shape from open-masjid `Events`).

---

## Architecture & data model

### New Payload collections (all tenant-scoped, following existing patterns)

| Collection | Purpose | Key fields |
|---|---|---|
| `Kiosks` | One row per physical screen | `name`, `location`, `status` (`UNPAIRED`/`ONLINE`/`OFFLINE`/`MAINTENANCE`), `deviceId` (uuid), `secretHash` (bcrypt), `pairingCode` (short-lived, nullable, 15min TTL), `lastSeenAt`, `lastSeenIp`, `userAgent`, `overrideEnabled` (bool), `slideOverrides` (rels to slides of any of the three slide types), `kioskPushAt` (timestamp, bumped by push-now) |
| `CarouselSlides` | Tenant-authored slide content | `title`, `details1`, `details2`, `image` (→ Media), `qrCode` (→ QRCodes, optional), `backgroundTheme` (select; Islamic themes or "clean"), `prayerTimingsEnabled` (bool overlay), `displayDurationMs` (5000–60000), `priority` (0–10), `active`, `startDate`, `endDate`, `showInCarousel` |
| `SponsorSlides` | Advertiser/sponsor slides | `title`, `tagline`, `logo` (→ Media), `brandColorPrimary` (hex), `brandColorSecondary` (hex), `backgroundStyle` (gradient/solid/brand-primary/brand-secondary), `layoutTemplate` (logo-left/logo-top-centered/logo-dominant/split-screen), `details1`-`details3`, `contactPhone`, `contactAddress`, `contactWebsite`, `qrCode` (→ QRCodes), `ctaText`, `displayDurationMs`, `priority`, `active`, `startDate`, `endDate` |
| `WeeklyEventsSlides` | Weekly recurring schedule grid | `title`, `entries` (array of `{ day, time, name, location?, audience? }`), `displayDurationMs`, `active` |
| `QRCodes` | Reusable QR-code library | `label`, `targetUrl`, `fgColor` (hex), `bgColor` (hex), `generatedImage` (→ Media; PNG produced server-side via `qrcode` npm lib) |

### Reused (existing) collections

- `PrayerSchedules` — kiosk reads adhan + iqamah times directly.
- `Media` — slide images, sponsor logos, generated QR PNGs.
- `Tenants` — every new collection is tenant-scoped.

### New user role

`kioskManager` — tenant-scoped, joins existing `platformOwner` / `admin` / `staff`. Can read/write the five new kiosk collections + read `PrayerSchedules` and `Media`. Cannot access `Pages`, `Events`, `Announcements`, `Forms`, `Members`, `MembershipTiers`, `Donations`, `DonationFunds`, `Services`, `HeroSlides`, `Tenants`, or `Users`. Payload admin UI hides non-kiosk groups for this role.

---

## Device pairing & auth

### Flow

1. Admin clicks "Add Kiosk" in Payload → creates a `Kiosks` row (name, location). Status = `UNPAIRED`. No deviceId or secret yet.
2. On the physical screen, open `https://<tenant>.openmasjid.app/kiosk`. The page generates a 6-char human-friendly code (e.g. `K7M-3PQ`), displays it large, polls `POST /api/kiosk/claim?code=K7M-3PQ` every 3s.
3. Admin opens the Kiosk record, types `K7M-3PQ` into the "Pairing Code" field, saves. Server stores the code on the record with a 15-min TTL.
4. The screen's next claim poll succeeds: server matches code → mints `deviceId` (uuid) + random secret → stores `bcrypt(secret)` as `secretHash` on the record → clears `pairingCode` → status → `ONLINE`.
5. The claim response returns `{ deviceId, secret }`. The screen stores both in `localStorage`, redirects to `/kiosk/[deviceId]`.
6. From now on every request sends `X-Kiosk-Device-Id` + `X-Kiosk-Secret` headers.
7. Re-pairing: admin clicks "Reset pairing" → server clears `secretHash` + `deviceId`, status → `UNPAIRED`. The kiosk's next call returns 401, it wipes localStorage and re-enters step 2.

### Why typed code rather than QR

TVs/Fire Sticks don't have cameras. A 6-char code is faster to type into admin than scanning would be to set up. One pairing URL (`/kiosk`) works for any tenant — the code carries the binding.

### Request shape (post-pair)

```
GET /api/kiosk/state
Headers:
  X-Kiosk-Device-Id: <uuid>
  X-Kiosk-Secret:    <secret>
```

Server flow per call:

1. Look up `Kiosks` by `deviceId`. 404 → 401.
2. `bcrypt.compare(secret, secretHash)`. Mismatch → 401.
3. Resolve `tenant` from the Kiosk record (source of truth — not the subdomain).
4. Update `lastSeenAt`, `lastSeenIp`, `userAgent`.
5. Compose state bundle (see below).
6. Return JSON.

`POST /api/kiosk/push` (admin-authenticated via Payload session, not device-authenticated): bumps `Tenants.kioskBroadcastAt` or `Kiosks.kioskPushAt`. Used by admin "push now" actions.

---

## Display logic & slide rotation

### State endpoint shape

```ts
GET /api/kiosk/state →
{
  tenant: { name, logo, timezone, theme },
  prayerTimes: {
    date,
    fajr, sunrise, dhuhr, asr, maghrib, isha,
    iqamah: { fajr, dhuhr, asr, maghrib, isha }
  },
  slides: Array<{
    type: 'carousel' | 'sponsor' | 'weekly-events',
    id, durationMs, priority,
    payload: {/* type-specific */}
  }>,
  version: string,        // hash; changes whenever displayed content should refresh
  pollIntervalMs: 60000
}
```

### Server-side composition

For each of the three slide types: filter by `tenant` AND `active === true` AND date range (`startDate ≤ now ≤ endDate || endDate IS NULL`). If `Kiosks.overrideEnabled === true` for this device, intersect with `slideOverrides`. Sort merged result by `priority DESC, createdAt ASC`.

`version` = stable hash of `(ordered slide ids + their updatedAt timestamps + prayer-schedule day + tenant.kioskBroadcastAt + kiosk.kioskPushAt)`. Any change to any input → new version.

### Client (display) behavior

- On mount: fetch state, render slide 0, schedule advance after `durationMs`.
- Persistent overlay: prayer-times strip (always visible across slides), tenant logo, clock, "next prayer in 0:42" countdown.
- Every 60s: refetch state. If `version` changed, swap playlist at the next slide boundary (never mid-slide).
- On fetch failure: exponential backoff (5s → 10s → 20s → max 5 min). Keep displaying last-known content. Show small "offline" dot. Never blank the screen.

### Components ported from kiosk repo

Source: `~/personal/kiosk/apps/kiosk/src/components/carousel/`

| Component | Maps to |
|---|---|
| `CustomSlide.tsx` | `CarouselSlides` rendering — preserves `backgroundTheme`, random gradient fallback, `prayerTimingsEnabled` overlay, optional QR |
| `AdvertiserSlide.tsx` | `SponsorSlides` rendering — 4 layout templates × 4 background styles |
| `WeeklyEventsSlide.tsx` | `WeeklyEventsSlides` rendering |
| `PrayerTimesSlide.tsx` | Standalone prayer-times card (built-in, no CMS surface) |
| `IslamicContentSlide.tsx` + `IslamicContentDisplay.tsx` | Quran/dua rotation slides — content lives in constants ported from kiosk repo, not in CMS |
| `QRCodeDisplay.tsx` | Shared QR overlay component |
| `CarouselLayout.tsx` + `CarouselErrorBoundary.tsx` | Rotation container + error fallback |

Also ported: `themes/islamicThemes.ts` and gradient constants (`constants/gradientConstants.ts`).

Dropped during port: Vite scaffolding, Zustand stores (state lives in React context + URL), Supabase client (replaced with fetch to Next route), socket.io client.

Deferred (not in v1): `MonthlyCalendarSlide`, `MonthlyCalendarGridLayout`, `MonthlyCalendarListLayout`, `ContentSlide`, `ErrorSlide`.

---

## Push-now & polling

Default: every kiosk polls `GET /api/kiosk/state` every 60s. If `version === lastSeenVersion`, no-op. Else swap at next slide boundary.

Admin push surfaces in Payload:

- **Kiosks list view**: "Push update to all kiosks" → `POST /api/kiosk/push?tenant=…` → bumps `Tenants.kioskBroadcastAt`.
- **Single Kiosk row**: "Push update to this kiosk" → `POST /api/kiosk/push?deviceId=…` → bumps `Kiosks.kioskPushAt`.

Worst-case latency: 60s. Expected: ~30s.

### Heartbeat & status derivation

Each `GET /api/kiosk/state` call updates `lastSeenAt`. A scheduled job (Vercel Cron or Payload job) runs every 2 min and flips kiosks whose `lastSeenAt > now - 3min` to `OFFLINE`. Statuses: `UNPAIRED`, `ONLINE`, `OFFLINE`, `MAINTENANCE`. No transient `RECONNECTING`.

---

## Rollout plan

### Milestone 1 — Schema & admin

- Add `Kiosks`, `CarouselSlides`, `SponsorSlides`, `WeeklyEventsSlides`, `QRCodes` (skeleton) collections, all tenant-scoped (use `HeroSlides.ts` as the reference pattern).
- Add `kioskManager` role to `Users.ts`; update access functions across all new collections; hide non-kiosk admin groups for this role.
- Generate Payload migration; review.
- Seed sample data for a test tenant.
- **Exit:** admin can CRUD all kiosk content; tenant scoping verified; `kioskManager` role limited correctly.

### Milestone 2 — Pairing flow

- `/kiosk` Next.js page renders pairing code, polls claim endpoint.
- Admin `pairingCode` field on Kiosks.
- `POST /api/kiosk/claim` — mints deviceId + secret on successful code match.
- "Reset pairing" admin row action.
- **Exit:** real device pairs end-to-end on a staging tenant.

### Milestone 3 — Display route (read-only render)

- `/kiosk/[deviceId]` route with device-auth middleware (header verification).
- `GET /api/kiosk/state` endpoint returning the bundled state.
- Port slide components, themes, gradient constants from kiosk repo as Next.js client components.
- 60s polling, version diffing, slide-boundary playlist swap, offline backoff.
- Heartbeat updates `lastSeenAt`.
- **Exit:** real device displays carousel of all three slide types + prayer-times strip; rotates correctly; recovers from network loss.

### Milestone 4 — QR codes

- `QRCodes` collection + `afterChange` hook that generates PNG server-side via `qrcode` npm lib and writes into Media.
- Selector field (existing / new / upload) on `CarouselSlides.qrCode` and `SponsorSlides.qrCode`.
- Download button in admin row for offline flyer use.
- **Exit:** generate a QR in admin, attach to a slide, scan from phone → opens URL.

### Milestone 5 — Per-kiosk overrides + push-now + cron

- `overrideEnabled` + `slideOverrides` fields on Kiosks; display state composition honors them.
- "Push update" actions on Kiosks list + row → bump version timestamps.
- Vercel Cron every 2 min flips stale kiosks to `OFFLINE`.
- **Exit:** override toggling visibly differentiates two kiosks of the same tenant; push-now reflects in <60s.

### Milestone 6 — Polish

- Tenant-timezone correctness in prayer-times strip (interacts with existing issue #15).
- Admin help text on each new collection.
- Vitest smoke tests for state composition, version hashing, access controls, pairing flow.

---

## Risks & known unknowns

- **Pixel-perfect parity** with the existing kiosk display will take iteration — the React components are designed for 1920×1080 TVs, and CSS sizing may need tuning when re-mounted inside Next.
- **Islamic pattern background SVGs** and any binary assets must be copied over alongside the components.
- **Tenant timezone**: prayer-times strip depends on `Tenants.timezone` being populated. Open-masjid issue #15 covers this work and is a soft dependency.
- **Bcrypt secret rotation** on re-pair leaves the kiosk briefly unauthenticated until it re-enters pairing mode — acceptable since re-pair is intentional.
- **No WebSocket** means a tenant with very high update cadence will feel the 60s lag. If real users complain we can add SSE in v2 without changing the data model.

---

## Out of scope (deferred)

- Monthly calendar slides (grid + list layouts)
- Blackout / prayer-focused mode at adhan and iqamah times
- Scheduled activation/deactivation (auto turn slides on/off via background scheduler)
- Two-way device commands (remote restart, log retrieval)
- Surfacing open-masjid `Announcements` on the kiosk
- WebSocket / SSE realtime
