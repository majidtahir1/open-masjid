/**
 * Pure milestone-state computation for tenant onboarding.
 *
 * Status is purely auto-detected from tenant data — there is no persisted
 * skip/complete override. The wizard is a navigational tool: clicking a tile
 * deep-links to the relevant editor; doing the work flips the milestone to
 * `complete`. Hitting the wizard again always shows live state.
 *
 * Edge-safe: zero runtime dependencies. Importable from RSC, client, or
 * the API endpoint without pulling Payload.
 */

export const MILESTONES = [
  'branding',
  'identity',
  'prayer',
  'firstEvent',
  'hero',
  'donations',
] as const

export type MilestoneSlug = (typeof MILESTONES)[number]

export type MilestoneStatus = 'complete' | null

export type MilestoneState = {
  slug: MilestoneSlug
  status: MilestoneStatus
}

export type OnboardingInput = {
  tenant: {
    // `logo` is a Payload media reference: id (number/string), populated Media object, or null.
    // We use a permissive shape rather than importing the Payload-generated type so this module
    // stays edge-safe.
    branding?: { logo?: string | number | { id?: string | number } | null } | null
    contactInfo?: { address?: string | null } | null
    donationConfig?: { mode?: string | null } | null
  }
  counts: {
    prayerSchedules: number
    events: number
    heroSlides: number
  }
}

function isAutoComplete(slug: MilestoneSlug, input: OnboardingInput): boolean {
  const t = input.tenant
  switch (slug) {
    case 'branding': {
      const logo = t.branding?.logo
      if (logo == null) return false
      if (typeof logo === 'object') return Boolean(logo.id)
      return Boolean(logo)
    }
    case 'identity':
      return Boolean(t.contactInfo?.address?.trim())
    case 'prayer':
      return input.counts.prayerSchedules > 0
    case 'firstEvent':
      return input.counts.events > 0
    case 'hero':
      return input.counts.heroSlides > 0
    case 'donations':
      return Boolean(t.donationConfig?.mode)
  }
}

export function computeMilestoneStates(input: OnboardingInput): MilestoneState[] {
  return MILESTONES.map((slug) => ({
    slug,
    status: isAutoComplete(slug, input) ? ('complete' as const) : null,
  }))
}

export function isAllDone(states: MilestoneState[]): boolean {
  return states.every((s) => s.status === 'complete')
}

export function doneCount(states: MilestoneState[]): number {
  return states.filter((s) => s.status === 'complete').length
}
