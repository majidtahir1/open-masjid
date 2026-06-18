import React from 'react'

import BillingBanner from './BillingBanner'
import OnboardingBanner from './onboarding/OnboardingBanner'

/**
 * Global admin banners (billing state + onboarding nudge).
 *
 * These used to live in `admin.components.beforeNavLinks`, but Payload only
 * renders before/afterNavLinks from its *default* sidebar Nav. Now that the
 * sidebar is replaced by the custom top-bar shell (`Nav` slot → TopBarNav),
 * those slots no longer render — so the banners are re-homed here as a global
 * provider, pinned just under the 62px top bar so they show on every admin
 * page. Both banner components self-gate (return null for platform owners,
 * healthy billing, completed onboarding), so the fixed strip collapses to zero
 * height when there is nothing to show.
 */
export default function AdminBanners({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div style={{ position: 'fixed', top: 62, left: 0, right: 0, zIndex: 59 }}>
        <BillingBanner />
        <OnboardingBanner />
      </div>
      {children}
    </>
  )
}
