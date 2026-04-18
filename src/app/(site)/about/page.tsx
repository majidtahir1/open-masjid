import { Mail, MapPin, Phone } from 'lucide-react'

import RichText from '@/components/RichText'
import type { TenantContactInfo } from '@/components/types'
import { getCurrentTenant } from '@/lib/tenant-server'
import { fetchPageBySlug } from '@/lib/data'

export const metadata = {
  title: 'About',
}

export default async function AboutPage() {
  const tenant = await getCurrentTenant()
  if (!tenant) return null

  const page = (await fetchPageBySlug(tenant, 'about')) as
    | { title?: string; content?: unknown }
    | null

  const contact = (tenant.contactInfo ?? {}) as TenantContactInfo

  return (
    <section className="py-20">
      <div className="mx-auto max-w-[880px] px-6">
        <header className="mb-12 max-w-[720px]">
          <div className="mb-4 font-body text-fs-xs font-semibold uppercase tracking-caps text-brand">
            About
          </div>
          <h1 className="mb-4 font-display text-[52px] font-medium leading-[1.08] tracking-tight text-fg1">
            {page?.title ?? tenant.name ?? 'About us'}
          </h1>
          {typeof tenant.footerTagline === 'string' && tenant.footerTagline && (
            <p className="m-0 text-[18px] leading-relaxed text-fg2">
              {tenant.footerTagline}
            </p>
          )}
        </header>

        {page?.content ? (
          <RichText data={page.content} className="max-w-[68ch]" />
        ) : (
          <div className="max-w-[68ch] space-y-5 text-fs-base leading-relaxed text-fg2">
            <p className="m-0">
              {tenant.name ?? 'Our masjid'} was established in September 2021 to
              serve Muslim families in Prosper and Celina, Texas. What began as
              a handful of neighbors gathering for prayer has grown into a
              community centered on knowledge, tarbiya, and worship.
            </p>
            <p className="m-0">
              We hold the five daily prayers, weekly halaqas, children&rsquo;s
              classes, and Ramadan programs for families and youth. Our aim is
              simple: to be a place where faith is learned, lived, and passed
              on.
            </p>
            <p className="m-0">
              Everyone is welcome &mdash; whether you are new to the area, new
              to Islam, or simply passing through for a prayer.
            </p>
          </div>
        )}

        <aside className="mt-16 rounded-[var(--r-md)] border border-border bg-white p-8 shadow-sh-xs">
          <div className="mb-5 font-body text-fs-xs font-semibold uppercase tracking-caps text-brand">
            Get in touch
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {contact.address && (
              <div className="flex items-start gap-3">
                <MapPin
                  size={18}
                  strokeWidth={1.75}
                  className="mt-[2px] flex-shrink-0 text-brand"
                />
                <p className="m-0 whitespace-pre-line text-fs-sm leading-relaxed text-fg1">
                  {contact.address}
                </p>
              </div>
            )}
            {contact.phone && (
              <div className="flex items-start gap-3">
                <Phone
                  size={18}
                  strokeWidth={1.75}
                  className="mt-[2px] flex-shrink-0 text-brand"
                />
                <a
                  href={`tel:${contact.phone.replace(/\s+/g, '')}`}
                  className="text-fs-sm text-fg1 hover:text-brand"
                >
                  {contact.phone}
                </a>
              </div>
            )}
            {contact.email && (
              <div className="flex items-start gap-3">
                <Mail
                  size={18}
                  strokeWidth={1.75}
                  className="mt-[2px] flex-shrink-0 text-brand"
                />
                <a
                  href={`mailto:${contact.email}`}
                  className="text-fs-sm text-fg1 hover:text-brand"
                >
                  {contact.email}
                </a>
              </div>
            )}
          </div>
        </aside>
      </div>
    </section>
  )
}
