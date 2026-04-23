import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { Geist } from 'next/font/google'

import '../globals.css'
import { fraunces, inter, amiri } from '@/lib/fonts'
import { cn } from '@/lib/utils'
import Header from '@/components/Header'
import PrayerStrip from '@/components/PrayerStrip'
import Footer from '@/components/Footer'
import type {
  PrayerScheduleLike,
  TenantContactInfo,
  TenantLike,
  TenantSocialLink,
} from '@/components/types'
import { TenantProvider } from '@/lib/context'
import { getCurrentTenant } from '@/lib/tenant-server'
import { tenantThemeCss } from '@/lib/tenantTheme'
import { getActiveSchedule } from '@/lib/prayer-schedule'
import { resolveTenantFavicon } from '@/lib/tenantFavicon'

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' })

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getCurrentTenant()
  const favicon = resolveTenantFavicon(tenant)
  return {
    title: tenant?.name ?? 'OpenMasjid',
    description: tenant?.name
      ? `${tenant.name} — prayer times, events, and community`
      : 'Multi-tenant masjid website platform',
    icons: [{ rel: 'icon', url: favicon.href, type: favicon.type }],
  }
}

// CMS-backed pages must bypass Next's default static cache so admin edits appear immediately.
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function SiteLayout({ children }: { children: ReactNode }) {
  const tenant = await getCurrentTenant()

  if (!tenant) {
    // No tenant resolves here — redirect to the platform marketing page.
    redirect('/marketing')
  }

  const [themeCss, schedule] = await Promise.all([
    Promise.resolve(tenantThemeCss(tenant)),
    getActiveSchedule(tenant.id),
  ])

  const footerTenant = {
    name: tenant.name ?? 'Masjid',
    contactInfo: tenant.contactInfo as TenantContactInfo | null | undefined,
    socialLinks: tenant.socialLinks as TenantSocialLink[] | null | undefined,
    footerTagline:
      typeof tenant.footerTagline === 'string' ? tenant.footerTagline : null,
  }

  return (
    <html
      lang="en"
      className={cn(fraunces.variable, inter.variable, amiri.variable, 'font-sans', geist.variable)}
    >
      <body className="font-body bg-bg text-fg2 antialiased">
        <TenantProvider tenant={tenant}>
          {themeCss && (
            <style dangerouslySetInnerHTML={{ __html: themeCss }} />
          )}
          <Header tenant={tenant as unknown as TenantLike} />
          <PrayerStrip schedule={schedule as PrayerScheduleLike | null} />
          <main className="min-h-[60vh]">{children}</main>
          <Footer tenant={footerTenant} />
        </TenantProvider>
      </body>
    </html>
  )
}
