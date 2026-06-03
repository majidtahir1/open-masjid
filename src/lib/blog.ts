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
