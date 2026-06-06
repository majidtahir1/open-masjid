import Link from 'next/link'
import type { Metadata } from 'next'

import { MarketingShell } from '../../_components/MarketingShell'
import { fetchPosts, extractExcerpt, type PostRecord } from '@/lib/blog'
import { mediaUrl, mediaAlt } from '@/components/types'

const TITLE = 'The Minbar — OpenMasjid'
const DESCRIPTION = 'Thoughts on OpenMasjid, tech, and the Ummah.'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/minbar' },
  openGraph: { title: TITLE, description: DESCRIPTION, url: '/minbar', type: 'website' },
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
    <MarketingShell current="/minbar">
      <section className="om-section-lg">
        <div className="om-container">
          <p className="om-eyebrow">The Minbar</p>
          <h1 className="om-h">Building OpenMasjid in the open</h1>
          <p className="om-lede" style={{ maxWidth: 620 }}>{DESCRIPTION}</p>

          {tag ? (
            <p className="om-blog-meta" style={{ marginTop: 16 }}>
              Filtered by <span className="om-tag-pill">#{tag}</span>
              <Link href="/minbar" className="om-link-arrow">Clear filter</Link>
            </p>
          ) : null}

          {posts.length === 0 ? (
            <p className="om-blog-empty">
              {tag ? `No posts tagged "${tag}" yet.` : 'First posts coming soon.'}
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
  const href = `/minbar/${post.slug ?? ''}`
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
