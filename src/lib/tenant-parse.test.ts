import { describe, it, expect } from 'vitest'
import { parseHostContext } from './tenant-parse'

describe('parseHostContext — bare localhost', () => {
  it('classifies bare localhost as localhost', () => {
    expect(parseHostContext('localhost')).toEqual({ type: 'localhost' })
    expect(parseHostContext('localhost:3000')).toEqual({ type: 'localhost' })
    expect(parseHostContext('127.0.0.1:3000')).toEqual({ type: 'localhost' })
  })
})

describe('parseHostContext — *.localhost dev subdomains', () => {
  it('treats `<slug>.localhost` as a tenant subdomain', () => {
    expect(parseHostContext('uthman.localhost:3000')).toEqual({
      type: 'tenant-subdomain',
      slug: 'uthman',
    })
    expect(parseHostContext('icp.localhost')).toEqual({
      type: 'tenant-subdomain',
      slug: 'icp',
    })
  })

  it('falls back to localhost for multi-label .localhost hosts', () => {
    expect(parseHostContext('foo.bar.localhost:3000')).toEqual({ type: 'localhost' })
  })
})

describe('parseHostContext — production hosts', () => {
  it('classifies the apex platform domain as marketing', () => {
    expect(parseHostContext('openmasjid.app')).toEqual({ type: 'platform-marketing' })
    expect(parseHostContext('www.openmasjid.app')).toEqual({ type: 'platform-marketing' })
  })

  it('classifies tenant subdomains', () => {
    expect(parseHostContext('uthman.openmasjid.app')).toEqual({
      type: 'tenant-subdomain',
      slug: 'uthman',
    })
  })

  it('classifies the admin subdomain separately', () => {
    expect(parseHostContext('admin.openmasjid.app')).toEqual({ type: 'platform-admin' })
  })

  it('classifies anything else as a custom domain candidate', () => {
    expect(parseHostContext('icprosper.org')).toEqual({
      type: 'tenant-custom',
      host: 'icprosper.org',
    })
    expect(parseHostContext('www.icprosper.org')).toEqual({
      type: 'tenant-custom',
      host: 'icprosper.org',
    })
  })
})
