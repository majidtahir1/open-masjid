import { describe, it, expect } from 'vitest'
import { extractExcerpt } from '@/lib/blog'

const doc = (children: unknown[]) => ({ root: { children } })
const para = (text: string) => ({
  type: 'paragraph',
  children: [{ type: 'text', text }],
})

describe('extractExcerpt', () => {
  it('returns the first paragraph text', () => {
    const data = doc([para('First paragraph.'), para('Second.')])
    expect(extractExcerpt(data)).toBe('First paragraph.')
  })

  it('skips non-paragraph leading nodes (e.g. headings)', () => {
    const data = doc([
      { type: 'heading', tag: 'h2', children: [{ type: 'text', text: 'Title' }] },
      para('The real intro.'),
    ])
    expect(extractExcerpt(data)).toBe('The real intro.')
  })

  it('truncates to the max length with an ellipsis', () => {
    const long = 'word '.repeat(60).trim()
    const out = extractExcerpt(doc([para(long)]), 40)
    expect(out.length).toBeLessThanOrEqual(41)
    expect(out.endsWith('…')).toBe(true)
  })

  it('returns empty string for empty/invalid content', () => {
    expect(extractExcerpt(null)).toBe('')
    expect(extractExcerpt(doc([]))).toBe('')
  })
})
