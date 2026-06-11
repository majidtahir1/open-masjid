import { describe, it, expect } from 'vitest'
import { loginUrl, safeLoginRedirect } from '@/lib/login-redirect'

describe('loginUrl', () => {
  it('builds the login URL with the path in the redirect param', () => {
    expect(loginUrl('/admin/billing')).toBe(
      '/admin/login?redirect=%2Fadmin%2Fbilling',
    )
  })

  it('URL-encodes paths with query strings so they survive as one param', () => {
    expect(loginUrl('/admin/donations/connect?status=success')).toBe(
      '/admin/login?redirect=%2Fadmin%2Fdonations%2Fconnect%3Fstatus%3Dsuccess',
    )
  })

  it('round-trips through safeLoginRedirect after URL decoding', () => {
    const original = '/admin/donations/connect?status=success&x=1'
    const url = new URL(loginUrl(original), 'http://localhost')
    const param = url.searchParams.get('redirect')
    expect(safeLoginRedirect(param)).toBe(original)
  })
})

describe('safeLoginRedirect', () => {
  it('falls back to /admin for undefined', () => {
    expect(safeLoginRedirect(undefined)).toBe('/admin')
  })

  it('falls back to /admin for null', () => {
    expect(safeLoginRedirect(null)).toBe('/admin')
  })

  it('falls back to /admin for an empty string', () => {
    expect(safeLoginRedirect('')).toBe('/admin')
  })

  it('returns a normal internal path as-is', () => {
    expect(safeLoginRedirect('/admin/billing')).toBe('/admin/billing')
  })

  it('preserves query strings on internal paths', () => {
    expect(safeLoginRedirect('/admin/donations/connect?status=success')).toBe(
      '/admin/donations/connect?status=success',
    )
  })

  it('rejects protocol-relative URLs (//evil.com)', () => {
    expect(safeLoginRedirect('//evil.com')).toBe('/admin')
  })

  it('rejects backslash protocol-relative URLs (/\\evil.com)', () => {
    expect(safeLoginRedirect('/\\evil.com')).toBe('/admin')
  })

  it('rejects absolute external URLs (https://evil.com)', () => {
    expect(safeLoginRedirect('https://evil.com')).toBe('/admin')
  })

  it('rejects other non-slash-prefixed strings', () => {
    expect(safeLoginRedirect('javascript:alert(1)')).toBe('/admin')
    expect(safeLoginRedirect('admin/billing')).toBe('/admin')
  })
})
