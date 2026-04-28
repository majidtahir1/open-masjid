/**
 * Pure milestone-state computation for tenant onboarding.
 *
 * Auto-detected completion always wins over an explicit `dismissed` flag —
 * so when an admin actually does the work of adding a logo / event / etc.
 * after dismissing, the milestone correctly flips to `complete`.
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

export type MilestoneStatus = 'complete' | 'dismissed' | null

export type MilestoneState = {
  slug: MilestoneSlug
  status: MilestoneStatus
}

export type OnboardingInput = {
  tenant: {
    branding?: { logo?: unknown } | null
    contactInfo?: { address?: string | null } | null
    donationConfig?: { mode?: string | null } | null
    onboarding?: Partial<Record<MilestoneSlug, MilestoneStatus>> | null
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
    case 'branding':
      return Boolean(t.branding?.logo)
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
  const explicit = input.tenant.onboarding ?? {}
  return MILESTONES.map((slug) => {
    if (isAutoComplete(slug, input)) {
      return { slug, status: 'complete' as const }
    }
    return { slug, status: (explicit[slug] ?? null) as MilestoneStatus }
  })
}

export function isAllDoneOrDismissed(states: MilestoneState[]): boolean {
  return states.every((s) => s.status === 'complete' || s.status === 'dismissed')
}

export function completedCount(states: MilestoneState[]): number {
  return states.filter((s) => s.status === 'complete' || s.status === 'dismissed').length
}
