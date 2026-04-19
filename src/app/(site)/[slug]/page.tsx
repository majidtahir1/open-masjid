import { notFound } from 'next/navigation'

import RichText from '@/components/RichText'
import { getCurrentTenant } from '@/lib/tenant-server'
import { fetchPageBySlug } from '@/lib/data'

const RESERVED = new Set(['events', 'about', 'donate', 'prayer-times', 'marketing'])

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface PageProps {
  params: Promise<{ slug: string }>
}

export default async function DynamicPage({ params }: PageProps) {
  const { slug } = await params
  if (RESERVED.has(slug)) notFound()

  const tenant = await getCurrentTenant()
  if (!tenant) notFound()

  const page = (await fetchPageBySlug(tenant, slug)) as
    | { title?: string; content?: unknown }
    | null
  if (!page) notFound()

  return (
    <article className="py-20">
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
