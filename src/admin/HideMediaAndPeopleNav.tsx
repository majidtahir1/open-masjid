import React from 'react'

/**
 * Suppresses sidebar entries we don't want surfaced to tenant admins:
 *
 * - **Media** (and the "Library" group it inhabits) — hidden because uploads
 *   happen contextually inside Events / Hero Slides editors, never as a
 *   standalone library workflow for masjid staff. The collection routes stay
 *   intact for upload pickers and direct linking.
 * - **Users** (and the "People" group) — surfaced via Site Settings instead;
 *   tenant admins don't need a top-level entry for it.
 *
 * Mirrors `HideTenantsNav` and `HideDonationsCollections` — CSS injection
 * scoped to the `.nav` element so action-bar links elsewhere in the admin
 * stay visible.
 */
export default function HideMediaAndPeopleNav() {
  const css = `
    .nav a[href="/admin/collections/media"],
    .nav a[href^="/admin/collections/media?"],
    .nav a[href="/admin/collections/users"],
    .nav a[href^="/admin/collections/users?"] {
      display: none !important;
    }
    .nav .nav__link-indicator:has(> a[href="/admin/collections/media"]),
    .nav .nav__link-indicator:has(> a[href="/admin/collections/users"]) {
      display: none !important;
    }
    .nav .nav-group:has(a[href="/admin/collections/media"]):not(
      :has(a:not([href="/admin/collections/media"]):not([href^="/admin/collections/media?"]))
    ),
    .nav .nav-group:has(a[href="/admin/collections/users"]):not(
      :has(a:not([href="/admin/collections/users"]):not([href^="/admin/collections/users?"]))
    ) {
      display: none !important;
    }
  `
  return <style dangerouslySetInnerHTML={{ __html: css }} />
}
