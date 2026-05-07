import { redirect } from 'next/navigation'

import { getAdminUser, getAdminTenantWithRelations } from '@/lib/admin-context'
import BrandingStandalone from '@/admin/onboarding/steps/BrandingStandalone'

// Hits Postgres on every render; never pre-render at build time.
export const dynamic = 'force-dynamic'
export const revalidate = 0

type TenantRef = string | number | { id: string | number } | null | undefined

function tenantIdOf(t: TenantRef): string | number | null {
  if (!t) return null
  if (typeof t === 'object' && 'id' in t) return t.id
  return t as string | number
}

export default async function BrandingPage() {
  const { user } = await getAdminUser()

  if (!user) {
    redirect('/admin/login')
  }

  const u = user as { tenant?: TenantRef; role?: string; name?: string | null; email?: string }

  if (u.role === 'platformOwner') {
    redirect('/admin')
  }

  const tenantId = tenantIdOf(u.tenant)
  if (!tenantId) {
    redirect('/admin')
  }

  const tenantDoc = await getAdminTenantWithRelations(tenantId)

  const tenantName =
    (tenantDoc as { name?: string | null }).name ??
    (tenantDoc as { slug?: string | null }).slug ??
    'Your Masjid'

  const tenantSlug = (tenantDoc as { slug?: string | null }).slug ?? ''
  const publicUrl = `https://${tenantSlug}.openmasjid.app`

  const brandingDoc = (tenantDoc as {
    branding?: {
      logo?:
        | string
        | number
        | { id?: string | number; url?: string; filename?: string; filesize?: number }
        | null
      favicon?:
        | string
        | number
        | { id?: string | number; url?: string; filename?: string; filesize?: number }
        | null
      primaryColor?: string | null
      secondaryColor?: string | null
      accentColor?: string | null
      displayFont?: string | null
    } | null
  }).branding

  const logoVal = brandingDoc?.logo
  const faviconVal = brandingDoc?.favicon
  const brandingInitial = {
    logo:
      logoVal && typeof logoVal === 'object' && logoVal.id != null
        ? {
            id: logoVal.id as string | number,
            url: logoVal.url ?? undefined,
            filename: logoVal.filename ?? undefined,
            filesize: logoVal.filesize ?? undefined,
          }
        : null,
    favicon:
      faviconVal && typeof faviconVal === 'object' && faviconVal.id != null
        ? {
            id: faviconVal.id as string | number,
            url: faviconVal.url ?? undefined,
            filename: faviconVal.filename ?? undefined,
            filesize: faviconVal.filesize ?? undefined,
          }
        : null,
    primaryColor: brandingDoc?.primaryColor ?? undefined,
    secondaryColor: brandingDoc?.secondaryColor ?? undefined,
    accentColor: brandingDoc?.accentColor ?? undefined,
    displayFont: brandingDoc?.displayFont ?? undefined,
  }

  return (
    <div className="p-8 md:p-10 max-w-[900px] mx-auto">
      <BrandingStandalone
        initial={brandingInitial}
        tenantName={tenantName}
        publicUrl={publicUrl}
      />
    </div>
  )
}
