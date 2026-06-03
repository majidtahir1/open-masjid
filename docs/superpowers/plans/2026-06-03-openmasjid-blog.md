# OpenMasjid Blog & Changelog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a WordPress-style blog (articles at `/blog`) and a changelog (`/changelog`) to the OpenMasjid marketing site, backed by a single platform-level Payload `Posts` collection authored entirely in the admin UI.

**Architecture:** A new non-tenant-scoped `Posts` collection (mirroring the existing `Pages` patterns: auto-slug, drafts + scheduled publish, SEO group) is the single source of truth. A `kind` field (`article` | `changelog`) splits it across two public surfaces. Server components under `src/app/(marketing)/marketing/` render the index, detail, and changelog pages via thin local-API fetchers in `src/lib/blog.ts`; the existing proxy rewrite serves them at clean root URLs (`/blog`, `/changelog`). The shared `RichText` renderer is extended to display inline images.

**Tech Stack:** Next.js App Router (server components), Payload CMS (lexical richText, local API), TypeScript, Vitest (unit/component tests via `react-dom/server`).

**Spec:** `docs/superpowers/specs/2026-06-03-openmasjid-blog-design.md`

**Deviation from spec (deliberate):** The spec calls for hiding the header "Blog" link until ~3 articles exist. Implementing that requires an async count query in the shared `MarketingHeader`, which would convert all otherwise-static marketing pages to dynamic rendering — a bad trade for a cosmetic gate. Instead: keep the existing header link, make `/blog` and `/changelog` render graceful empty states, and seed content before announcing. Revisit with an env-flag gate later if needed.

---

## File Structure

**Create:**
- `src/collections/Posts.ts` — the `Posts` collection config (data model, access, hooks).
- `src/lib/blog.ts` — server-only fetchers + the pure `extractExcerpt` helper.
- `src/app/(marketing)/marketing/blog/[slug]/page.tsx` — article/changelog-entry detail page.
- `src/app/(marketing)/marketing/changelog/page.tsx` — changelog index.
- `src/app/(marketing)/marketing/blog/feed.xml/route.ts` — RSS feed.
- `src/app/(marketing)/_components/PostJsonLd.tsx` — `BlogPosting` JSON-LD.
- `tests/collections/posts.access.test.ts` — access + schema tests.
- `tests/lib/blogExcerpt.test.ts` — `extractExcerpt` unit tests.
- `tests/components/richTextUpload.test.tsx` — RichText upload-node rendering test.

**Modify:**
- `src/payload.config.ts` — register `Posts` in the collections array.
- `src/lib/previewUrl.ts` — add `buildMarketingPreviewUrl` for slug-at-`/blog` preview.
- `src/components/RichText.tsx` — render `upload` (inline image) nodes.
- `src/app/(marketing)/marketing/blog/page.tsx` — replace the `PageStub` with the real article index.
- `src/app/(marketing)/_components/Footer.tsx` — point "Changelog" link at `/changelog`.
- `src/app/(marketing)/marketing.css` — append blog/changelog styles.
- `src/app/sitemap.ts` — add `/changelog` + published-article URLs to the marketing sitemap.

---

## Task 1: `Posts` collection

**Files:**
- Create: `src/collections/Posts.ts`
- Modify: `src/lib/previewUrl.ts`
- Modify: `src/payload.config.ts`
- Test: `tests/collections/posts.access.test.ts`

- [ ] **Step 1: Write the failing access + schema test**

Create `tests/collections/posts.access.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { Posts } from '@/collections/Posts'

function callAccess(op: 'read' | 'create' | 'update' | 'delete', user: any) {
  const access = Posts.access as Record<string, any>
  return access[op]({ req: { user } })
}

describe('Posts access', () => {
  it('anonymous can read published only', () => {
    expect(callAccess('read', undefined)).toEqual({ _status: { equals: 'published' } })
  })

  it('non-owner authenticated users still see published only', () => {
    expect(callAccess('read', { role: 'admin', tenant: 7 })).toEqual({
      _status: { equals: 'published' },
    })
  })

  it('platformOwner reads everything (incl. drafts)', () => {
    expect(callAccess('read', { role: 'platformOwner' })).toBe(true)
  })

  it('only platformOwner can write', () => {
    for (const op of ['create', 'update', 'delete'] as const) {
      expect(callAccess(op, undefined)).toBe(false)
      expect(callAccess(op, { role: 'admin', tenant: 7 })).toBe(false)
      expect(callAccess(op, { role: 'platformOwner' })).toBe(true)
    }
  })
})

describe('Posts schema', () => {
  const field = (name: string) =>
    (Posts.fields as any[]).find((f) => f.name === name)

  it('has no tenant field (platform-level collection)', () => {
    expect(field('tenant')).toBeUndefined()
  })

  it('kind defaults to article with two options', () => {
    const kind = field('kind')
    expect(kind.type).toBe('select')
    expect(kind.defaultValue).toBe('article')
    expect(kind.options.map((o: any) => o.value).sort()).toEqual(['article', 'changelog'])
  })

  it('enables drafts with scheduled publish', () => {
    expect(Posts.versions).toMatchObject({ drafts: { schedulePublish: true } })
  })

  it('hides the collection from non-platform-owners', () => {
    const hidden = Posts.admin?.hidden as (args: any) => boolean
    expect(hidden({ user: { role: 'admin' } })).toBe(true)
    expect(hidden({ user: { role: 'platformOwner' } })).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/collections/posts.access.test.ts`
Expected: FAIL — cannot resolve `@/collections/Posts` (module not found).

- [ ] **Step 3: Add the marketing preview-URL helper**

In `src/lib/previewUrl.ts`, append this exported function (the existing `buildPreviewUrl` is tenant-based and won't work for platform-level posts):

```ts
/**
 * Preview URL for a platform-level marketing doc whose slug renders under a
 * fixed path prefix on the marketing host (e.g. Posts → /blog/<slug>).
 * Unlike `buildPreviewUrl`, this does not resolve a tenant.
 */
export function buildMarketingPreviewUrl(
  doc: Record<string, unknown>,
  pathPrefix: string,
): string | null {
  if (!doc?.id) return null
  const slug = doc.slug as string | null | undefined
  if (!slug) return null
  const base =
    process.env.NODE_ENV === 'development'
      ? 'http://localhost:3000'
      : `https://${PLATFORM_DOMAIN}`
  const prefix = `/${pathPrefix.replace(/^\/+|\/+$/g, '')}`
  return `${base}${prefix}/${encodeURIComponent(String(slug))}?draft=1`
}
```

- [ ] **Step 4: Create the `Posts` collection**

Create `src/collections/Posts.ts`:

```ts
import type { CollectionConfig, FieldHook } from 'payload'

import { platformOwnerOnly } from '../access/tenantScoped'
import { buildMarketingPreviewUrl } from '../lib/previewUrl'

const slugify = (value: string): string =>
  value
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')

const autoSlug: FieldHook = ({ value, data, operation }) => {
  if (value) return value
  if (operation === 'create' && data?.title) return slugify(String(data.title))
  return value
}

// Stamp publishedAt the first time a post is published, if the editor left it blank.
const stampPublishedAt: FieldHook = ({ value, data }) => {
  if (value) return value
  if (data?._status === 'published') return new Date().toISOString()
  return value
}

export const Posts: CollectionConfig = {
  slug: 'posts',
  labels: { singular: 'Post', plural: 'Posts' },
  admin: {
    group: 'Website',
    useAsTitle: 'title',
    defaultColumns: ['title', 'kind', 'publishedAt', 'slug'],
    // Platform-level content — only the platform owner manages it.
    hidden: ({ user }) => (user as { role?: string } | null)?.role !== 'platformOwner',
    description:
      'Marketing blog articles and changelog entries for openmasjid.app. Articles render at /blog, changelog entries at /changelog.',
    preview: (doc) => buildMarketingPreviewUrl(doc, 'blog'),
    livePreview: {
      url: ({ data }) => buildMarketingPreviewUrl(data, 'blog') ?? '',
      breakpoints: [
        { label: 'Mobile', name: 'mobile', width: 375, height: 667 },
        { label: 'Desktop', name: 'desktop', width: 1440, height: 900 },
      ],
    },
  },
  versions: {
    drafts: { schedulePublish: true },
  },
  access: {
    // Public read of published; platform owner sees drafts too.
    read: ({ req: { user } }) => {
      if ((user as { role?: string } | null)?.role === 'platformOwner') return true
      return { _status: { equals: 'published' } }
    },
    create: platformOwnerOnly,
    update: platformOwnerOnly,
    delete: platformOwnerOnly,
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      label: 'Title',
      admin: { placeholder: 'How we run a masjid platform with AI agents' },
    },
    {
      name: 'kind',
      type: 'select',
      required: true,
      defaultValue: 'article',
      options: [
        { label: 'Article', value: 'article' },
        { label: 'Changelog Entry', value: 'changelog' },
      ],
      admin: {
        position: 'sidebar',
        description: 'Articles render at /blog; changelog entries at /changelog.',
      },
    },
    {
      name: 'version',
      type: 'text',
      label: 'Version',
      admin: {
        position: 'sidebar',
        placeholder: 'v1.4.0',
        condition: (data) => data?.kind === 'changelog',
        description: 'Optional version label shown on the changelog.',
      },
    },
    {
      name: 'slug',
      type: 'text',
      index: true,
      label: 'URL Slug',
      admin: {
        position: 'sidebar',
        placeholder: 'running-a-masjid-with-ai-agents',
        description: 'Auto-generated from the title. Lowercase, numbers, dashes.',
      },
      hooks: { beforeValidate: [autoSlug] },
    },
    {
      name: 'publishedAt',
      type: 'date',
      label: 'Published date',
      admin: {
        position: 'sidebar',
        description: 'Shown on the post and used for ordering. Set automatically on first publish if left blank.',
      },
      hooks: { beforeChange: [stampPublishedAt] },
    },
    {
      name: 'author',
      type: 'text',
      defaultValue: 'OpenMasjid Team',
      label: 'Byline',
      admin: { position: 'sidebar' },
    },
    {
      name: 'heroImage',
      type: 'upload',
      relationTo: 'media',
      label: 'Hero image',
      admin: {
        description: 'Shown on index cards, at the top of the article, and as the social-share image.',
      },
    },
    {
      name: 'tags',
      type: 'array',
      label: 'Tags',
      labels: { singular: 'Tag', plural: 'Tags' },
      admin: { description: 'Free-form topic tags. Power filtering on /blog.' },
      fields: [{ name: 'tag', type: 'text', required: true }],
    },
    {
      name: 'content',
      type: 'richText',
      label: 'Body',
      admin: { description: 'The article body. Supports headings, lists, links, and inline images.' },
    },
    {
      name: 'seo',
      type: 'group',
      label: 'SEO',
      admin: {
        position: 'sidebar',
        description: 'Optional overrides for search/social previews. Falls back to the title, auto-excerpt, and hero image.',
      },
      fields: [
        { name: 'title', type: 'text', label: 'SEO Title' },
        { name: 'description', type: 'textarea', label: 'Meta Description' },
        { name: 'ogImage', type: 'upload', relationTo: 'media', label: 'Share Image' },
      ],
    },
  ],
}

export default Posts
```

- [ ] **Step 5: Register `Posts` in the Payload config**

In `src/payload.config.ts`, add the import near the other collection imports (alphabetical with `Pages`):

```ts
import { Posts } from './collections/Posts'
```

Then add `Posts` to the `collections: [...]` array (right after `Pages,`):

```ts
    Pages,
    Posts,
    Forms,
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run tests/collections/posts.access.test.ts`
Expected: PASS (all access + schema cases).

- [ ] **Step 7: Typecheck the changed files**

Run: `npx tsc --noEmit`
Expected: no new errors in `Posts.ts`, `previewUrl.ts`, `payload.config.ts`.

- [ ] **Step 8: Commit**

```bash
git add src/collections/Posts.ts src/lib/previewUrl.ts src/payload.config.ts tests/collections/posts.access.test.ts
git commit -m "feat(posts): add platform-level Posts collection for blog & changelog"
```

---

## Task 2: Blog data-access helpers

**Files:**
- Create: `src/lib/blog.ts`
- Test: `tests/lib/blogExcerpt.test.ts`

- [ ] **Step 1: Write the failing `extractExcerpt` test**

Create `tests/lib/blogExcerpt.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { extractExcerpt } from '@/lib/blog'

const doc = (children: unknown[]) => ({ root: { children } })
const para = (text: string) => ({
  type: 'paragraph',
  children: [{ type: 'text', text }],
})

describe('extractExcerpt', () => {
  it('returns the first paragraph text', () => {
    const data = doc([para('First paragraph.'), para('Second.')])
    expect(extractExcerpt(data)).toBe('First paragraph.')
  })

  it('skips non-paragraph leading nodes (e.g. headings)', () => {
    const data = doc([
      { type: 'heading', tag: 'h2', children: [{ type: 'text', text: 'Title' }] },
      para('The real intro.'),
    ])
    expect(extractExcerpt(data)).toBe('The real intro.')
  })

  it('truncates to the max length with an ellipsis', () => {
    const long = 'word '.repeat(60).trim()
    const out = extractExcerpt(doc([para(long)]), 40)
    expect(out.length).toBeLessThanOrEqual(41)
    expect(out.endsWith('…')).toBe(true)
  })

  it('returns empty string for empty/invalid content', () => {
    expect(extractExcerpt(null)).toBe('')
    expect(extractExcerpt(doc([]))).toBe('')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/blogExcerpt.test.ts`
Expected: FAIL — cannot resolve `@/lib/blog`.

- [ ] **Step 3: Create the blog fetchers + excerpt helper**

Create `src/lib/blog.ts`:

```ts
/**
 * Server-only data access for the marketing blog/changelog (the platform-level
 * `posts` collection). Mirrors the conventions in `./data.ts`: thin wrappers
 * over the Payload local API with `overrideAccess: true` and an explicit
 * `_status: published` gate unless `draft` is requested. Posts are NOT
 * tenant-scoped.
 */
import { unstable_noStore as noStore } from 'next/cache'

import { getPayloadClient } from './payloadClient'

export type PostKind = 'article' | 'changelog'

export interface PostRecord {
  id: string | number
  title?: string | null
  slug?: string | null
  kind?: PostKind | null
  version?: string | null
  author?: string | null
  publishedAt?: string | null
  updatedAt?: string | null
  heroImage?: unknown
  tags?: Array<{ tag?: string | null }> | null
  content?: unknown
  seo?: { title?: string | null; description?: string | null; ogImage?: unknown } | null
}

interface FetchPostsOpts {
  kind?: PostKind
  tag?: string
  draft?: boolean
  limit?: number
}

export async function fetchPosts(opts: FetchPostsOpts = {}): Promise<PostRecord[]> {
  noStore()
  const payload = await getPayloadClient()
  if (!payload) return []
  const draft = opts.draft ?? false

  const where: Record<string, unknown> = {}
  if (opts.kind) where.kind = { equals: opts.kind }
  if (opts.tag) where['tags.tag'] = { equals: opts.tag }
  if (!draft) where._status = { equals: 'published' }

  try {
    const res = await payload.find({
      collection: 'posts',
      where,
      sort: '-publishedAt',
      limit: opts.limit ?? 100,
      depth: 1,
      overrideAccess: true,
      draft,
    })
    return res.docs as PostRecord[]
  } catch {
    return []
  }
}

export async function fetchPostBySlug(
  slug: string,
  opts: { draft?: boolean } = {},
): Promise<PostRecord | null> {
  noStore()
  const payload = await getPayloadClient()
  if (!payload) return null
  const draft = opts.draft ?? false

  const where: Record<string, unknown> = { slug: { equals: slug } }
  if (!draft) where._status = { equals: 'published' }

  try {
    const res = await payload.find({
      collection: 'posts',
      where,
      limit: 1,
      depth: 1,
      overrideAccess: true,
      draft,
    })
    return (res.docs[0] as PostRecord) ?? null
  } catch {
    return null
  }
}

interface LexNode {
  type?: string
  text?: string
  children?: LexNode[]
}

/**
 * Derive a short plain-text excerpt from the first paragraph of a lexical
 * richText blob. Pure function — safe to unit test.
 */
export function extractExcerpt(content: unknown, max = 160): string {
  const root = (content as { root?: { children?: LexNode[] } } | null)?.root
  if (!root?.children?.length) return ''

  const firstPara = root.children.find((n) => n.type === 'paragraph')
  if (!firstPara) return ''

  const text = collectText(firstPara).replace(/\s+/g, ' ').trim()
  if (!text) return ''
  if (text.length <= max) return text
  return text.slice(0, max).trimEnd() + '…'
}

function collectText(node: LexNode): string {
  if (node.type === 'text') return node.text ?? ''
  if (!node.children) return ''
  return node.children.map(collectText).join('')
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/lib/blogExcerpt.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/blog.ts tests/lib/blogExcerpt.test.ts
git commit -m "feat(blog): add posts fetchers and excerpt helper"
```

---

## Task 3: Render inline images in `RichText`

The shared `RichText` renderer ignores `upload` nodes, so hero/inline images authored in the article body never appear. Add backward-compatible handling. (Inline `code` already renders via the text-format bitfield; block-level code blocks are not emitted by the default `lexicalEditor()`, so they are intentionally out of scope here — see spec follow-up.)

**Files:**
- Modify: `src/components/RichText.tsx`
- Test: `tests/components/richTextUpload.test.tsx`

- [ ] **Step 1: Write the failing render test**

Create `tests/components/richTextUpload.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import RichText from '@/components/RichText'

describe('RichText upload nodes', () => {
  it('renders an <img> for a populated upload node', () => {
    const data = {
      root: {
        children: [
          {
            type: 'upload',
            relationTo: 'media',
            value: { url: '/media/photo.jpg', alt: 'A masjid', width: 800, height: 600 },
          },
        ],
      },
    }
    const html = renderToStaticMarkup(<RichText data={data} />)
    expect(html).toContain('<img')
    expect(html).toContain('src="/media/photo.jpg"')
    expect(html).toContain('alt="A masjid"')
  })

  it('skips an unpopulated upload node (id only) without crashing', () => {
    const data = { root: { children: [{ type: 'upload', value: 123 }] } }
    const html = renderToStaticMarkup(<RichText data={data} />)
    expect(html).not.toContain('<img')
  })

  it('still renders paragraphs (no regression)', () => {
    const data = {
      root: { children: [{ type: 'paragraph', children: [{ type: 'text', text: 'Hello' }] }] },
    }
    const html = renderToStaticMarkup(<RichText data={data} />)
    expect(html).toContain('Hello')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/richTextUpload.test.tsx`
Expected: FAIL — no `<img>` rendered for the upload node.

- [ ] **Step 3: Add `upload` handling to the renderer**

In `src/components/RichText.tsx`, extend the `LexicalNode` interface's `value` field and add an `upload` case.

First, update the `value` field type in the `LexicalNode` interface (currently `value?: { url?: string }`):

```ts
  value?: { url?: string; alt?: string; width?: number; height?: number } | string | number
  relationTo?: string
```

Then add this case inside `renderNode`'s `switch`, immediately before the `default:` branch:

```ts
    case 'upload': {
      const media = node.value
      // Unpopulated relationship (id only) — nothing to render.
      if (!media || typeof media !== 'object') return null
      const url = (media as { url?: string }).url
      if (!url) return null
      const alt = (media as { alt?: string }).alt ?? ''
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={key}
          src={url}
          alt={alt}
          className="my-6 h-auto w-full rounded-lg"
          loading="lazy"
        />
      )
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/components/richTextUpload.test.tsx`
Expected: PASS (all three cases).

- [ ] **Step 5: Run the full RichText-adjacent suite for regressions**

Run: `npx vitest run tests/`
Expected: PASS — no regressions in existing tests.

- [ ] **Step 6: Commit**

```bash
git add src/components/RichText.tsx tests/components/richTextUpload.test.tsx
git commit -m "feat(richtext): render inline upload images"
```

---

## Task 4: Blog styles

Add the blog/changelog CSS so pages use real classes. These follow the existing `om-` naming and reuse design tokens already present in the file.

**Files:**
- Modify: `src/app/(marketing)/marketing.css`

- [ ] **Step 1: Append blog styles**

Add to the end of `src/app/(marketing)/marketing.css`:

```css
/* ── Blog & Changelog ──────────────────────────────────────────────── */
.om-blog-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 28px;
  margin-top: 40px;
}
.om-blog-card {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--om-border, rgba(0, 0, 0, 0.08));
  border-radius: 16px;
  overflow: hidden;
  background: var(--om-surface, #fff);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.om-blog-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.08);
}
.om-blog-card-media {
  aspect-ratio: 16 / 9;
  object-fit: cover;
  width: 100%;
  background: var(--om-muted, #f2f2f2);
}
.om-blog-card-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 20px 22px 24px;
}
.om-blog-card-title {
  font-family: var(--om-font-display, inherit);
  font-size: 1.35rem;
  line-height: 1.2;
  font-weight: 600;
}
.om-blog-card-excerpt {
  color: var(--om-fg-muted, #555);
  font-size: 0.95rem;
  line-height: 1.5;
}
.om-blog-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  font-size: 0.82rem;
  color: var(--om-fg-muted, #666);
}
.om-blog-article {
  max-width: 760px;
  margin: 0 auto;
}
.om-blog-hero {
  width: 100%;
  border-radius: 18px;
  margin: 28px 0;
}
.om-blog-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.om-changelog-entry {
  border-left: 3px solid var(--om-accent, #1f7a5a);
  padding: 4px 0 24px 24px;
  margin-left: 6px;
}
.om-changelog-ver {
  font-family: var(--om-font-mono, monospace);
  font-size: 0.8rem;
  color: var(--om-accent, #1f7a5a);
}
.om-blog-empty {
  text-align: center;
  color: var(--om-fg-muted, #666);
  padding: 48px 0;
}
```

- [ ] **Step 2: Commit**

```bash
git add "src/app/(marketing)/marketing.css"
git commit -m "feat(blog): add blog & changelog styles"
```

*(Note: CSS-only change; no test. The variable fallbacks ensure it renders even if a token is absent.)*

---

## Task 5: `/blog` article index page

**Files:**
- Modify: `src/app/(marketing)/marketing/blog/page.tsx` (replace stub)

- [ ] **Step 1: Replace the stub with the real index**

Replace the entire contents of `src/app/(marketing)/marketing/blog/page.tsx`:

```tsx
import Link from 'next/link'
import type { Metadata } from 'next'

import { MarketingShell } from '../../_components/MarketingShell'
import { fetchPosts, extractExcerpt, type PostRecord } from '@/lib/blog'
import { mediaUrl, mediaAlt } from '@/components/types'

const TITLE = 'Blog — OpenMasjid'
const DESCRIPTION =
  'Product updates, migration playbooks, and notes on building open-source software for masajid.'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/blog' },
  openGraph: { title: TITLE, description: DESCRIPTION, url: '/blog', type: 'website' },
  twitter: { title: TITLE, description: DESCRIPTION },
}

interface BlogPageProps {
  searchParams: Promise<{ tag?: string | string[] }>
}

function formatDate(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default async function BlogPage({ searchParams }: BlogPageProps) {
  const sp = await searchParams
  const rawTag = Array.isArray(sp.tag) ? sp.tag[0] : sp.tag
  const tag = rawTag?.trim() || undefined

  const posts = await fetchPosts({ kind: 'article', tag })

  return (
    <MarketingShell current="/blog">
      <section className="om-section-lg">
        <div className="om-container">
          <p className="om-eyebrow">Blog</p>
          <h1 className="om-h">Building OpenMasjid in the open</h1>
          <p className="om-lede" style={{ maxWidth: 620 }}>{DESCRIPTION}</p>

          {tag ? (
            <p className="om-blog-meta" style={{ marginTop: 16 }}>
              Filtered by <span className="om-tag-pill">#{tag}</span>
              <Link href="/blog" className="om-link-arrow">Clear filter</Link>
            </p>
          ) : null}

          {posts.length === 0 ? (
            <p className="om-blog-empty">
              {tag ? `No posts tagged “${tag}” yet.` : 'First posts coming soon.'}
            </p>
          ) : (
            <div className="om-blog-grid">
              {posts.map((post) => (
                <PostCard key={String(post.id)} post={post} />
              ))}
            </div>
          )}
        </div>
      </section>
    </MarketingShell>
  )
}

function PostCard({ post }: { post: PostRecord }) {
  const href = `/blog/${post.slug ?? ''}`
  const img = mediaUrl(post.heroImage)
  const excerpt = extractExcerpt(post.content)
  return (
    <Link href={href} className="om-blog-card">
      {img ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="om-blog-card-media" src={img} alt={mediaAlt(post.heroImage, post.title ?? '')} />
      ) : null}
      <div className="om-blog-card-body">
        <div className="om-blog-meta">
          <span>{formatDate(post.publishedAt)}</span>
          {post.author ? <span>· {post.author}</span> : null}
        </div>
        <h2 className="om-blog-card-title">{post.title}</h2>
        {excerpt ? <p className="om-blog-card-excerpt">{excerpt}</p> : null}
      </div>
    </Link>
  )
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `npx tsc --noEmit`
Expected: no new errors in `blog/page.tsx`.

- [ ] **Step 3: Verify the route renders (manual smoke test)**

Run: `npm run dev` (if not already running), then visit `http://localhost:3000/blog`.
Expected: page renders with the header/footer shell and the "First posts coming soon." empty state (no posts yet). No console errors.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(marketing)/marketing/blog/page.tsx"
git commit -m "feat(blog): implement /blog article index"
```

---

## Task 6: `/blog/[slug]` detail page + JSON-LD

**Files:**
- Create: `src/app/(marketing)/_components/PostJsonLd.tsx`
- Create: `src/app/(marketing)/marketing/blog/[slug]/page.tsx`

- [ ] **Step 1: Create the JSON-LD component**

Create `src/app/(marketing)/_components/PostJsonLd.tsx`:

```tsx
/**
 * BlogPosting JSON-LD for a single marketing blog post. Mirrors the
 * inline-script pattern in OpenMasjidJsonLd.tsx.
 */
export default function PostJsonLd({
  title,
  description,
  url,
  imageUrl,
  datePublished,
  dateModified,
  author,
}: {
  title: string
  description: string
  url: string
  imageUrl?: string | null
  datePublished?: string | null
  dateModified?: string | null
  author?: string | null
}) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: title,
    description,
    url,
    mainEntityOfPage: url,
    ...(imageUrl ? { image: imageUrl } : {}),
    ...(datePublished ? { datePublished } : {}),
    ...(dateModified ? { dateModified } : {}),
    author: { '@type': 'Organization', name: author || 'OpenMasjid' },
    publisher: {
      '@type': 'Organization',
      name: 'OpenMasjid',
      logo: {
        '@type': 'ImageObject',
        url: 'https://openmasjid.app/brand/openmasjid-favicon.svg',
      },
    },
  }
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}
```

- [ ] **Step 2: Create the detail page**

Create `src/app/(marketing)/marketing/blog/[slug]/page.tsx`:

```tsx
import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { MarketingShell } from '../../../_components/MarketingShell'
import PostJsonLd from '../../../_components/PostJsonLd'
import RichText from '@/components/RichText'
import { fetchPostBySlug, extractExcerpt } from '@/lib/blog'
import { mediaUrl, mediaAlt } from '@/components/types'
import { isPreviewMode } from '@/lib/previewMode'
import { getRequestOrigin } from '@/lib/seo'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface PageProps {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ draft?: string | string[] }>
}

function formatDate(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

function absolute(origin: string, path: string | null): string | null {
  if (!path) return null
  if (path.startsWith('http')) return path
  return `${origin}${path.startsWith('/') ? '' : '/'}${path}`
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const sp = await searchParams
  const draft = await isPreviewMode(sp)
  const post = await fetchPostBySlug(slug, { draft })
  if (!post) return {}

  const { origin } = await getRequestOrigin()
  const title = post.seo?.title?.trim() || post.title || slug
  const description = post.seo?.description?.trim() || extractExcerpt(post.content)
  const url = `${origin}/blog/${slug}`
  const imageUrl = absolute(origin, mediaUrl(post.seo?.ogImage) ?? mediaUrl(post.heroImage))

  return {
    title: `${title} — OpenMasjid`,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: 'article',
      images: imageUrl ? [{ url: imageUrl, alt: title }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: imageUrl ? [imageUrl] : undefined,
    },
  }
}

export default async function PostPage({ params, searchParams }: PageProps) {
  const { slug } = await params
  const sp = await searchParams
  const draft = await isPreviewMode(sp)
  const post = await fetchPostBySlug(slug, { draft })
  if (!post) notFound()

  const { origin } = await getRequestOrigin()
  const heroSrc = mediaUrl(post.heroImage)
  const url = `${origin}/blog/${slug}`
  const description = post.seo?.description?.trim() || extractExcerpt(post.content)
  const tags = (post.tags ?? []).map((t) => t?.tag).filter((t): t is string => Boolean(t))

  return (
    <MarketingShell current="/blog">
      <PostJsonLd
        title={post.title ?? slug}
        description={description}
        url={url}
        imageUrl={absolute(origin, mediaUrl(post.seo?.ogImage) ?? heroSrc)}
        datePublished={post.publishedAt ?? undefined}
        dateModified={post.updatedAt ?? undefined}
        author={post.author ?? undefined}
      />
      <article className="om-section-lg">
        <div className="om-container om-blog-article">
          <p className="om-blog-meta">
            <Link href="/blog" className="om-link-arrow">← Blog</Link>
            <span>{formatDate(post.publishedAt)}</span>
            {post.author ? <span>· {post.author}</span> : null}
          </p>
          <h1 className="om-h" style={{ marginTop: 12 }}>{post.title}</h1>

          {heroSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="om-blog-hero" src={heroSrc} alt={mediaAlt(post.heroImage, post.title ?? '')} />
          ) : null}

          <RichText data={post.content} className="om-prose" />

          {tags.length > 0 ? (
            <div className="om-blog-tags" style={{ marginTop: 32 }}>
              {tags.map((t) => (
                <Link key={t} href={`/blog?tag=${encodeURIComponent(t)}`} className="om-tag-pill">
                  #{t}
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      </article>
    </MarketingShell>
  )
}
```

- [ ] **Step 3: Verify it typechecks**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Manual smoke test**

In the Payload admin (`/admin`), create a Post (kind: Article), add a title + a paragraph + publish. Then visit `http://localhost:3000/blog` — the card appears — and click through to `/blog/<slug>`.
Expected: article renders with title, date, body. A bogus slug (`/blog/nope`) returns 404.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(marketing)/_components/PostJsonLd.tsx" "src/app/(marketing)/marketing/blog/[slug]/page.tsx"
git commit -m "feat(blog): implement /blog/[slug] detail page with JSON-LD"
```

---

## Task 7: `/changelog` page

**Files:**
- Create: `src/app/(marketing)/marketing/changelog/page.tsx`
- Modify: `src/app/(marketing)/_components/Footer.tsx`

- [ ] **Step 1: Create the changelog page**

Create `src/app/(marketing)/marketing/changelog/page.tsx`:

```tsx
import type { Metadata } from 'next'

import { MarketingShell } from '../../_components/MarketingShell'
import RichText from '@/components/RichText'
import { fetchPosts, type PostRecord } from '@/lib/blog'

const TITLE = 'Changelog — OpenMasjid'
const DESCRIPTION = "What's new in OpenMasjid — features, fixes, and improvements as they ship."

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/changelog' },
  openGraph: { title: TITLE, description: DESCRIPTION, url: '/changelog', type: 'website' },
  twitter: { title: TITLE, description: DESCRIPTION },
}

function formatDate(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

export default async function ChangelogPage() {
  const entries = await fetchPosts({ kind: 'changelog' })

  return (
    <MarketingShell current="/changelog">
      <section className="om-section-lg">
        <div className="om-container om-blog-article">
          <p className="om-eyebrow">Changelog</p>
          <h1 className="om-h">What&apos;s new</h1>
          <p className="om-lede">{DESCRIPTION}</p>

          {entries.length === 0 ? (
            <p className="om-blog-empty">No changelog entries yet.</p>
          ) : (
            <div style={{ marginTop: 40 }}>
              {entries.map((entry) => (
                <ChangelogEntry key={String(entry.id)} entry={entry} />
              ))}
            </div>
          )}
        </div>
      </section>
    </MarketingShell>
  )
}

function ChangelogEntry({ entry }: { entry: PostRecord }) {
  return (
    <div className="om-changelog-entry">
      <div className="om-blog-meta">
        <span>{formatDate(entry.publishedAt)}</span>
        {entry.version ? <span className="om-changelog-ver">{entry.version}</span> : null}
      </div>
      <h2 className="om-blog-card-title" style={{ marginTop: 6 }}>{entry.title}</h2>
      <RichText data={entry.content} className="om-prose" />
    </div>
  )
}
```

- [ ] **Step 2: Fix the footer "Changelog" link**

In `src/app/(marketing)/_components/Footer.tsx`, change the Product-column "Changelog" link from `/blog` to `/changelog`:

```tsx
              <li><Link href="/changelog">Changelog</Link></li>
```

- [ ] **Step 3: Verify it typechecks**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Manual smoke test**

Create a Post with kind: Changelog Entry, version `v0.1.0`, publish. Visit `http://localhost:3000/changelog`.
Expected: the entry renders with date, version, title, and body. The footer "Changelog" link navigates here.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(marketing)/marketing/changelog/page.tsx" "src/app/(marketing)/_components/Footer.tsx"
git commit -m "feat(changelog): implement /changelog page and fix footer link"
```

---

## Task 8: RSS feed at `/blog/feed.xml`

**Files:**
- Create: `src/app/(marketing)/marketing/blog/feed.xml/route.ts`

- [ ] **Step 1: Create the feed route handler**

Create `src/app/(marketing)/marketing/blog/feed.xml/route.ts`:

```ts
import { fetchPosts, extractExcerpt } from '@/lib/blog'
import { getRequestOrigin } from '@/lib/seo'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export async function GET() {
  const { origin } = await getRequestOrigin()
  const posts = await fetchPosts({ kind: 'article', limit: 50 })

  const items = posts
    .map((p) => {
      const url = `${origin}/blog/${p.slug ?? ''}`
      const date = p.publishedAt ? new Date(p.publishedAt).toUTCString() : ''
      return `    <item>
      <title>${escapeXml(p.title ?? '')}</title>
      <link>${escapeXml(url)}</link>
      <guid isPermaLink="true">${escapeXml(url)}</guid>
      ${date ? `<pubDate>${date}</pubDate>` : ''}
      <description>${escapeXml(extractExcerpt(p.content))}</description>
    </item>`
    })
    .join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>OpenMasjid Blog</title>
    <link>${escapeXml(`${origin}/blog`)}</link>
    <description>Product updates and notes on building open-source software for masajid.</description>
${items}
  </channel>
</rss>`

  return new Response(xml, {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
  })
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Manual smoke test**

Visit `http://localhost:3000/blog/feed.xml`.
Expected: valid RSS XML; published articles appear as `<item>` entries; no drafts.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(marketing)/marketing/blog/feed.xml/route.ts"
git commit -m "feat(blog): add RSS feed at /blog/feed.xml"
```

---

## Task 9: Sitemap entries

**Files:**
- Modify: `src/app/sitemap.ts`

- [ ] **Step 1: Add `/changelog` to the marketing static paths**

In `src/app/sitemap.ts`, inside the `marketingPaths` array (after the `/blog` entry), add:

```ts
      { path: '/changelog', changeFrequency: 'weekly', priority: 0.5 },
```

- [ ] **Step 2: Add published articles to the marketing sitemap**

Still in the marketing branch of `sitemap.ts`, replace the `return marketingPaths.map(...)` block with a version that appends published article URLs:

```ts
    const staticEntries = marketingPaths.map(({ path, changeFrequency, priority }) => ({
      url: absoluteUrl(origin, path),
      lastModified: now,
      changeFrequency,
      priority,
    }))

    const postEntries: MetadataRoute.Sitemap = []
    try {
      const payload = await getPayload({ config })
      const posts = await payload.find({
        collection: 'posts',
        where: { kind: { equals: 'article' }, _status: { equals: 'published' } },
        limit: 500,
        depth: 0,
        overrideAccess: true,
      })
      for (const doc of posts.docs as Array<{ slug?: string | null; updatedAt?: string | null }>) {
        if (!doc.slug) continue
        postEntries.push({
          url: absoluteUrl(origin, `/blog/${doc.slug}`),
          lastModified: doc.updatedAt ? new Date(doc.updatedAt) : now,
          changeFrequency: 'monthly',
          priority: 0.6,
        })
      }
    } catch {
      // Best-effort — emit static entries even if the posts lookup fails.
    }

    return [...staticEntries, ...postEntries]
```

*(Note: `getPayload`, `config`, `absoluteUrl`, and `MetadataRoute` are already imported at the top of `sitemap.ts`.)*

- [ ] **Step 3: Verify it typechecks**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Manual smoke test**

Visit `http://localhost:3000/sitemap.xml`.
Expected: `/changelog` appears; any published article appears as `/blog/<slug>`.

- [ ] **Step 5: Commit**

```bash
git add "src/app/sitemap.ts"
git commit -m "feat(blog): add changelog and articles to sitemap"
```

---

## Task 10: Final verification

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass (including the new posts/excerpt/richtext tests).

- [ ] **Step 2: Typecheck the whole project**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no new errors (the `no-img-element` disables are intentional and inline-annotated).

- [ ] **Step 4: Regenerate Payload types (optional, DX only)**

Run: `npx payload generate:types`
Expected: `src/payload-types.ts` gains a `Post` type. Non-blocking — fetchers use the loose `PayloadLike` client and do not depend on generated types.

- [ ] **Step 5: End-to-end manual check**

With `npm run dev` running and at least one published article + one changelog entry created in `/admin`:
- `/blog` lists the article with hero + excerpt.
- `/blog?tag=<tag>` filters to matching posts; "Clear filter" returns to `/blog`.
- `/blog/<slug>` shows the full article (inline images render) with working tag links and JSON-LD in the page source.
- `/changelog` lists the changelog entry with version + date.
- `/blog/feed.xml` returns valid RSS.
- A draft post is NOT visible at `/blog` or `/blog/<slug>` when logged out, but IS visible at `/blog/<slug>?draft=1` when logged into `/admin`.

---

## Self-Review Notes

- **Spec coverage:** Posts collection (Task 1) ✓; free-form tags ✓; simple byline ✓; hero image ✓; auto-excerpt (Task 2) ✓; `kind` article/changelog split ✓; `/blog` index (Task 5) ✓; `/changelog` (Task 7) ✓; `/blog/[slug]` (Task 6) ✓; RichText inline images (Task 3) ✓; SEO + JSON-LD (Task 6) ✓; RSS (Task 8) ✓; sitemap (Task 9) ✓; drafts/scheduled publish ✓.
- **Intentional spec deviations:** (1) Header nav gating replaced with graceful empty states + content-seeding (rationale in header above). (2) Code-block rendering deferred — the default `lexicalEditor()` does not emit code-block nodes; enabling that feature is a separate, isolated editor-config change. Inline code already renders.
- **Type consistency:** `PostRecord`, `extractExcerpt`, `fetchPosts`, `fetchPostBySlug` names are used identically across Tasks 2, 5, 6, 8. `buildMarketingPreviewUrl` defined in Task 1 and used only there.
