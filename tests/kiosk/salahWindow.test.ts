import { describe, it, expect } from 'vitest'
import { computeSalahState, type IqamahPoint } from '@/lib/kiosk/salahWindow'

// 2026-05-26 is a Tuesday. Use local-time Date objects.
const at = (h: number, m: number) => new Date(2026, 4, 26, h, m, 0)

const iqamahs: IqamahPoint[] = [
  { name: 'Fajr', label: '5:45 AM', minutes: 5 * 60 + 45 },
  { name: 'Maghrib', label: '8:33 PM', minutes: 20 * 60 + 33 },
]

describe('computeSalahState (auto)', () => {
  it('is inactive before any iqamah', () => {
    const s = computeSalahState({ now: at(5, 0), iqamahs, holdoverMinutes: 15, manualUntil: null, manualClearedAt: null })
    expect(s.active).toBe(false)
  })
  it('is active during the holdover after iqamah', () => {
    const s = computeSalahState({ now: at(5, 50), iqamahs, holdoverMinutes: 15, manualUntil: null, manualClearedAt: null })
    expect(s.active).toBe(true)
    expect(s.prayerName).toBe('Fajr')
    expect(s.iqamahLabel).toBe('5:45 AM')
  })
  it('clears after the holdover elapses', () => {
    const s = computeSalahState({ now: at(6, 1), iqamahs, holdoverMinutes: 15, manualUntil: null, manualClearedAt: null })
    expect(s.active).toBe(false)
  })
})

describe('computeSalahState (manual)', () => {
  it('is active while now < manualUntil', () => {
    const now = at(14, 0)
    const manualUntil = at(14, 10).toISOString()
    const s = computeSalahState({ now, iqamahs, holdoverMinutes: 15, manualUntil, manualClearedAt: null })
    expect(s.active).toBe(true)
  })
  it('is cleared when manualClearedAt is after the trigger', () => {
    const now = at(14, 5)
    const manualUntil = at(14, 10).toISOString()
    const manualClearedAt = at(14, 3).toISOString()
    const s = computeSalahState({ now, iqamahs, holdoverMinutes: 15, manualUntil, manualClearedAt })
    expect(s.active).toBe(false)
  })
})
