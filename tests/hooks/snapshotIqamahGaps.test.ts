// tests/hooks/snapshotIqamahGaps.test.ts
import { describe, expect, it } from 'vitest'
import { snapshotIqamahGaps } from '@/hooks/snapshotIqamahGaps'

const day = (date: string, fajrAdhan: string, fajrIqamah: string) => ({
  date,
  fajr: { adhan: fajrAdhan, iqamah: fajrIqamah },
  zuhr: { adhan: '1:30 PM', iqamah: '1:45 PM' },
  asr: { adhan: '5:00 PM', iqamah: '5:15 PM' },
  maghrib: { adhan: '8:30 PM', iqamah: '8:35 PM' },
  isha: { adhan: '10:00 PM', iqamah: '10:15 PM' },
})

const baseRules = {
  fajr: { mode: 'absolute', absoluteValue: '6:00 AM' },
  zuhr: { mode: 'offset', offsetMinutes: 15 },
  asr: { mode: 'offset', offsetMinutes: 15 },
  maghrib: { mode: 'offset', offsetMinutes: 5 },
  isha: { mode: 'offset', offsetMinutes: 15 },
}

function run(data: Record<string, unknown>, originalDoc?: Record<string, unknown>) {
  // hook signature: ({ data, originalDoc }) => data
  return snapshotIqamahGaps({ data, originalDoc } as never) as Promise<Record<string, unknown>>
}

describe('snapshotIqamahGaps', () => {
  it('snapshots iqamah-minus-adhan for a newly set absolute value', async () => {
    const data = {
      iqamahRules: structuredClone(baseRules),
      days: [day('2099-01-01T00:00:00.000Z', '5:30 AM', '6:00 AM')],
    }
    const out = await run(data)
    expect((out.iqamahRules as typeof baseRules).fajr).toMatchObject({ gapAtCreation: 30 })
  })

  it('re-snapshots when the absolute value changes', async () => {
    const data = {
      iqamahRules: { ...structuredClone(baseRules), fajr: { mode: 'absolute', absoluteValue: '6:15 AM', gapAtCreation: 30 } },
      days: [day('2099-01-01T00:00:00.000Z', '5:30 AM', '6:15 AM')],
    }
    const original = { iqamahRules: structuredClone(baseRules) } // had 6:00 AM
    const out = await run(data, original)
    expect((out.iqamahRules as typeof baseRules).fajr).toMatchObject({ gapAtCreation: 45 })
  })

  it('leaves an existing snapshot alone when the value is unchanged', async () => {
    const rules = { ...structuredClone(baseRules), fajr: { mode: 'absolute', absoluteValue: '6:00 AM', gapAtCreation: 22 } }
    const data = { iqamahRules: structuredClone(rules), days: [day('2099-01-01T00:00:00.000Z', '5:30 AM', '6:00 AM')] }
    const out = await run(data, { iqamahRules: structuredClone(rules) })
    expect((out.iqamahRules as typeof baseRules).fajr).toMatchObject({ gapAtCreation: 22 })
  })

  it('skips offset-mode prayers while snapshotting absolute ones', async () => {
    const rules = {
      fajr: { mode: 'absolute', absoluteValue: '6:00 AM' },
      zuhr: { mode: 'offset', offsetMinutes: 15 },
      asr: { mode: 'offset', offsetMinutes: 15 },
      maghrib: { mode: 'offset', offsetMinutes: 5 },
      isha: { mode: 'offset', offsetMinutes: 15 },
    }
    const data = {
      iqamahRules: structuredClone(rules),
      days: [day('2099-01-01T00:00:00.000Z', '5:30 AM', '6:00 AM')],
    }
    const out = await run(data)
    expect((out.iqamahRules as typeof rules).fajr).toHaveProperty('gapAtCreation')
    expect((out.iqamahRules as typeof rules).zuhr).not.toHaveProperty('gapAtCreation')
  })

  it('is a no-op when there are no generated days', async () => {
    const out = await run({ iqamahRules: structuredClone(baseRules), days: [] })
    expect((out.iqamahRules as typeof baseRules).fajr).not.toHaveProperty('gapAtCreation')
    expect((out.iqamahRules as typeof baseRules).zuhr).not.toHaveProperty('gapAtCreation')
  })

  it('snapshots a midnight-crossing iqamah gap as 30 minutes (11:45 PM → 12:15 AM)', async () => {
    const ishaDay = {
      date: '2099-01-01T00:00:00.000Z',
      fajr: { adhan: '5:30 AM', iqamah: '6:00 AM' },
      zuhr: { adhan: '1:30 PM', iqamah: '1:45 PM' },
      asr: { adhan: '5:00 PM', iqamah: '5:15 PM' },
      maghrib: { adhan: '8:30 PM', iqamah: '8:35 PM' },
      isha: { adhan: '11:45 PM', iqamah: '12:15 AM' },
    }
    const rules = {
      fajr: { mode: 'offset', offsetMinutes: 30 },
      zuhr: { mode: 'offset', offsetMinutes: 15 },
      asr: { mode: 'offset', offsetMinutes: 15 },
      maghrib: { mode: 'offset', offsetMinutes: 5 },
      isha: { mode: 'absolute', absoluteValue: '12:15 AM' },
    }
    const data = { iqamahRules: structuredClone(rules), days: [ishaDay] }
    const out = await run(data)
    expect((out.iqamahRules as typeof rules).isha).toMatchObject({ gapAtCreation: 30 })
  })
})
