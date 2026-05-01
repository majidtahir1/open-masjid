import { headers as getHeaders } from 'next/headers'
import { getPayload } from 'payload'
import React from 'react'

import config from '@payload-config'

/**
 * Hides the auto-generated "Donations" nav group (Funds + All donations) so
 * the only sidebar entry for the donations feature is the custom
 * "Donations Overview" link. The collection routes stay registered, so the
 * action bar on /admin/donations/overview still links into them.
 *
 * Uses CSS injection (mirroring HideTenantsNav) because `admin.hidden: true`
 * on a collection in Payload 3 also disables its routes — we want the URL
 * to keep working, just not appear in the sidebar.
 */
export default async function HideDonationsCollections() {
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: await getHeaders() })
    if (!user) return null

    const css = `
      a[href="/admin/collections/donation-funds"],
      a[href^="/admin/collections/donation-funds?"],
      a[href="/admin/collections/donations"],
      a[href^="/admin/collections/donations?"] {
        display: none !important;
      }
      .nav__link-indicator:has(> a[href="/admin/collections/donation-funds"]),
      .nav__link-indicator:has(> a[href="/admin/collections/donations"]) {
        display: none !important;
      }
      .nav-group:has(a[href="/admin/collections/donation-funds"], a[href="/admin/collections/donations"]):not(
        :has(a:not([href="/admin/collections/donation-funds"]):not([href="/admin/collections/donations"]):not([href^="/admin/collections/donation-funds?"]):not([href^="/admin/collections/donations?"]))
      ) {
        display: none !important;
      }
    `
    return <style dangerouslySetInnerHTML={{ __html: css }} />
  } catch {
    return null
  }
}
