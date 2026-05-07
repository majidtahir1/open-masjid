import { redirect } from 'next/navigation'

import { getAdminUser, getAdminTenant } from '@/lib/admin-context'
import IdentityStandalone from '@/admin/onboarding/steps/IdentityStandalone'

// Hits Postgres on every render; never pre-render at build time.
export const dynamic = 'force-dynamic'
export const revalidate = 0

type TenantRef = string | number | { id: string | number } | null | undefined

function tenantIdOf(t: TenantRef): string | number | null {
  if (!t) return null
  if (typeof t === 'object' && 'id' in t) return t.id
  return t as string | number
}

export default async function IdentityPage() {
  const { user } = await getAdminUser()

  if (!user) {
    redirect('/admin/login')
  }

  const u = user as { tenant?: TenantRef; role?: string }

  if (u.role === 'platformOwner') {
    redirect('/admin')
  }

  const tenantId = tenantIdOf(u.tenant)
  if (!tenantId) {
    redirect('/admin')
  }

  const tenantDoc = await getAdminTenant(tenantId)

  const t = tenantDoc as {
    name?: string | null
    slug?: string | null
    footerTagline?: string | null
    contactInfo?: {
      address?: string | null
      phone?: string | null
      email?: string | null
    } | null
    socialLinks?: Array<{ platform?: string; url?: string }> | null
  }

  const tenantName = t.name ?? t.slug ?? 'Your Masjid'
  const tenantSlug = t.slug ?? ''
  const publicUrl = `https://${tenantSlug}.openmasjid.app`

  const initial = {
    name: t.name ?? '',
    footerTagline: t.footerTagline ?? '',
    contactInfo: {
      address: t.contactInfo?.address ?? '',
      phone: t.contactInfo?.phone ?? '',
      email: t.contactInfo?.email ?? '',
    },
    socialLinks: (t.socialLinks ?? [])
      .filter((s): s is { platform: string; url: string } =>
        Boolean(s?.platform && s?.url),
      )
      .map((s) => ({ platform: s.platform, url: s.url })),
  }

  return (
    <div className="p-8 md:p-10 max-w-[900px] mx-auto">
      <IdentityStandalone
        initial={initial}
        tenantName={tenantName}
        publicUrl={publicUrl}
      />
    </div>
  )
}
