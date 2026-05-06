// tests/lib/form-appearance.test.ts
import { describe, it, expect } from 'vitest'
import {
  computeBackgroundCss,
  flattenStepsForOnePerPage,
  resolveSubmissionMessage,
} from '@/lib/form-appearance'
import type { FormSchema } from '@/lib/form-schema'

describe('computeBackgroundCss', () => {
  it('returns undefined when no appearance set', () => {
    expect(computeBackgroundCss(undefined)).toBeUndefined()
    expect(computeBackgroundCss({})).toBeUndefined()
  })
  it('returns the solid color when only color is set', () => {
    expect(computeBackgroundCss({ backgroundColor: '#FAF9F4' })).toBe('#FAF9F4')
  })
  it('returns a gradient when from is set, ignoring color', () => {
    const css = computeBackgroundCss({
      backgroundColor: '#FFFFFF',
      backgroundGradient: { from: '#1B3358', to: '#0E1B2C', direction: 'vertical' },
    })
    expect(css).toBe('linear-gradient(180deg, #1B3358, #0E1B2C)')
  })
  it('uses the right angle for each direction', () => {
    const make = (direction: 'vertical' | 'horizontal' | 'diagonal') =>
      computeBackgroundCss({
        backgroundGradient: { from: '#000', to: '#fff', direction },
      })
    expect(make('vertical')).toBe('linear-gradient(180deg, #000, #fff)')
    expect(make('horizontal')).toBe('linear-gradient(90deg, #000, #fff)')
    expect(make('diagonal')).toBe('linear-gradient(135deg, #000, #fff)')
  })
})

describe('flattenStepsForOnePerPage', () => {
  const schema: FormSchema = {
    steps: [
      { id: 's1', fields: [
        { type: 'short-text', id: 'f1', name: 'name', label: 'Name', required: true },
        { type: 'page-break', id: 'pb1', name: 'pb1' },
        { type: 'email', id: 'f2', name: 'email', label: 'Email', required: true },
      ]},
      { id: 's2', fields: [
        { type: 'short-text', id: 'f3', name: 'note', label: 'Note', required: false },
      ]},
    ],
  }
  it('returns one step per non-page-break field, in order', () => {
    const flat = flattenStepsForOnePerPage(schema)
    expect(flat.steps.length).toBe(3)
    expect(flat.steps.map((s) => s.fields[0].id)).toEqual(['f1', 'f2', 'f3'])
  })
  it('drops page-break fields entirely', () => {
    const flat = flattenStepsForOnePerPage(schema)
    expect(flat.steps.flatMap((s) => s.fields).find((f) => f.type === 'page-break')).toBeUndefined()
  })
  it('returns empty steps array when schema has no non-page-break fields', () => {
    const empty: FormSchema = { steps: [{ id: 's1', fields: [{ type: 'page-break', id: 'pb', name: 'pb' }] }] }
    expect(flattenStepsForOnePerPage(empty).steps).toEqual([])
  })
})

describe('resolveSubmissionMessage', () => {
  it('prefers appearance.submissionMessage when present', () => {
    const result = resolveSubmissionMessage({
      appearance: { submissionMessage: { root: { type: 'root' } } as any },
      settings: { successMessage: { root: { type: 'root', text: 'old' } } as any },
    })
    expect(result).toEqual({ root: { type: 'root' } })
  })
  it('falls back to settings.successMessage when appearance not set', () => {
    const result = resolveSubmissionMessage({
      settings: { successMessage: { root: { type: 'root', text: 'old' } } as any },
    })
    expect(result).toEqual({ root: { type: 'root', text: 'old' } })
  })
  it('returns null when neither is set', () => {
    expect(resolveSubmissionMessage({})).toBeNull()
  })
})
