# Prayer Display v2 — Design

**Date:** 2026-05-26
**Status:** Approved (pending written-spec review)
**Branch context:** `feat/kiosk-integration`

## Summary

Redesign the kiosk prayer-times surface to match the designer handoff in
`OpenMasjid (1)/prayer-display/` (README + `variants.jsx` + `variants.css`).
Three visual variants (Cream / Night / Mihrab) replace today's single
slate-themed slide, a Salah-in-progress takeover covers the screen during
jamaa, and the hero content (verses / hadith / du'as) is driven by a new
per-tenant content collection instead of a hardcoded list.

This is one combined cycle covering the visual redesign, variant rotation,
Salah takeover, and a minimal content store. NTP sync, offline caching, and
Aladhan-sourced Hijri dates are explicitly deferred.

## Goals

- Port the designer's three 1920×1080 variants verbatim (markup + CSS).
- Show a different variant + content entry each time the prayer slide surfaces.
- Cover the screen with a "Salah is in progress" takeover, triggered
  automatically at iqamah time and manually by an admin.
- Let masajid curate their own hero content via a simple admin collection.
- Make the prayer-slide dwell time configurable.

## Non-goals (deferred to later cycles)

- NTP time-sync endpoint + clock-drift warning.
- Offline last-known caching beyond current behavior.
- Hijri date from Aladhan + per-day moonsighting override (v2 uses client-side
  `Intl` islamic calendar).
- Per-tenant variant subset ("only Mihrab"), custom Arabic fonts, sponsor strip.
- Content tags, weights, live preview, URL scraping (cut from the handoff).

## Current state

- `prayer-times` is one slide in the kiosk carousel, injected client-side in
  `src/app/(kiosk)/kiosk/[deviceId]/page.tsx:157` with `durationMs: 15000`,
  always leading the rotation.
- `PrayerTimesSlide.tsx` renders a slate-900 layout: top ~70%
  `IslamicContentDisplay` (rotating hardcoded content from
  `_lib/constants/islamicContent.ts`) + bottom 30% prayer grid.
- `CarouselLayout.tsx` cross-fades slides and fires `onSlideChange` only on real
  slide-identity changes (`CarouselLayout.tsx:37`).
- Kiosk content arrives via `GET /api/kiosk/state` (polled every 5s), built in
  `src/app/api/kiosk/state/route.ts` via `composeKioskState`. The payload
  carries a `version` hash that signals the client to re-render on change.
- `PrayerSchedules` stores per-day `adhan`/`iqamah` per prayer and Friday
  `jummahTimes` (replaces Zuhr iqamah on Fridays).
- `Tenants` has `name`, `location` (lat/lng, timezone), `contactInfo.address`
  (free-text blob, no discrete city), `branding`. No Hijri field.

## Design

### 1. Surface & integration

Replace `PrayerTimesSlide` with a new `PrayerDisplay` component; retire
`IslamicContentDisplay` and `_lib/constants/islamicContent.ts` (its entries are
migrated into the seed list — see §2).

`prayer-times` stays a single carousel slide. On each appearance it:

- picks **one variant** at random (Cream / Night / Mihrab), never repeating the
  immediately previous variant;
- picks **one content entry** at random from the active pool, not repeating any
  entry already shown in the current device session (LRU within session).

Selection happens when the slide becomes active (driven off
`CarouselLayout`'s `onSlideChange`, which only fires on real slide changes), so
a fresh look is chosen each time prayer-times surfaces.

**Canvas:** fixed 1920×1080, scaled to the physical display via
`transform: scale()` (deterministic layout on smart-TV browsers). A new
self-contained `prayer-display.css` is ported verbatim from `variants.css`; all
rules are already scoped under `.pd-screen` / `.pd-*`, so they don't collide
with the kiosk's Tailwind.

**Fonts:** Fraunces, Inter, Amiri, Amiri Quran, loaded in the kiosk layout.
Gate first paint on `document.fonts.ready` (Amiri Quran renders broken before
metrics load). Self-hosting fonts for offline use is deferred.

### 2. Content store

New per-tenant Payload collection **`prayer-display-content`**:

```ts
{
  kind: 'ayah' | 'hadith' | 'dua' | 'bismillah'
  arabic: string      // required, with diacritics
  english: string     // required (translation)
  citation: string    // free-form, e.g. "Surah An-Nisāʾ · 4:103"
  active: boolean      // default true
  tenant: relationship // per-tenant scoping
}
```

- **Validation:** Arabic and English required. (No tags, weights, preview, or
  scraping.)
- **`kind` is a label only** — it does NOT constrain which variant shows an
  entry. Variants are pure visual treatments; any entry can appear in any
  variant. `kind` drives the optional hero eyebrow (§3) and admin organization.
- **Selection:** random from the active pool, kind-agnostic, no-repeat within
  the device session.
- **Fallback:** if the active pool is empty, fall back to a shipped seed list
  (~20 ayahs, ~20 hadith, Bismillah). Seed data lives in code and is also used
  to seed a tenant's collection on creation.
- **Delivery:** the active content pool ships inside the existing
  `/api/kiosk/state` payload (≈40 small rows — negligible weight), so the client
  picks locally with no extra fetch. Editing content in admin must bump the
  state `version` hash so screens pick up changes (fold content updatedAts into
  `versionHash`).

### 3. Hero rendering

One generic hero shape — `{ arabic, english, citation, eyebrow? }` — rendered
three ways via each variant's CSS classes. The designer's variant-specific hero
markup (`.pd-bismillah`, `.pd-verse`, `.pd-hadith-*`) converges onto this single
component that applies the right class set per variant. Layout:

- Arabic (Amiri Quran) → English translation (Fraunces) → citation.
- Eyebrow text is derived from the entry's `kind` ("Ayah" / "Hadith" / "Du'a";
  none for `bismillah`), so it stays accurate in any variant.

### 4. Prayer timetable + next-prayer

Five columns from today's schedule: Arabic name (Amiri) → English (Fraunces) →
adhan time (Fraunces) → `Iqamah · h:mm` (Inter caps).

- Reuse the existing next-prayer computation (smallest adhan > now, rolls to
  Fajr after Isha). Port the subtle highlight: `NEXT` eyebrow, 2px gold rule,
  faint gold-cream wash, gold iqamah line. No animation.
- **Friday:** the Dhuhr column uses `jummahTimes` from the schedule.

### 5. Topbar data

- Venue name → `tenant.name`.
- City → **new `tenant.displayCity` field** (the address blob isn't reliably
  parseable). Empty-safe if unset.
- Live clock → browser clock, re-rendered each minute.
- Date → **Hijri via `Intl.DateTimeFormat` islamic calendar** (client-side, no
  API) + Gregorian. Aladhan source + per-day override deferred.

### 6. Salah-in-progress takeover

A **kiosk-wide overlay** rendered above the carousel. When active it covers the
entire screen with `VariantSalah`; the carousel keeps running underneath and
resumes seamlessly when the takeover clears.

- **Auto trigger:** the client computes from today's iqamah times — at each
  prayer's iqamah, show the takeover for `tenant.salahHoldoverMinutes` (new
  field, **default 15**, applied to all prayers), then clear. Friday Dhuhr keys
  off the jummah time.
- **Manual trigger:** an admin button (kiosk admin) sets a tenant-level
  `salahManualUntil` timestamp (`now + holdover`); the kiosk reads it via the
  state poll and takes over until that time, or until an admin "End now" sets
  `salahManualClearedAt`. Manual triggers are tenant-wide (all that tenant's
  displays), matching the existing `kioskBroadcastAt` pattern.
- **Header:** substitutes live values, e.g. `Now praying — Maghrib · Iqamah
  8:33 PM`.
- **Endpoint:** new `POST /api/kiosk/salah` for manual trigger/clear, mirroring
  the auth pattern of `push`/`reset` (`payload.auth` + tenant scoping,
  `overrideAccess: false`).

### 7. Configurable dwell

New tenant field **`prayerDisplayDwellSeconds`**, **default 10** (bounds 5–60),
passed through `/api/kiosk/state` and used as the prayer-times slide's
`durationMs` on the client (replacing the hardcoded 15000).

## Backend touch-list

- New collection `prayer-display-content` (+ seed data in code, + per-tenant
  seeding on tenant creation).
- `Tenants` new fields: `displayCity`, `salahHoldoverMinutes`,
  `prayerDisplayDwellSeconds`, `salahManualUntil`, `salahManualClearedAt`.
- `composeKioskState` / `/api/kiosk/state`: add active content pool, salah
  config + manual state, and the dwell value; fold content updatedAts into
  `versionHash`.
- New `POST /api/kiosk/salah` (manual trigger/clear).
- Migration for the new collection + tenant fields.

## Data flow

```
Admin edits content / clicks "Salah now"
        │
        ▼
Payload (prayer-display-content, tenant.salahManualUntil)
        │
GET /api/kiosk/state (every 5s)  ──►  { tenant, prayerTimes, slides,
        │                                contentPool, salah{...},
        ▼                                dwellSeconds, version }
Kiosk PrayerDisplay
   • picks variant (no immediate repeat) + content (no session repeat)
   • renders timetable from prayerTimes (Friday → jummahTimes)
   • computes auto-salah window from iqamah times + holdover
   • shows takeover overlay when auto OR manual window is active
```

## Testing

Unit tests:

- Variant pick: never repeats the immediately previous variant.
- Content pick: no repeat within session; falls back to seed when pool empty.
- Next-prayer computation, including Friday jummah substitution.
- Salah auto-trigger window math (iqamah + holdover boundaries).
- Manual-trigger expiry and "End now" clear behavior.
- `versionHash` changes when content is edited.

Manual verification:

- Render the actual variants on a kiosk display (TV rendering, font load,
  scale-to-fit) — this cannot be fully validated from the dev environment and
  will be called out as manual, not asserted as passing.

## Open items (small, resolve during implementation)

- Exact bounds/format for `prayerDisplayDwellSeconds` (seconds vs ms in schema).
- Whether `displayCity` should auto-suggest from `contactInfo.address` on save
  (nice-to-have, not required).
