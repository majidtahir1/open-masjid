import { describe, it, expect } from 'vitest'
import { computeMilestoneStates, doneCount, isAllDone, MILESTONES, type MilestoneState, type OnboardingInput } from './onboarding'

const empty: OnboardingInput = {
  tenant: {
    branding: { logo: null },
    contactInfo: { address: null },
    donationConfig: { mode: null },
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

  it('returns not-started by default', () => {
    const states = computeMilestoneStates(empty)
    expect(states.every((s) => s.status === null)).toBe(true)
  })

  it('treats whitespace-only address as not complete', () => {
    const states = computeMilestoneStates({
      ...empty,
      tenant: { ...empty.tenant, contactInfo: { address: '   ' } },
    })
    expect(states.find((s) => s.slug === 'identity')?.status).toBeNull()
  })

  it('treats logo id 0 as not complete', () => {
    const states = computeMilestoneStates({
      ...empty,
      tenant: { ...empty.tenant, branding: { logo: 0 } },
    })
    expect(states.find((s) => s.slug === 'branding')?.status).toBeNull()
  })

  it('treats populated logo object as complete', () => {
    const states = computeMilestoneStates({
      ...empty,
      tenant: { ...empty.tenant, branding: { logo: { id: 7 } } },
    })
    expect(states.find((s) => s.slug === 'branding')?.status).toBe('complete')
  })
})

describe('isAllDone', () => {
  const make = (statuses: Array<'complete' | null>): MilestoneState[] =>
    MILESTONES.map((slug, i) => ({ slug, status: statuses[i] }))

  it('is true when all six are complete', () => {
    expect(isAllDone(make(['complete', 'complete', 'complete', 'complete', 'complete', 'complete']))).toBe(true)
  })
  it('is false when any milestone is null', () => {
    expect(isAllDone(make(['complete', 'complete', null, 'complete', 'complete', 'complete']))).toBe(false)
  })
})

describe('doneCount', () => {
  const make = (statuses: Array<'complete' | null>): MilestoneState[] =>
    MILESTONES.map((slug, i) => ({ slug, status: statuses[i] }))

  it('counts complete', () => {
    expect(doneCount(make(['complete', null, null, null, null, null]))).toBe(1)
  })
  it('returns 0 for all null', () => {
    expect(doneCount(make([null, null, null, null, null, null]))).toBe(0)
  })
  it('returns 6 when all done', () => {
    expect(doneCount(make(['complete', 'complete', 'complete', 'complete', 'complete', 'complete']))).toBe(6)
  })
})
