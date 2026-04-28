# Hero Variants — Session Handoff

**Branch:** `feat/hero-variants` (pushed to origin)
**Plan:** `docs/superpowers/plans/2026-04-27-hero-variants.md`
**Design source:** `ICP Prosper Design System.zip` at repo root → unpacked Hero kit at `ui_kits/website/Hero.jsx` and `ui_kits/website/hero-v2.css` inside the zip.

## Goal

Port the 4 hero variants from the ICP design kit into production, with a per-slide style picker in the Payload admin and live-data wiring for the variants that need it.

| key | layout | default accent | extra fields |
|---|---|---|---|
| `original` | centered single column (current) | `cream` | — |
| `split` | copy left + right card stack (next iqamah, photo, up next) | `cream` | photoLabel, photoTone, cardTag, cardTitle, image |
| `live` | copy left + "Right now at ICP" widget right | `cream` | — (rows are auto from prayer + events) |
| `photo` | full-bleed dark + side panel (next iqamah + ayah) | `navy` | photoLabel, photoTone, image, ayahArabic, ayahTranslation, ayahCitation |

## Locked decisions

1. **Per-slide style** with a fixed section height + crossfade between variants in the carousel (so layout shift between adjacent slides feels less janky).
2. **`accent` field stays.** Each variant has a built-in default; user can override per slide.
3. **Variant-specific fields** are conditional Payload `group`s shown only when `style` matches.
4. **Live data scope:** next iqamah card + next 2 upcoming events. No halaqa/iftar special rows.
5. **Optional `image` upload** for `split` and `photo`; CSS placeholder fallback.
6. Ship via PR on `feat/hero-variants` → merge → `git pull` on web03 → `docker compose -f docker-compose.prod.yml build app && up -d app`.

## ✅ Done in this session

Commit `e2fb530` on `feat/hero-variants`:

- **Plan file** — `docs/superpowers/plans/2026-04-27-hero-variants.md`
- **`src/components/types.ts`** — added `HeroStyle`, `PhotoTone`, `HeroSplitFields`, `HeroPhotoFields`, `HeroLiveData`; extended `HeroSlideLike` with optional `style`, `splitFields`, `photoFields`.
- **`src/collections/HeroSlides.ts`** — added the `style` select field (default `'original'`) and the conditional `splitFields` / `photoFields` groups. Updated `accent` field's description to reflect the new default-from-style behavior.
- **`src/hooks/applyHeroStyleDefaults.ts`** — `beforeChange` hook that auto-syncs `accent` to the variant's design default (`navy` for `photo`, `cream` otherwise) when the user hasn't actively chosen one. Explicit accent choices are preserved on subsequent edits.
- **`src/lib/eventToHeroSlide.ts`** — auto-generated event slides now set `style: 'original'`.

**Production safety:** nothing changes for existing slides. `style` defaults to `'original'` and `Hero.tsx` is untouched, so rendering is identical to today.

## 🟡 Remaining work

### 1. Database migration (must be first — schema changes are committed but no migration yet)

Local dev box, with dev DB running:

```bash
docker compose up -d            # local Postgres on 5433
npx payload migrate:create hero_variants
```

Verify the generated SQL adds:
- `hero_slides.style` column (text, default `'original'`)
- `hero_slides.split_fields_*` columns (group fields are flattened)
- `hero_slides.photo_fields_*` columns
- An `hero_slides.split_fields_image_id` FK to `media`
- An `hero_slides.photo_fields_image_id` FK to `media`

Production already has hero_slides rows; the default makes the migration safe.

### 2. Regenerate Payload types

```bash
npm run generate:types
```

Confirm `payload-types.ts` picks up the new fields and the `style` enum.

### 3. Hero.tsx refactor

Current `src/components/Hero.tsx` is one big function. Split into:

```
src/components/
  Hero.tsx                    ← top-level: carousel state, controls, crossfade
  hero/
    HeroOriginal.tsx          ← what current Hero looks like (no behavior change)
    HeroSplit.tsx
    HeroLive.tsx
    HeroPhoto.tsx
    HeroCopy.tsx              ← shared eyebrow/title/body/meta/ctas/trust strip
    SlideControls.tsx         ← shared dot nav + counter + arrows
    BgOrnament.tsx
    PlaceholderImg.tsx
    NextIqamahCard.tsx        ← server-supplied data, client countdown
    LiveWidget.tsx            ← next iqamah + upcoming events
    AyahCard.tsx
    hero-variants.css         ← ported from kit
```

Reference implementation at `ICP Prosper Design System.zip` → `ui_kits/website/Hero.jsx`. The kit version is React-without-bundler (uses CDN React, lucide CDN, `onNav` callback) — adapt to:
- Next.js `<Link>` for internal nav
- `lucide-react` (already imported elsewhere)
- Existing helpers `resolveCtaHref`, `isExternal`, `usePrefersReducedMotion`, `LucideIconByName`
- Existing CSS tokens (`bg-bg`, `text-fg1`, `text-brand`, `border-border`, etc.)

**Crossfade between variants** — the four variants render at different heights in the kit. Strategy: stack all slides absolutely-positioned inside a 620px section; transition opacity. Each variant's content stays within that height (or scrolls internally if needed for `live` widget content overflow).

### 4. CSS port

Source: `ui_kits/website/hero-v2.css` inside the zip (446 lines).

- Replace `icp-` class prefix with `om-hero-`
- Replace kit's hardcoded colors with existing CSS variables where possible (look at `colors_and_type.css` in the zip vs. `tailwind.config.ts`)
- Save as `src/components/hero/hero-variants.css`
- Import from `Hero.tsx`

### 5. Live data utils

New file `src/lib/getHeroLiveData.ts`:

```ts
export async function getNextIqamah(tenantId: number): Promise<{
  name: string
  atTime: string
  secondsUntil: number
} | null>

export async function getUpcomingEvents(tenantId: number, limit = 2): Promise<Array<{
  id: number
  title: string
  when: string
  href: string
}>>
```

`getNextIqamah`: pull active prayer schedule for tenant, find next iqamah in today's `days[]`; if past Isha, roll over to tomorrow's Fajr. Return display string + seconds-until.

`getUpcomingEvents`: query Events where `status='published'` AND `startDate >= now`, sort ascending, limit N.

Both wrap in try/catch and return null/empty on error so a data failure doesn't block hero render.

### 6. Wire from page

`src/app/(site)/page.tsx`:

```ts
const liveData: HeroLiveData = {
  nextIqamah: await getNextIqamah(tenant.id),
  upcomingEvents: await getUpcomingEvents(tenant.id, 2),
}
return <Hero slides={slides} liveData={liveData} />
```

`Hero.tsx` accepts the new prop and passes it down to variants that need it (`split` for `NextIqamahCard`, `live` for the widget, `photo` for `NextIqamahCard`).

### 7. Tests

Vitest:
- `src/lib/getHeroLiveData.test.ts` — hour boundaries, post-Isha rollover, no-schedule fallback
- `src/components/hero/__snapshots__/` — render each variant with mock slide data

### 8. Manual QA

```bash
npm run dev
```

Visit `http://localhost:3000` (default tenant) and exercise:
- Each variant renders correctly at its baseline
- Carousel rotation between mixed-variant slides crossfades cleanly (no layout pop)
- Reduced-motion preference disables the crossfade
- Keyboard arrow nav still works
- Mobile breakpoint (<640px) — kit's split/live widgets need to stack
- NextIqamah countdown ticks down once per second, doesn't drift
- Upcoming events list updates if you publish a new event

### 9. PR + deploy

```bash
gh pr create --base main --head feat/hero-variants \
  --title "feat: hero variants — per-slide layout styles" \
  --body-file <hand-written summary>
```

After merge, on web03:

```bash
cd /opt/openmasjid
git pull
docker compose -f docker-compose.prod.yml build app
docker compose -f docker-compose.prod.yml up -d app
docker compose -f docker-compose.prod.yml logs --tail=30 app   # watch migration apply
```

The migrator stage will pick up the new migration on container start and apply it before the `app` service comes up.

## Risks / things to remember

- Existing prod slides: 1 ICP slide as of this session. Migration will default it to `style='original'` — visually identical to today. Verify after deploy.
- `accent` hook (`applyHeroStyleDefaults`) only auto-flips on style changes. If a user picks `photo` style during *creation* and then saves, accent goes to `navy`. If they later change to `original`, accent stays `navy` unless they edit it (intentional — don't surprise users).
- Live data is pulled per-request on the home page; on a tenant with hundreds of events, paginate `getUpcomingEvents` with `limit + sort` (already noted; just don't accidentally fetch all events).
- Kit's `NextIqamahCard` uses a setInterval countdown. In Next.js 15, this must be a `'use client'` component. Server passes `secondsUntil` as initial state; client decrements.
- The kit's `live` variant has hardcoded "Sisters' halaqa" + "Community Iftar" rows. These are out of scope — replace with up to 2 dynamic event rows or a "no upcoming events" state.

## Files to read first when resuming

1. `docs/superpowers/plans/2026-04-27-hero-variants.md` — original plan
2. This file
3. `ICP Prosper Design System.zip` → `ui_kits/website/Hero.jsx` (source variants) and `hero-v2.css`
4. `src/components/Hero.tsx` (current implementation — your refactor target)
5. `src/components/types.ts` (already extended)
6. `src/collections/HeroSlides.ts` (schema already updated)
