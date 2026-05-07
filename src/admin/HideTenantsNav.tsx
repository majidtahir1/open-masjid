import React from 'react'

import { getAdminUser } from '@/lib/admin-context'

/**
 * Hides the "Tenants" nav link (and its "Site" group heading) from the admin
 * sidebar for non-platformOwner users. URL access is preserved so the
 * "Site Settings" quick-link still deep-links into the tenant's own record.
 *
 * We can't use `admin.hidden` on the collection because Payload 3 treats a
 * hidden collection as if its admin routes don't exist — the edit URL 404s
 * even when access rules would permit the read. Injecting CSS server-side
 * (role-gated) hides from nav without touching route registration.
 */
export default async function HideTenantsNav() {
  try {
    const { user } = await getAdminUser()
    const u = user as { role?: string } | null | undefined
    if (!u || u.role === 'platformOwner') return null

    // Hide the Tenants link itself AND its nav group container (so the "Site"
    // heading doesn't hang orphaned). Uses :has() which is supported in all
    // evergreen browsers (Chrome 105+, Firefox 121+, Safari 15.4+).
    const css = `
      a[href="/admin/collections/tenants"],
      a[href^="/admin/collections/tenants?"] {
        display: none !important;
      }
      .nav__link-indicator:has(> a[href="/admin/collections/tenants"]),
      .nav-group:has(a[href="/admin/collections/tenants"]):not(:has(a:not([href^="/admin/collections/tenants"]))) {
        display: none !important;
      }
    `
    return <style dangerouslySetInnerHTML={{ __html: css }} />
  } catch {
    return null
  }
}
