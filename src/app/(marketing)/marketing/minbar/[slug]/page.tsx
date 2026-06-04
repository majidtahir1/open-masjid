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
  const url = `${origin}/minbar/${slug}`
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
  const url = `${origin}/minbar/${slug}`
  const description = post.seo?.description?.trim() || extractExcerpt(post.content)
  const tags = (post.tags ?? []).map((t) => t?.tag).filter((t): t is string => Boolean(t))

  return (
    <MarketingShell current="/minbar">
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
        <div className="om-article-shell">
          <div className="om-article-col">
            <h1 className="font-display font-medium tracking-tight text-fg1 leading-[1.04] text-[clamp(2.4rem,5.5vw,4rem)]">
              {post.title}
            </h1>
          </div>

          {heroSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="om-blog-hero" src={heroSrc} alt={mediaAlt(post.heroImage, post.title ?? '')} />
          ) : null}

          <div className="om-article-col">
            <RichText data={post.content} />

            {tags.length > 0 ? (
              <div className="om-blog-tags" style={{ marginTop: 32 }}>
                {tags.map((t) => (
                  <Link key={t} href={`/minbar?tag=${encodeURIComponent(t)}`} className="om-tag-pill">
                    #{t}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </article>
    </MarketingShell>
  )
}
