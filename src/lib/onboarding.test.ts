import { describe, it, expect } from 'vitest'
import { computeMilestoneStates, MILESTONES, type OnboardingInput } from './onboarding'

const empty: OnboardingInput = {
  tenant: {
    branding: { logo: null },
    contactInfo: { address: null },
    donationConfig: { mode: null },
    onboarding: null,
  },
  counts: { prayerSchedules: 0, events: 0, heroSlides: 0 },
}

describe('computeMilestoneStates', () => {
  it('returns six milestones in fixed order', () => {
    const states = computeMilestoneStates(empty)
    expect(states.map((s) => s.slug)).toEqual([
      'branding',
      'identity',
      'prayer',
      'firstEvent',
      'hero',
      'donations',
    ])
  })

  it('detects branding complete when logo is set', () => {
    const states = computeMilestoneStates({
      ...empty,
      tenant: { ...empty.tenant, branding: { logo: 'media-id-1' } },
    })
    expect(states.find((s) => s.slug === 'branding')?.status).toBe('complete')
  })

  it('detects identity complete when address is set', () => {
    const states = computeMilestoneStates({
      ...empty,
      tenant: { ...empty.tenant, contactInfo: { address: '123 Main St, Plano TX' } },
    })
    expect(states.find((s) => s.slug === 'identity')?.status).toBe('complete')
  })

  it('detects prayer complete when at least one schedule exists', () => {
    const states = computeMilestoneStates({
      ...empty,
      counts: { ...empty.counts, prayerSchedules: 1 },
    })
    expect(states.find((s) => s.slug === 'prayer')?.status).toBe('complete')
  })

  it('detects firstEvent complete when at least one event exists', () => {
    const states = computeMilestoneStates({
      ...empty,
      counts: { ...empty.counts, events: 1 },
    })
    expect(states.find((s) => s.slug === 'firstEvent')?.status).toBe('complete')
  })

  it('detects hero complete when at least one hero slide exists', () => {
    const states = computeMilestoneStates({
      ...empty,
      counts: { ...empty.counts, heroSlides: 1 },
    })
    expect(states.find((s) => s.slug === 'hero')?.status).toBe('complete')
  })

  it('detects donations complete when mode is any non-null value', () => {
    const states = computeMilestoneStates({
      ...empty,
      tenant: { ...empty.tenant, donationConfig: { mode: 'hidden' } },
    })
    expect(states.find((s) => s.slug === 'donations')?.status).toBe('complete')
  })

  it('returns dismissed when explicitly dismissed and not auto-detected', () => {
    const states = computeMilestoneStates({
      ...empty,
      tenant: { ...empty.tenant, onboarding: { branding: 'dismissed' } },
    })
    expect(states.find((s) => s.slug === 'branding')?.status).toBe('dismissed')
  })

  it('auto-detected complete trumps explicit dismissed', () => {
    const states = computeMilestoneStates({
      ...empty,
      tenant: {
        ...empty.tenant,
        branding: { logo: 'm1' },
        onboarding: { branding: 'dismissed' },
      },
    })
    expect(states.find((s) => s.slug === 'branding')?.status).toBe('complete')
  })

  it('returns not-started by default', () => {
    const states = computeMilestoneStates(empty)
    expect(states.every((s) => s.status === null)).toBe(true)
  })
})
