import React from 'react'

/**
 * The Payload sidebar is a flex column. Native collection groups render
 * in the order they appear in `payload.config.collections`, with custom
 * links from `beforeNavLinks` / `afterNavLinks` bracketing them.
 *
 * We can't naturally inject a custom link *between* two native groups,
 * so we use CSS `order` to re-stack the flex items at render time:
 *
 *   1. Dashboard link
 *   2. Prayer group        (native)
 *   3. Content group       (native)
 *   4. Kiosk group         (native — its own section, directly below Content)
 *   5. Forms group         (native)
 *   6. Membership link     (custom — overview-only; collections are hidden)
 *   7. Donations link      (custom)
 *   8. View public site    (custom)
 *   99. Site Settings      (custom — pinned bottom)
 *   100. Logout
 *
 * Group identification uses `:has(a[href^="..."])` to find each group by a
 * collection slug it contains. Stable as long as the group's `admin.group`
 * label or members don't change.
 */
export default function NavOrder() {
  const css = `
    /* Reorder nav items via flex 'order'.
       Default order is 0, so any item we don't list (e.g. an unknown group)
       still renders. Payload's .nav__controls (logout) has margin-top:auto
       and default order:0 — without overriding, it would visually render
       FIRST and its auto-margin eats the entire top space, pushing the rest
       of the items down. We move it to the end and clear its auto margin.
       Site Settings then takes over as the bottom-pinned item. */

    .nav .nav__link--dashboard { order: 1; }
    .nav .nav-group:has(a[href^="/admin/collections/prayer-schedules"]) { order: 2; }
    .nav .nav-group:has(a[href^="/admin/collections/events"]) { order: 3; }
    .nav .nav-group:has(a[href^="/admin/collections/kiosks"]) { order: 4; }
    .nav .nav-group:has(a[href^="/admin/collections/forms"]) { order: 5; }
    .nav a[data-membership-nav-link] { order: 6; }
    .nav a[data-donations-nav-link] { order: 7; }
    .nav a[data-view-public-site] { order: 8; }

    /* Pin Site Settings just above the logout, with all the empty space
       above it. */
    .nav a[data-site-settings-link] {
      order: 99;
      margin-top: auto !important;
    }

    /* Logout sits at the very bottom, right under Site Settings. */
    .nav .nav__controls {
      order: 100;
      margin-top: 0 !important;
    }
  `
  return <style dangerouslySetInnerHTML={{ __html: css }} />
}
