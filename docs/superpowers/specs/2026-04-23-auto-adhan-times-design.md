# Auto-calculate Adhan times from masjid address

**Issue:** [#19](https://github.com/majidtahir1/open-masjid/issues/19)
**Branch:** `feat/19-auto-adhan-times`
**Status:** Design approved, implementation plan next

## Goal

Replace the manual per-season prayer-schedule entry with a range-based flow where admins pick a date range, the system computes daily adhan times from the masjid's location + calculation method, and admins configure iqamah times in bulk (with per-day override).

## Non-goals

- Hijri calendar display on the prayer card
- DST transition warnings
- Platform-owner "generate for all tenants" bulk action
- Caching adhan output beyond what's already stored in `days[]`

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Data model | Daily precision (per-day rows) | Accurate by default; masjid admins wanted it |
| Daily-row storage | Embedded `days[]` array on `PrayerSchedule` | Typical ranges are 30–120 days; one-doc model keeps bulk-apply trivial. Revisit if year-long ranges become common. |
| Iqamah input | Per-prayer choice: absolute time OR offset from adhan | Maghrib is commonly offset; others are commonly absolute |
| Jummah | Stays range-level `jummahTimes[]`, applied to all Fridays in the range | Matches current mental model; most masajid don't vary Jummah week-to-week |
| Adhan library | [`adhan`](https://github.com/batoulapps/adhan-js) (batoulapps) | MIT, zero deps, pure calculation, widely used |
| Geocoding | [Nominatim](https://nominatim.org/) (OSM) on address save | Free, no key; needs a proper User-Agent per policy. Manual override always available. |
| Tenant calc config | Per-tenant (not per-schedule): method + asr madhab + lat/lng + timezone | Generally stable per masjid; keeps schedule form simple |
| Existing seeded schedules | Delete + re-seed with new shape | Pre-production; no users on the public site yet |
| Timezone field | Ship here (overlaps with #15) | Adhan calculation needs IANA timezone; #15 becomes "localize admin date inputs" after this lands |

## Architecture

### Tenants collection (new fields)

```ts
{
  location: {
    lat: number,
    lng: number,
    timezone: string, // IANA, e.g. 'America/Chicago'
  },
  prayerCalc: {
    method: 'ISNA' | 'MWL' | 'Egyptian' | 'UmmAlQura' | 'Karachi' | 'Tehran' | 'Jafari',
    asrMadhab: 'Standard' | 'Hanafi',
  }
}
```

- Method default: `ISNA` (North-America-heavy tenant base).
- Madhab default: `Standard`.
- `beforeChange` hook on Tenants: if `contactInfo.address` changed AND `location.lat/lng` empty, geocode via Nominatim. Populate lat/lng; leave timezone alone (admin must confirm/pick — geocoders don't reliably return IANA zones).
- Admin UI: new "Prayer Calculation" tab in the Tenants doc view.

### PrayerSchedules collection (reshaped)

**Range-level fields:**

```ts
{
  name: string,
  startDate: Date,   // required
  endDate: Date,     // required (NEW)
  notes: string,
  iqamahRules: {
    fajr:    { mode: 'absolute' | 'offset', value: string | number },
    zuhr:    { mode: 'absolute' | 'offset', value: string | number },
    asr:     { mode: 'absolute' | 'offset', value: string | number },
    maghrib: { mode: 'absolute' | 'offset', value: string | number },
    isha:    { mode: 'absolute' | 'offset', value: string | number },
  },
  jummahTimes: Array<{ time: string }>,   // unchanged
  days: Array<PrayerDay>,                 // NEW
  tenant: Relationship<Tenant>,
}
```

**Per-day row (`days[]`):**

```ts
PrayerDay = {
  date: Date,
  fajr:    { adhan: string, iqamah: string },
  zuhr:    { adhan: string, iqamah: string },
  asr:     { adhan: string, iqamah: string },
  maghrib: { adhan: string, iqamah: string },
  isha:    { adhan: string, iqamah: string },
}
```

**iqamahRules semantics:**
- `mode: 'absolute'` — `value` is a time string (`'5:45 AM'`); written verbatim to every day's iqamah for that prayer.
- `mode: 'offset'` — `value` is an integer (minutes); written as `adhan + N min`, formatted via the same formatter used for adhan.

**Defaults when creating a new schedule:** Fajr/Zuhr/Asr/Isha = `{mode: 'absolute', value: ''}`; Maghrib = `{mode: 'offset', value: 5}`.

### Generation flow

1. Admin creates `PrayerSchedule` with `name`, `startDate`, `endDate`, `iqamahRules`, `jummahTimes`.
2. Clicks **"Generate times"** button (custom admin component at top of the doc).
3. Server action:
   - Loads tenant's `location` + `prayerCalc`. If missing, rejects with a clear error.
   - For each date in `[startDate, endDate]`, calls `adhan` library → computes Fajr/Zuhr/Asr/Maghrib/Isha adhan times in the tenant's timezone.
   - Applies `iqamahRules` per prayer to produce iqamah.
   - Replaces `days[]` wholesale. Shows toast with day count.
4. Confirm modal on re-run: "This will overwrite N days. Continue?"

### "Apply iqamah to range" flow

- Separate button next to "Generate times".
- Reapplies only iqamah from `iqamahRules`, preserves existing adhan in `days[]`.
- Use case: admin tweaks Maghrib offset from 5 → 10 min without re-running geolocation math.
- Same overwrite-confirm modal.

### Per-day override

- Standard Payload array UI lets admins expand any `days[]` entry and edit individual fields.
- No "overridden" flag; re-running bulk actions overwrites. Admin is explicitly choosing.

### Guardrails

- "Generate times" disabled when tenant `location.lat/lng` or `prayerCalc.method` is missing. Tooltip links to tenant settings.
- `startDate > endDate` → validation error.
- Range > 400 days → warn with confirm ("this will create 400+ entries").
- Adhan calc happens server-side (Payload endpoint or server action). Bundle stays lean.

### Public site render

- "Active schedule now" query: the `PrayerSchedule` where `startDate <= today <= endDate`. If multiple match, pick the one with the highest `startDate`.
- Find today's entry in `days[]` by date match.
- On Fridays: replace Zuhr iqamah with `jummahTimes[]` (existing behavior, no change).
- No active schedule or no today entry → "Prayer times coming soon" (existing copy).

### Affected files (preliminary)

**New:**
- `src/admin/GenerateTimesButton.tsx` — custom component on the PrayerSchedule edit view
- `src/lib/adhan.ts` — wrapper around the `adhan` library
- `src/lib/geocode.ts` — Nominatim client (+ User-Agent per their policy)
- `src/app/api/payload-custom/generate-prayer-times/route.ts` — Payload endpoint for the server action (or a Payload custom endpoint registered in `payload.config.ts`)

**Modified:**
- `src/collections/Tenants.ts` — add `location`, `prayerCalc`; geocode hook
- `src/collections/PrayerSchedules.ts` — add `endDate`, `iqamahRules`, `days[]`
- `src/app/(site)/prayer-times/page.tsx` and any `TodayPrayerStrip` component — read from `days[]`
- `src/admin/ActiveScheduleBanner.tsx` — update copy
- `scripts/seed.ts` — re-seed with new shape
- `src/payload-types.ts` — regenerated

### Migration

- **Delete and re-seed.** No users on the public site; staging DBs can `docker compose down -v && npm run seed`.
- No one-shot migration script.

## Testing

- Unit tests for `src/lib/adhan.ts` — verify a known date in a known location against published timetables (e.g., ICP Prosper vs IslamicFinder for a Summer 2026 date).
- Unit tests for iqamah rule application — absolute + offset + edge cases (offset > 60 min, negative offsets).
- Integration: seed new tenant → set address → verify geocode fills lat/lng → create schedule → generate → verify day count + first/last dates match.
- Manual QA: generate a 90-day range and spot-check adhan times at start/mid/end against a reference source. Verify Jummah still shows on Fridays on the public site.

## Rollout

Single PR merged to main. Feature flag not needed — pre-production, no users on the public site, and the old schema is being deleted.

## Open items for implementation plan

- Exact Payload endpoint vs server action pattern (pick whichever is idiomatic for Payload 3.39 — likely a custom endpoint since we need access to `payload` for DB writes and this isn't a React Server Action boundary we already have).
- Nominatim rate limits: 1 req/sec sustained. Debounce in the beforeChange hook or queue.
- Timezone picker UX: dropdown of common IANA zones vs free text? Leaning dropdown (~10 US zones + "other" for free entry).
- Where exactly does the "Generate times" button mount in the Payload admin edit view — `admin.components.beforeDocumentControls` or an inline `ui` field at the top of the form? Probably `ui` field so it's form-state-aware.
