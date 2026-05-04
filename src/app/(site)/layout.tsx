import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { notFound, redirect } from 'next/navigation'
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
import { mediaUrl } from '@/components/types'
import { TenantProvider } from '@/lib/context'
import { getCurrentTenant, getTenantContext } from '@/lib/tenant-server'
import { tenantThemeCss } from '@/lib/tenantTheme'
import { findDayRow, getActiveSchedule } from '@/lib/prayer-schedule'
import { fetchNavPages } from '@/lib/data'
import { resolveTenantFavicon } from '@/lib/tenantFavicon'
import { getTenantBillingState, isPublicSiteOffline, type BillingTenantFields } from '@/lib/billing'
import OfflineNotice from './_components/OfflineNotice'

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
    // No tenant resolves here. What we do depends on which host the request
    // came in on:
    //   - Tenant subdomain or custom domain with no matching DB row: render a
    //     404. Redirecting to '/' would loop forever because the same host
    //     would re-enter this layout with the same null tenant.
    //   - Platform-marketing or localhost: redirect to '/' so middleware can
    //     rewrite into `/marketing/*` (the safety-net path).
    const ctx = await getTenantContext()
    if (ctx.type === 'tenant-subdomain' || ctx.type === 'tenant-custom') {
      notFound()
    }
    redirect('/')
  }

  if (tenant) {
    const billingState = getTenantBillingState(tenant as unknown as BillingTenantFields)
    if (isPublicSiteOffline(billingState)) {
      return (
        <html lang="en">
          <body>
            <OfflineNotice tenantName={tenant.name ?? 'This masjid'} />
          </body>
        </html>
      )
    }
  }

  const [themeCss, schedule, navPages] = await Promise.all([
    Promise.resolve(tenantThemeCss(tenant)),
    getActiveSchedule(tenant.id),
    fetchNavPages(tenant),
  ])

  // Synthesize a flat PrayerScheduleLike for PrayerStrip from today's day row.
  const today = findDayRow(schedule)
  const stripSchedule: PrayerScheduleLike | null =
    schedule && today
      ? {
          id: schedule.id,
          name: schedule.name,
          startDate: schedule.startDate,
          fajr: today.fajr,
          zuhr: today.zuhr,
          asr: today.asr,
          maghrib: today.maghrib,
          isha: today.isha,
          jummahTimes: schedule.jummahTimes,
          notes: schedule.notes,
        }
      : null

  const footerTenant = {
    name: tenant.name ?? 'Masjid',
    contactInfo: tenant.contactInfo as TenantContactInfo | null | undefined,
    socialLinks: tenant.socialLinks as TenantSocialLink[] | null | undefined,
    footerTagline:
      typeof tenant.footerTagline === 'string' ? tenant.footerTagline : null,
    logoUrl: mediaUrl(tenant.branding?.logo),
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
          <Header
            tenant={tenant as unknown as TenantLike}
            navPages={navPages.map(({ title, slug }) => ({ title, slug }))}
          />
          <PrayerStrip schedule={stripSchedule} />
          <main className="min-h-[60vh]">{children}</main>
          <Footer tenant={footerTenant} />
        </TenantProvider>
      </body>
    </html>
  )
}
