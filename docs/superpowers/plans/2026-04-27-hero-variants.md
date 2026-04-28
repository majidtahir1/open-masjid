# Hero Variants — Implementation Plan

Per-slide hero layout selector (4 variants from ICP design kit), with sensible defaults so the existing single-layout hero becomes one of the new variants without content edits.

## Decisions (locked)

1. **Per-slide style**, with fixed section height + crossfade between slides to soften the layout shift between variants in the carousel.
2. **`accent` field stays**, but each variant has a built-in default color treatment matching the kit. `accent` only overrides for compatible variants (`original`, `split`).
3. **Variant-specific fields** live in a conditional Payload `group` that shows based on the chosen `style`.
4. **Live data wiring scope**: next iqamah card + next 2 upcoming events. No halaqa/iftar special rows.
5. **Optional `image` upload** for `split` and `photo` variants; CSS placeholder if absent.
6. Implemented on `feat/hero-variants` branch; deployed via PR → merge → `git pull` + `docker compose ... build app && up -d`.

## Variants

| key | layout | default accent | extra fields |
|---|---|---|---|
| `original` | centered single column (current) | `cream` | — |
| `split` | copy left + right card stack (next iqamah, photo, up-next teaser) | `cream` | `photoLabel`, `photoTone`, `cardTag`, `cardTitle`, `image` |
| `live` | copy left + "Right now at ICP" widget right | `cream` | — (rows are auto from prayer + events) |
| `photo` | full-bleed dark + side panel (next iqamah + ayah) | `navy` | `photoLabel`, `photoTone`, `image`, `ayahArabic`, `ayahTranslation`, `ayahCitation` |

`split` and `live` use the same outer copy treatment (light cream); `photo` is the only dark variant.

## Files

### Data model
- **`src/collections/HeroSlides.ts`** — add `style` select; conditionally show `splitFields` group, `photoFields` group; `accent` default per `style`.
- **`src/lib/eventToHeroSlide.ts`** — set `style: 'original'` (current behavior) on auto-generated event slides; later we can let tenant pick a default.
- **migration** — `npx payload migrate:create hero_variants` adds columns to `hero_slides` table. Existing rows default `style='original'` so production content is untouched.
- **`payload-types.ts`** — regen via `npm run generate:types`.

### Component layer
- **`src/components/types.ts`** — extend `HeroSlideLike`:
  - `style: 'original' | 'split' | 'live' | 'photo'`
  - `splitFields?: { photoLabel?: string; photoTone?: 'teal'|'gold'|'navy'; cardTag?: string; cardTitle?: string; image?: string }`
  - `photoFields?: { photoLabel?: string; photoTone?: 'teal'|'gold'|'navy'; image?: string; ayahArabic?: string; ayahTranslation?: string; ayahCitation?: string }`
- **`src/components/Hero.tsx`** — refactor into:
  - Top-level `Hero` (existing carousel state, controls, crossfade)
  - `HeroOriginal`, `HeroSplit`, `HeroLive`, `HeroPhoto` subcomponents
  - Shared `HeroCopy`, `SlideControls`, `BgOrnament`, `PlaceholderImg`
  - New `NextIqamahCard` (client countdown, server-supplied `nextIqamah` prop)
  - New `LiveWidget` (renders 1 iqamah row + N event rows from props)
  - New `AyahCard`
- **CSS** — port `hero-v2.css` adapted to existing tokens (`bg-bg`, `text-fg1`, etc.). Place as `src/components/hero-variants.css` and import in `Hero.tsx` (Next.js supports component-scoped CSS imports). Avoid mixing in tailwind for variant-specific complex layouts where the CSS is already tuned.

### Live data
- **`src/lib/getHeroLiveData.ts`** (new) — server util:
  - `getNextIqamah(tenantId): { name, atTime, secondsUntil } | null`
  - `getUpcomingEvents(tenantId, limit=2): EventTeaser[]`
- **`src/app/(site)/page.tsx`** — fetch live data, pass to `<Hero>` as `liveData` prop.
- Hero component conditionally renders the live cards if `liveData` is present and the active slide's variant needs it.

### Tests
- Add a `vitest` test for `getNextIqamah` (hour boundaries, post-isha rollover to fajr).
- Snapshot test for each variant rendering with mock slide data.

## Step-by-step execution

1. **Branch + plan** ✅ (this file).
2. **Types** — extend `HeroSlideLike`, add new variant interfaces.
3. **Collection** — `style` field, conditional groups, accent defaults via `defaultValue` hook.
4. **Migration** — generate, verify SQL, default existing rows to `original`.
5. **CSS port** — copy `hero-v2.css`, replace kit-specific class prefixes with `om-hero-` and align colors with existing tokens.
6. **Component skeleton** — split Hero.tsx into the new structure with `HeroOriginal` doing exactly what current Hero does, plus stub variants. Verify no regression on existing slides.
7. **HeroSplit** — implement card stack; stub NextIqamah with hardcoded data first; integrate live data after.
8. **HeroLive** — implement widget; stub data; integrate live data.
9. **HeroPhoto** — implement full-bleed; integrate ayah card; integrate NextIqamah live.
10. **Live data utils** — `getNextIqamah`, `getUpcomingEvents`; wire from `page.tsx`.
11. **Crossfade + fixed height** — single 620px section, stacked variants, opacity transition.
12. **Manual QA** — local dev, all 4 variants, carousel rotation, reduced motion, keyboard nav, mobile breakpoints.
13. **Tests** — vitest.
14. **PR**.

## Risk + rollback

- Default `style='original'` means existing prod slides render identically. Worst case if Hero refactor breaks: revert PR, redeploy.
- Migration is additive only (new columns, all nullable). No down-migration risk for prod data.
- Live data fetch failure on home page should not block render — `getHeroLiveData` wraps each call in try/catch and returns null on failure; variants degrade to placeholder content.

## Out of scope

- Animated transitions between variants (fade is enough)
- Per-tenant default style picker (later — for now slides choose individually)
- Mobile-specific variant layouts beyond what the kit covers
- Real photo crop/focal-point controls (Media collection has no focal point yet)
