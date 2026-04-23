import { describe, expect, it } from 'vitest'
import { applyIqamahRule, type IqamahRule } from '@/lib/iqamah'

describe('applyIqamahRule', () => {
  it('returns the absolute value verbatim when mode=absolute', () => {
    const rule: IqamahRule = { mode: 'absolute', value: '5:45 AM' }
    expect(applyIqamahRule(rule, '5:30 AM')).toBe('5:45 AM')
  })

  it('adds offset minutes to adhan when mode=offset', () => {
    const rule: IqamahRule = { mode: 'offset', value: 5 }
    expect(applyIqamahRule(rule, '8:30 PM')).toBe('8:35 PM')
  })

  it('crosses the hour when offset pushes past 60 minutes', () => {
    const rule: IqamahRule = { mode: 'offset', value: 45 }
    expect(applyIqamahRule(rule, '5:30 AM')).toBe('6:15 AM')
  })

  it('crosses AM→PM correctly', () => {
    const rule: IqamahRule = { mode: 'offset', value: 40 }
    expect(applyIqamahRule(rule, '11:30 AM')).toBe('12:10 PM')
  })

  it('returns empty string for absolute mode with empty value', () => {
    const rule: IqamahRule = { mode: 'absolute', value: '' }
    expect(applyIqamahRule(rule, '5:30 AM')).toBe('')
  })

  it('returns empty string when offset is applied to an unparseable adhan', () => {
    const rule: IqamahRule = { mode: 'offset', value: 5 }
    expect(applyIqamahRule(rule, 'at sunset')).toBe('')
  })
})
