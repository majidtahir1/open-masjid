import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import RichText from '@/components/RichText'
import PreviewBanner from '@/components/PreviewBanner'
import { mediaUrl } from '@/components/types'
import { getCurrentTenant } from '@/lib/tenant-server'
import { fetchPageBySlug } from '@/lib/data'
import { isPreviewMode } from '@/lib/previewMode'
import { getRequestOrigin } from '@/lib/seo'

const RESERVED = new Set(['events', 'about', 'donate', 'prayer-times', 'marketing'])

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface PageProps {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ draft?: string | string[] }>
}

interface PageDoc {
  title?: string | null
  content?: unknown
  seo?: {
    title?: string | null
    description?: string | null
    ogImage?: unknown
  } | null
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const sp = await searchParams
  if (RESERVED.has(slug)) return {}

  const tenant = await getCurrentTenant()
  if (!tenant) return {}

  const draft = await isPreviewMode(sp)
  const page = (await fetchPageBySlug(tenant, slug, { draft })) as PageDoc | null
  if (!page) return {}

  const { origin } = await getRequestOrigin(tenant)
  const title = page.seo?.title?.trim() || page.title || slug
  const description =
    page.seo?.description?.trim() ||
    (tenant.name
      ? `${page.title ?? slug} · ${tenant.name}`
      : (page.title ?? slug))

  // Prefer page-level SEO image; fall back to tenant logo.
  const seoImagePath = mediaUrl(page.seo?.ogImage)
  const tenantLogoPath = mediaUrl(
    (tenant as { branding?: { logo?: unknown } } | null | undefined)?.branding?.logo,
  )
  const imagePath = seoImagePath ?? tenantLogoPath
  const imageUrl = imagePath
    ? imagePath.startsWith('http')
      ? imagePath
      : `${origin}${imagePath.startsWith('/') ? '' : '/'}${imagePath}`
    : null

  const url = `${origin}/${slug}`

  return {
    title,
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

export default async function DynamicPage({ params, searchParams }: PageProps) {
  const { slug } = await params
  const sp = await searchParams
  if (RESERVED.has(slug)) notFound()

  const tenant = await getCurrentTenant()
  if (!tenant) notFound()

  const draft = await isPreviewMode(sp)
  const page = (await fetchPageBySlug(tenant, slug, { draft })) as PageDoc | null
  if (!page) notFound()

  return (
    <article className="py-20">
      {draft ? <PreviewBanner /> : null}
      <div className="mx-auto max-w-[880px] px-6">
        <header className="mb-10">
          <h1 className="mb-4 font-display text-[52px] font-medium leading-[1.08] tracking-tight text-fg1">
            {page.title ?? slug}
          </h1>
        </header>
        <RichText data={page.content} className="max-w-[68ch]" />
      </div>
    </article>
  )
}
