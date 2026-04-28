# Hero — De-ICP-ify color tokens (deferred)

**Status:** Not implemented. Capture-only. Implement when we onboard a second tenant whose brand is not ICP navy/teal/gold.

## Problem

The hero variants we shipped on `feat/hero-variants` (commit `e2fb530…`, plus follow-ups) use raw ICP palette tokens directly in `src/components/hero/hero-variants.css`. Examples:

- Iqamah card background: `var(--icp-navy-700)`
- "Live" pulse + countdown sep: `var(--icp-teal-300)`, `var(--icp-teal-200)`
- Ayah citation, on-dark accents: `var(--icp-gold-300)`, `var(--icp-gold-700)`
- Live widget head, photo-bg gradient: `var(--icp-navy-700)`, `var(--icp-navy-900)`
- Geometric pattern strokes: hardcoded white at low opacity (fine — neutral)

Tenant-skinning middleware already injects per-tenant overrides for the **semantic** tokens (`--brand`, `--secondary`, `--accent`, etc.) at the top of every document. It does NOT override the raw `--icp-*` palette tokens, by design — those are the source palette and stay fixed. So today, every tenant's hero looks ICP-navy regardless of their configured colors.

The schema field `photoTone` ('teal' | 'gold' | 'navy') compounds the problem — those values are baked-in palette names, not semantic roles.

## Goal

Hero rendering respects whatever palette the current tenant has configured (via `branding.primaryColor` / `secondaryColor` / `accentColor` on the Tenant record), with no per-tenant code branches.

## Approach

### 1. CSS token swap (mechanical)

In `src/components/hero/hero-variants.css`, replace raw palette refs with semantic tokens:

| current | change to | reason |
|---|---|---|
| `var(--icp-navy-700)` | `var(--brand)` | navy is ICP's brand; semantic equivalent |
| `var(--icp-navy-900)` | `var(--brand-ink)` | already exists in globals.css |
| `var(--icp-navy-800)` | `var(--brand-press)` | likewise |
| `var(--icp-teal-300)` (countdown sep, on-dark accent) | `var(--secondary)` or a new `--secondary-on-dark` | secondary teal → tenant secondary |
| `var(--icp-teal-200)` (eyebrow on-dark, iqamah-at) | `color-mix(in oklab, var(--secondary) 70%, white)` or a new `--secondary-soft-on-dark` token in globals.css |
| `var(--icp-teal-100)` (active dot bg) | `var(--secondary-soft)` | already exists |
| `var(--icp-teal-50)` (now-icon bg, meta pill bg) | `var(--secondary-soft)` | likewise |
| `var(--icp-gold-300)` (ayah-cite, on-dark gold accent) | `var(--accent)` | accent = gold for ICP |
| `var(--icp-gold-100)` (teaser-date bg) | `var(--accent-soft)` | already exists |
| `var(--icp-gold-700)` (gold row label) | new `--accent-strong` token, OR `color-mix(in oklab, var(--accent) 70%, black)` |
| `var(--icp-cream)` (photo card bg) | `var(--bg-sand)` | tenant-overridable bg-sand exists |
| hardcoded `rgba(40,160,180,…)` glow on iqamah card | derive from `--secondary` via `color-mix` |
| hardcoded `rgba(184,149,79,…)` gold tints (gold-row gradient, dot bg) | derive from `--accent` via `color-mix` |

The `--icp-*` palette stays in `globals.css` as the canonical default, but no component CSS should reference it directly. Component CSS should only ever read semantic tokens.

### 2. New tokens to add in `globals.css`

Add 2–3 derived semantic tokens that the hero needs but don't exist yet:

```css
:root {
  --secondary-on-dark:    color-mix(in oklab, var(--secondary) 70%, #ffffff);
  --secondary-glow:       color-mix(in oklab, var(--secondary) 35%, transparent);
  --accent-strong:        color-mix(in oklab, var(--accent) 70%, #000000);
  --accent-tint:          color-mix(in oklab, var(--accent) 12%, transparent);
}
```

Verify browser support (Safari 16.4+, all modern). If we need to support older Safari, fall back to fixed rgba defaults overridable per-tenant via middleware (more verbose but reliable).

### 3. Rename `photoTone` enum

The field `photoFields.photoTone` currently has values `'teal' | 'gold' | 'navy'`. Rename to brand-neutral roles:

| old | new | maps to |
|---|---|---|
| `teal` | `secondary` | `var(--secondary)` |
| `gold` | `accent` | `var(--accent)` |
| `navy` | `brand` | `var(--brand)` |

Steps:

1. Update `HeroPhotoFields.photoTone` and `HeroSplitFields.photoTone` types in `src/components/types.ts` (rename `PhotoTone` from teal/gold/navy → brand/secondary/accent).
2. Update `src/collections/HeroSlides.ts` select options (label and value).
3. Update default values: split → `'secondary'` (was `'teal'`), photo → `'brand'` (was `'navy'`).
4. Update `PlaceholderImg` palette lookup in `src/components/hero/parts.tsx` to read CSS variables instead of hardcoded hex stops, OR keep three named gradients but derived from semantic tokens at the SVG level.
5. **Migration**: add a new migration that:
   - alters the enum types (`enum_hero_slides_split_fields_photo_tone` and `..._photo_fields_...`) to add the new values, then UPDATEs existing rows from `teal→secondary`, `gold→accent`, `navy→brand`, then drops the old enum values. Postgres requires a multi-step approach (CREATE new enum, ALTER COLUMN TYPE USING the new enum + cast, DROP old enum).
   - Same for both `hero_slides` and `_hero_slides_v` (versions table).
6. Regenerate Payload types.

### 4. PlaceholderImg patterns

The 4 SVG patterns (arch / geometric / stars / lattice) currently use hardcoded color stops in the `palette` lookup. Two options:

- **A) CSS variables in SVG** — set `style="color: var(--brand)"` on the pattern container and reference `currentColor` inside the SVG. Works well for stroke-based patterns (geometric, lattice). The `arch` and `stars` patterns mix several opacities of white-on-tone, which already lean neutral.
- **B) Compute palette from a CSS-var read** — use `getComputedStyle` at first paint to resolve `--brand`, `--secondary`, `--accent` to hex, then feed into the radial-gradient stops. Slightly heavier but allows multi-stop gradients.

Recommend (A) for v1: replace the hardcoded `palette[tone].a / .b` with `currentColor` + `color-mix` in the SVG, and let the parent set color via CSS class.

### 5. Acceptance check

After implementation, manually verify:

- Open `localhost:3000` as the ICP tenant — hero looks identical to today (same navy/teal/gold).
- Spin up a second seed tenant with `branding.primaryColor: '#7c3aed'` (purple), `secondaryColor: '#22c55e'` (green), `accentColor: '#f59e0b'` (orange). Visit that tenant's domain — the iqamah card is now purple, the ayah cite is orange, the live pulse is green. No code branches.

### 6. Out of scope for this work item

- Tenant-scoped *enabled hero styles* (allowlist per tenant). Not needed — all 4 layouts are universal primitives.
- Per-tenant *default photo pattern* / *default ayah*. Could be a separate field on Tenant (`branding.defaultHeroPhotoPattern`, `branding.defaultAyah`) that pre-fills new slides; orthogonal to the color-token refactor and can ship independently.
- Recoloring the `om-hero-bg` ornament SVG (the radial-gradient + sparkle pattern in the section background). Currently uses literal hex; harmless because it's so subtle, but could swap to `currentColor` in a follow-up.

## Files touched (when we do this)

- `src/app/globals.css` — add 3–4 derived semantic tokens.
- `src/components/hero/hero-variants.css` — bulk swap of `--icp-*` → semantic tokens.
- `src/components/hero/parts.tsx` — `PlaceholderImg` palette → CSS variables.
- `src/components/types.ts` — `PhotoTone` enum rename.
- `src/collections/HeroSlides.ts` — select options + defaults.
- `src/migrations/<timestamp>_hero_photo_tone_rename.ts` — enum rename + data migration.
- Regenerate `payload-types.ts`.

Estimated effort: 3–4 hours including the migration testing on a copy of prod data.
