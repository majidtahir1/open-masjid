import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'

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
    <TenantProvider tenant={tenant}>
      {themeCss && (
        <style dangerouslySetInnerHTML={{ __html: themeCss }} />
      )}
      <Header tenant={tenant as unknown as TenantLike} />
      <PrayerStrip schedule={schedule as PrayerScheduleLike | null} />
      <main className="min-h-[60vh]">{children}</main>
      <Footer tenant={footerTenant} />
    </TenantProvider>
  )
}
