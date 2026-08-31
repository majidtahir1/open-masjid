import { describe, expect, it } from 'vitest'

import { isExternalHref, resolveServiceLink } from '@/lib/serviceLink'

describe('resolveServiceLink', () => {
  it('resolves a populated linkPage doc to its slug path', () => {
    expect(
      resolveServiceLink({ linkType: 'page', linkPage: { slug: 'nikah' } }),
    ).toEqual({ href: '/nikah', external: false })
  })

  it('returns no link for a bare (unpopulated) linkPage id', () => {
    expect(resolveServiceLink({ linkType: 'page', linkPage: 42 })).toBeNull()
    expect(resolveServiceLink({ linkType: 'page', linkPage: 'abc123' })).toBeNull()
  })

  it('returns no link when the page doc is missing or has a blank slug', () => {
    expect(resolveServiceLink({ linkType: 'page', linkPage: null })).toBeNull()
    expect(
      resolveServiceLink({ linkType: 'page', linkPage: { slug: '  ' } }),
    ).toBeNull()
    expect(resolveServiceLink({ linkType: 'page', linkPage: {} })).toBeNull()
  })

  it('flags full http(s) URLs as external', () => {
    expect(
      resolveServiceLink({ linkType: 'url', linkUrl: 'https://example.org/give' }),
    ).toEqual({ href: 'https://example.org/give', external: true })
    expect(
      resolveServiceLink({ linkType: 'url', linkUrl: 'http://example.org' }),
    ).toEqual({ href: 'http://example.org', external: true })
  })

  it('accepts root-relative paths as in-site links', () => {
    expect(
      resolveServiceLink({ linkType: 'url', linkUrl: '/programs' }),
    ).toEqual({ href: '/programs', external: false })
  })

  it('rejects dangerous or ambiguous schemes (stored XSS guard)', () => {
    for (const url of [
      // eslint-disable-next-line no-script-url
      'javascript:alert(1)',
      'JAVASCRIPT:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'vbscript:msgbox(1)',
      '//evil.example.org/phish',
      'programs', // bare word — ambiguous, not root-relative
      'mailto:x@y.z',
    ]) {
      expect(resolveServiceLink({ linkType: 'url', linkUrl: url })).toBeNull()
    }
  })

  it('returns no link for a blank linkUrl', () => {
    expect(resolveServiceLink({ linkType: 'url', linkUrl: '' })).toBeNull()
    expect(resolveServiceLink({ linkType: 'url', linkUrl: '   ' })).toBeNull()
    expect(resolveServiceLink({ linkType: 'url' })).toBeNull()
  })

  it('returns no link when linkType is none or missing', () => {
    expect(
      resolveServiceLink({ linkType: 'none', linkUrl: 'https://x.org' }),
    ).toBeNull()
    expect(resolveServiceLink({})).toBeNull()
    expect(resolveServiceLink({ linkType: null })).toBeNull()
  })
})

describe('isExternalHref', () => {
  it('matches http and https schemes case-insensitively', () => {
    expect(isExternalHref('https://a.com')).toBe(true)
    expect(isExternalHref('HTTP://a.com')).toBe(true)
    expect(isExternalHref('/relative')).toBe(false)
    expect(isExternalHref('mailto:x@y.z')).toBe(false)
  })
})
