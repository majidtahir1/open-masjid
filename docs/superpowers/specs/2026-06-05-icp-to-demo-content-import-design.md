# ICP → Demo Content Import — Design Spec

**Date:** 2026-06-05
**Status:** Approved design, pending implementation

## Goal

Populate the public demo tenant (`slug: demo`) with the ICP tenant's (`slug: icp`)
content — events, forms, announcements, services, hero slides, membership tiers,
donation funds — including **faithful media (image/PDF files)**, so the demo looks
real. This is a **one-time snapshot** (decoupled from ICP) that survives the
nightly reset.

## Context

- The demo's nightly reset (`src/lib/demo/seedDemoContent` via `/api/demo/reset`,
  fired by the `crond` sidecar) currently **wipes** events/announcements/forms and
  recreates a small hardcoded set from `src/lib/demo/demoContent.ts`. A one-time
  copy would be wiped tonight unless the reset stops wiping content.
- ICP is **not a live masjid yet** — no real congregant PII. We still skip
  members/donations/form-submissions/users as defence-in-depth.
- **Media is tenant-scoped** (`Media` collection, files on the `MEDIA_PATH`
  volume). A faithful copy must clone the files into the demo's library and remap
  references — not cross-reference ICP's media docs.
- Content slugs (events/forms/pages) are **indexed but not globally unique**, so
  copying ICP slugs into demo does not collide.
- **Prod has no `tsx`** (devDep pruned), but the import may run as a **DB script**
  (run via `node --env-file=.env --import tsx` from a host that can reach the prod
  DB and the `MEDIA_PATH` volume — i.e., on the prod server or a container with the
  volume mounted). It is not an HTTP endpoint.

## Architecture

### 1. Generic content cloner — `src/lib/demo/cloneTenantContent.ts`

`cloneTenantContent(payload, srcTenantId, destTenantId): Promise<CloneReport>`

- **Collection allow-list** (visible site content only):
  `services`, `hero-slides`, `events`, `forms`, `announcements`.
  Known upload-field paths: events → `flyerImage`; hero-slides →
  `splitFields.image`, `photoFields.image`. (services/forms/announcements have no
  uploads.)
  **Excluded:** `membership-tiers` and `donation-funds` stay demo-owned — the
  demo's tiers already sync to **test** Stripe and power the working checkout
  loop; ICP has none, so importing would break payments. Also never touches
  `members`, `donations`, `form-submissions`, `users`, `tenants`, `media` (cloned
  separately, below).
- **Media first:** clone every `media` doc owned by the source tenant into the
  dest tenant — read each source file from the media volume and `payload.create`
  a new media doc (Payload writes a fresh file). Build a `mediaIdMap`
  (oldMediaId → newMediaId).
- **Per-collection clone config** declares each collection's **upload fields**
  (paths that hold a `media` id, e.g. event image, hero background photo) and any
  **cross-content relationship fields**. For each source doc:
  - strip `id`, `createdAt`, `updatedAt`;
  - set `tenant = destTenantId`;
  - rewrite declared upload fields through `mediaIdMap`;
  - rewrite declared content relationships through that collection's id-map
    (collections are cloned in dependency order so referenced ids exist).
  - `payload.create` into the dest tenant with `overrideAccess` + a platformOwner
    seed req.
- **richText caveat:** top-level upload fields are remapped; media embedded
  *inside* richText bodies (if any) is left as-is (documented limitation — ICP's
  demo content is not expected to embed uploads inline).
- Returns a `CloneReport` (counts per collection, media copied) for logging.

### 2. One-time import script — `scripts/import-icp-to-demo.ts`

- Resolves both tenants **by slug** (`icp`, `demo`); throws a clear error if
  either is missing ("no tenant with slug 'icp'").
- **Wipes** the demo tenant's existing content + media first (idempotent
  re-runs), then calls `cloneTenantContent(payload, icpId, demoId)`.
- Logs the `CloneReport` and exits.
- Add `package.json` script: `"import:demo": "node --env-file=.env --import tsx scripts/import-icp-to-demo.ts"`.

### 3. Reset change — `src/lib/demo/seedDemo.ts`

- `seedDemoContent` **stops wiping and recreating** the imported content
  (`announcements`, `events`, `forms`; it never touched `services`/`hero-slides`).
  It retains: wipe **visitor transactional data** (`members`, `donations`,
  `form-submissions`), purge **non-canonical demo users**, and **keep the
  membership-tier upsert** (tiers stay synced to test Stripe) — so the payment
  loop keeps working while the imported site content persists.
- `ensureDemoTenant` and `ensureDemoAdmin` are unchanged; `resetDemoContent` still
  ensures tenant + admin.
- `demoContent.ts`: `demoEvents` / `demoAnnouncements` / `demoForm` (+ the
  `richText` helper if now unused) become dead and are removed;
  `demoMembershipTiers`, `demoTenantData`, `demoDonationConfig`, `DEMO_SLUG` are
  retained. Update `tests/lib/demo-seed.test.ts` accordingly (the wipe set no
  longer includes announcements/events/forms).

## Data flow (import)

1. Operator runs `npm run import:demo` (with prod `DATABASE_URI` + `MEDIA_PATH`).
2. Script resolves icp + demo tenant ids by slug.
3. Wipe demo content + media.
4. Clone media files icp→demo (build map) → clone each content collection,
   remapping uploads/relationships, `tenant = demo`.
5. Demo now mirrors ICP's content. Nightly reset preserves it (only clears
   transactional data).

## Error handling

- Missing `icp`/`demo` tenant → throw with the offending slug.
- A media source file missing on disk → skip that media doc, null its references,
  log a warning (don't abort the whole import).
- Per-doc create failure → log + continue (collected in the report), so one bad
  doc doesn't lose the rest.
- The script is idempotent: it wipes-then-clones, so re-running yields a clean
  copy.

## Testing

- **Unit (mock payload):** `cloneTenantContent` — given a mock payload returning
  source docs + media, asserts: media cloned first and id-map applied; PII
  collections never read/written; `tenant` set to dest on every create; upload
  fields remapped; ids/timestamps stripped.
- **Unit:** the reset no longer deletes content collections — assert
  `seedDemoContent` calls delete only for `members`/`donations`/`form-submissions`
  (+ users cleanup) and not for events/announcements/forms/tiers.
- **Manual:** run `import:demo` against a DB with ICP seeded; confirm demo shows
  ICP's events/forms/hero with working images; run a reset and confirm content
  persists.

## Scope / YAGNI

- One-time snapshot, not a nightly ICP mirror (decoupled per decision).
- No HTTP endpoint — a DB script.
- No inline-richText media remap (documented limitation).
- Kiosk slide collections (carousel/sponsor/weekly-events/qr/kiosks) are out of
  scope unless they prove needed — focus is the public-site content the user
  named (events, forms, etc.).
