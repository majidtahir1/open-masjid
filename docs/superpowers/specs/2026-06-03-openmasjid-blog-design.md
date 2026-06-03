# OpenMasjid Blog & Changelog — Design Spec

*Date: 2026-06-03*

## Summary

Add a blog/articles area plus a changelog to the OpenMasjid marketing site
(`openmasjid.app`). Content is authored WordPress-style in the existing Payload
admin (rich text, drafts, scheduled publish, SEO), not in code. A single
platform-level `Posts` collection backs two public surfaces: long-form
**articles** (`/blog`) and short **changelog** entries (`/changelog`).

## Goals

- Let the platform owner author and publish articles from the browser, no deploy.
- Provide an organic acquisition / SEO surface (feeds the existing hub-and-spoke
  internal-linking plan in `docs/marketing/site-architecture.md`).
- Provide a low-effort liveness signal (changelog) that tracks shipped features.
- Reuse existing patterns (`Pages` collection, `RichText`, `MarketingShell`,
  proxy rewrite, JSON-LD) — small build, low maintenance.

## Non-goals (YAGNI — revisit later)

Author profiles/photos, comments, categories beyond free-form tags, reading-time
labels, related-posts, full-text search, pagination (until volume warrants it).

## Context

- Marketing site is **platform-level** (served on `openmasjid.app`), unlike the
  rest of the Payload collections which are **tenant-scoped**. Posts are authored
  only by the platform owner; published posts are world-readable.
- The proxy (`src/proxy.ts`) rewrites `openmasjid.app/<path>` → internal
  `/marketing/<path>`, so files live under `src/app/(marketing)/marketing/*` but
  serve at clean root URLs.
- `/blog` already exists as a `PageStub`. `site-architecture.md` already reserves
  `/blog`, `/blog/[slug]`, and a footer **Changelog** link.
- `src/components/RichText.tsx` is a minimal Lexical renderer. It does **not**
  currently render inline uploaded images or code blocks.

## Data model — `Posts` collection (Payload)

New collection `posts`, **not tenant-scoped**. Patterns mirror
`src/collections/Pages.ts` (slug auto-gen hook, drafts + `schedulePublish`, SEO
sidebar group, `TextField` component on title).

| Field | Type | Notes |
|---|---|---|
| `title` | text, required | Heading + browser tab. |
| `slug` | text, indexed | Auto-generated from title via existing `slugify`/`autoSlug` pattern; editable; no dates in slug. |
| `kind` | select `article` \| `changelog`, default `article`, sidebar | Drives index membership + rendering. |
| `version` | text, optional, sidebar | Shown only when `kind = changelog` (e.g. `v1.4.0`). Optional. |
| `heroImage` | upload → `media` | Index card thumbnail, article header, default share image. |
| `tags` | array of text (each row a single `tag` text field) | Free-form, applies to both kinds; powers `?tag=` filter. |
| `author` | text, default `"OpenMasjid Team"` | Simple byline. |
| `publishedAt` | date, sidebar | Sort key + displayed date. |
| `content` | richText (Lexical) | Body. |
| `seo` | group: `title`, `description` (textarea), `ogImage` (upload→media), sidebar | Same group as `Pages`. |

**Excerpt:** no manual field — derive from the first paragraph of `content` for
index cards and meta description (helper that walks the Lexical tree for the
first `paragraph` node's text).

**Access:**
- `read`: public, **published only** for anonymous/non-owner (draft visible to
  platform owner / preview mode).
- `create` / `update` / `delete`: platform owner only.

**Versions:** `drafts: { schedulePublish: true }` (same as `Pages`).

**Admin:** group `Website`; `useAsTitle: 'title'`;
`defaultColumns: ['title', 'kind', 'publishedAt', 'slug']`; live preview +
preview URL pointing at `/blog/<slug>` (reuse `buildPreviewUrl` /
`buildLivePreviewUrl`).

Register in `src/payload.config.ts` collections array. Run
`payload generate:types` to update `src/payload-types.ts`.

## Routes & pages

All under `src/app/(marketing)/marketing/`, served at root via proxy.

- **`/blog`** (`blog/page.tsx`, replaces the stub): article index. Hero-image
  cards, reverse-chron by `publishedAt`. Reads `kind: article`, published only.
  Supports `?tag=<tag>` filter (server-side). Empty-state copy if none.
- **`/changelog`** (`changelog/page.tsx`): compact reverse-chron list of
  `kind: changelog` entries; renders each body inline (entries are short), with
  `version` (if set) + date labels. Empty-state copy if none.
- **`/blog/[slug]`** (`blog/[slug]/page.tsx`): canonical detail/permalink for any
  post regardless of kind. Layout adapted from `src/app/(site)/[slug]/page.tsx`:
  hero image, title, date, byline, tags, `RichText` body, max-width prose column.
  `generateMetadata` mirrors the `(site)/[slug]` SEO logic (canonical, OG type
  `article`, hero as share image, auto-excerpt as description). Supports draft
  preview mode for the owner.

Data fetched via Payload local API (`getPayload`) in server components, following
the `src/lib/data.ts` access pattern. Add small fetch helpers
(`fetchPosts({ kind, tag, draft })`, `fetchPostBySlug(slug, { draft })`).

## RichText extension

Extend `src/components/RichText.tsx` (backward-compatible) to render:
- `upload` nodes → inline `<img>` (resolve `value` media URL via `mediaUrl`),
  responsive, with caption/alt where available.
- `code` / `codeblock` nodes → `<pre><code>` with monospace styling matching the
  marketing design tokens.

Unknown nodes still degrade gracefully (existing behavior). This also improves
tenant page/event rendering for free.

## SEO & distribution

- Per-post metadata (title, description from SEO override or auto-excerpt),
  canonical URL, OG `article`, hero as share image, Twitter `summary_large_image`.
- **JSON-LD** `BlogPosting` on `/blog/[slug]` (reuse the JSON-LD approach already
  in `(marketing)/_components/OpenMasjidJsonLd.tsx`).
- **RSS feed** at `/blog/feed.xml` (route handler) listing published articles.
- Add published article + changelog URLs to the sitemap if one exists.

## Navigation & rollout

- **Header "Blog" link**: keep hidden until ~3 articles are published (same
  pattern `/showcase` uses — "hidden until 2–3 named tenants live"). Until then
  the route exists but is unlinked.
- **Footer "Changelog" link**: can go live as soon as the first entry exists.
- Breadcrumbs on `/blog/*` per `site-architecture.md` (optional, low priority).

## Testing

- Collection access: anonymous cannot read drafts; owner can; non-owner cannot
  write. Slug auto-generation. Draft → publish → scheduled-publish behavior.
- `RichText`: snapshot/unit tests for new `upload` and `code` nodes + existing
  nodes still render (no regression).
- Page rendering: `/blog` lists only published articles, `?tag=` filters,
  `/changelog` lists only changelog kind, `/blog/[slug]` 404s for missing/draft
  (when not in preview), metadata + JSON-LD present.
- RSS feed: valid XML, only published articles.

## Risks

- **Stale-blog risk** is the real one: a Blog link to old posts reads as
  abandoned. Mitigated by nav-gating (above), the changelog carrying cadence
  cheaply, and AI-assisted authoring lowering per-post cost. Build cost itself is
  small (reuses `Pages` machinery).
