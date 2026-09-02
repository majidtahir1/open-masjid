import { redirect } from 'next/navigation'

import { getAdminUser, getAdminTenantWithRelations } from '@/lib/admin-context'
import { loginUrl } from '@/lib/login-redirect'
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
    redirect(loginUrl('/admin/identity'))
  }

  const u = user as { tenant?: TenantRef; role?: string }

  if (u.role === 'platformOwner') {
    redirect('/admin')
  }

  const tenantId = tenantIdOf(u.tenant)
  if (!tenantId) {
    redirect('/admin')
  }

  // depth 1 so contactInfo.zelleQrCode arrives populated with its url.
  const tenantDoc = await getAdminTenantWithRelations(tenantId)

  const t = tenantDoc as {
    name?: string | null
    slug?: string | null
    footerTagline?: string | null
    footerLegalNote?: string | null
    contactInfo?: {
      address?: string | null
      phone?: string | null
      email?: string | null
      zelle?: string | null
      zelleQrCode?:
        | { id: string | number; url?: string | null; filename?: string | null }
        | string
        | number
        | null
    } | null
    socialLinks?: Array<{ platform?: string; url?: string }> | null
  }

  const tenantName = t.name ?? t.slug ?? 'Your Masjid'
  const tenantSlug = t.slug ?? ''
  const publicUrl = `https://${tenantSlug}.openmasjid.app`

  const initial = {
    name: t.name ?? '',
    footerTagline: t.footerTagline ?? '',
    footerLegalNote: t.footerLegalNote ?? '',
    contactInfo: {
      address: t.contactInfo?.address ?? '',
      phone: t.contactInfo?.phone ?? '',
      email: t.contactInfo?.email ?? '',
      zelle: t.contactInfo?.zelle ?? '',
      zelleQrCode: (() => {
        const qr = t.contactInfo?.zelleQrCode
        if (!qr || typeof qr !== 'object') return null
        return {
          id: qr.id,
          url: qr.url ?? undefined,
          filename: qr.filename ?? undefined,
        }
      })(),
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
