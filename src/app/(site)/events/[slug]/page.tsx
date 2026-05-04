import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { ArrowLeft, Calendar, Mail, MapPin } from 'lucide-react'

import Flyer from '@/components/Flyer'
import PreviewBanner from '@/components/PreviewBanner'
import RichText from '@/components/RichText'
import { mediaAlt, mediaUrl, type EventLike } from '@/components/types'
import { getCurrentTenant } from '@/lib/tenant-server'
import { fetchEventBySlug } from '@/lib/data'
import { isPreviewMode } from '@/lib/previewMode'
import { getRequestOrigin } from '@/lib/seo'

interface EventPageProps {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ draft?: string | string[] }>
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

type EventDoc = EventLike & {
  description?: unknown
  contact?: string | null
}

export async function generateMetadata({
  params,
  searchParams,
}: EventPageProps): Promise<Metadata> {
  const { slug } = await params
  const sp = await searchParams
  const tenant = await getCurrentTenant()
  if (!tenant) return {}
  const draft = await isPreviewMode(sp)
  const event = (await fetchEventBySlug(tenant, slug, { draft })) as EventDoc | null
  if (!event) return {}

  const { origin } = await getRequestOrigin(tenant)
  const title = event.title
  const description =
    (event.shortDescription && event.shortDescription.trim()) ||
    (tenant.name ? `${event.title} · ${tenant.name}` : event.title)

  const flyerPath = mediaUrl(event.flyerImage)
  const tenantLogoPath = mediaUrl(
    (tenant as { branding?: { logo?: unknown } } | null | undefined)?.branding?.logo,
  )
  const imagePath = flyerPath ?? tenantLogoPath
  const imageUrl = imagePath
    ? imagePath.startsWith('http')
      ? imagePath
      : `${origin}${imagePath.startsWith('/') ? '' : '/'}${imagePath}`
    : null

  const url = `${origin}/events/${slug}`

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

export default async function EventDetailPage({ params, searchParams }: EventPageProps) {
  const { slug } = await params
  const sp = await searchParams
  const tenant = await getCurrentTenant()
  if (!tenant) notFound()

  const draft = await isPreviewMode(sp)
  const event = (await fetchEventBySlug(tenant, slug, { draft })) as EventDoc | null
  if (!event) notFound()

  const displayMode = event.displayMode ?? 'text'
  const flyerUrl = mediaUrl(event.flyerImage)

  return (
    <article className="py-16">
      {draft ? <PreviewBanner /> : null}
      <div className="mx-auto max-w-[880px] px-6">
        <Link
          href="/events"
          className="mb-8 inline-flex items-center gap-2 font-body text-fs-sm font-medium text-brand hover:text-brand-hover"
        >
          <ArrowLeft size={16} strokeWidth={1.75} />
          All events
        </Link>

        <header className="mb-10">
          {event.tag && (
            <div className="mb-4 inline-flex items-center rounded-[var(--r-pill)] bg-brand-soft px-[10px] py-[3px] font-body text-[11px] font-semibold uppercase tracking-caps text-brand">
              {event.tag.replace(/-/g, ' ')}
            </div>
          )}
          <h1 className="mb-4 font-display text-[52px] font-medium leading-[1.08] tracking-tight text-fg1">
            {event.title}
          </h1>
          {event.shortDescription && (
            <p className="m-0 mb-6 max-w-[64ch] text-[18px] leading-relaxed text-fg2">
              {event.shortDescription}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-6 text-fs-sm text-fg3">
            {event.when && (
              <span className="inline-flex items-center gap-2">
                <Calendar size={15} strokeWidth={1.75} />
                {event.when}
              </span>
            )}
            {event.location && (
              <span className="inline-flex items-center gap-2">
                <MapPin size={15} strokeWidth={1.75} />
                {event.location}
              </span>
            )}
          </div>
        </header>

        {displayMode === 'image' && flyerUrl && (
          <div className="mb-10 mx-auto w-full max-w-[880px] overflow-hidden rounded-[var(--r-md)] border border-border bg-bg-alt">
            <Image
              src={flyerUrl}
              alt={mediaAlt(event.flyerImage, `${event.title} flyer`)}
              width={
                (event.flyerImage as { width?: number | null } | null)?.width ?? 880
              }
              height={
                (event.flyerImage as { height?: number | null } | null)?.height ?? 1100
              }
              sizes="(max-width: 880px) 100vw, 880px"
              className="h-auto w-full object-contain"
              priority
            />
          </div>
        )}

        {displayMode === 'template' && (
          <div className="mb-10">
            <Flyer
              title={event.title}
              subtitle={event.shortDescription ?? undefined}
              meta={event.when ?? undefined}
              variant={event.templateVariant ?? 'default'}
            />
          </div>
        )}

        <RichText data={event.description} className="mb-10 max-w-[68ch]" />

        {(event.address || event.contact) && (
          <aside className="mt-12 grid grid-cols-1 gap-6 rounded-[var(--r-md)] border border-border bg-white p-6 md:grid-cols-2">
            {event.address && (
              <div>
                <div className="mb-2 font-body text-fs-xs font-semibold uppercase tracking-caps text-brand">
                  Address
                </div>
                <p className="m-0 whitespace-pre-line text-fs-base text-fg1">
                  {event.address}
                </p>
              </div>
            )}
            {event.contact && (
              <div>
                <div className="mb-2 font-body text-fs-xs font-semibold uppercase tracking-caps text-brand">
                  RSVP / contact
                </div>
                <a
                  href={`mailto:${event.contact}?subject=${encodeURIComponent(`RSVP: ${event.title}`)}`}
                  className="inline-flex items-center gap-2 rounded-[var(--r-md)] bg-brand px-5 py-[10px] font-body text-fs-sm font-semibold text-white hover:bg-brand-hover"
                >
                  <Mail size={15} strokeWidth={1.75} />
                  {event.contact}
                </a>
              </div>
            )}
          </aside>
        )}
      </div>
    </article>
  )
}
