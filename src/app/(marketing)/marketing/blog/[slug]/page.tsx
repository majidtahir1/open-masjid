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
