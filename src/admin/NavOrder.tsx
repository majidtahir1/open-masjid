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
 *   3. Donations link      (custom — moved up via order)
 *   4. Content group       (native)
 *   5. Library group       (native — Media)
 *   6. View public site    (custom)
 *   7. Site Settings link  (custom — pushed to bottom via margin-top: auto)
 *
 * Group identification uses `:has(a[href^="..."])` to find each group by a
 * collection slug it contains. This is stable as long as the group's
 * `admin.group` label or members don't change.
 */
export default function NavOrder() {
  const css = `
    /* Force the nav stack to top-align. Payload's default centers content
       vertically when the items don't fill the viewport. */
    .nav,
    .nav > *,
    .nav__wrap,
    .nav__list,
    .template-default__nav {
      justify-content: flex-start !important;
      align-content: flex-start !important;
    }

    /* Dashboard link is the first nav__link and stays at order 1 */
    .nav .nav__link--dashboard { order: 1; }

    /* Prayer group: contains prayer-schedules */
    .nav .nav-group:has(a[href^="/admin/collections/prayer-schedules"]) { order: 2; }

    /* Custom Donations link */
    .nav a[data-donations-nav-link] { order: 3; }

    /* Content group: contains events (one of several content collections) */
    .nav .nav-group:has(a[href^="/admin/collections/events"]) { order: 4; }

    /* Library group: contains media */
    .nav .nav-group:has(a[href^="/admin/collections/media"]) { order: 5; }

    /* View public site */
    .nav a[data-view-public-site] { order: 7; }

    /* Site Settings link (kept last; margin-top:auto pushes it to bottom) */
    .nav a[data-site-settings-link] { order: 99; }
  `
  return <style dangerouslySetInnerHTML={{ __html: css }} />
}
