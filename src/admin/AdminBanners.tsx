import React from 'react'

import BillingBanner from './BillingBanner'

/**
 * Global admin banners (billing state).
 *
 * BillingBanner used to live in `admin.components.beforeNavLinks`, but Payload
 * only renders before/afterNavLinks from its *default* sidebar Nav. Now that
 * the sidebar is replaced by the custom top-bar shell (`Nav` slot → TopBarNav),
 * that slot no longer renders — so it's re-homed here as a global provider,
 * pinned just under the 62px top bar so it shows on every admin page. It
 * self-gates (returns null for platform owners and healthy billing), so the
 * fixed strip collapses to zero height when there is nothing to show.
 *
 * Onboarding is intentionally NOT surfaced here: the dashboard's OnboardingShell
 * already shows a setup nudge (and the wizard launcher), so a second global
 * onboarding strip would double up on the dashboard.
 */
export default function AdminBanners({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div style={{ position: 'fixed', top: 62, left: 0, right: 0, zIndex: 59 }}>
        <BillingBanner />
      </div>
      {children}
    </>
  )
}
