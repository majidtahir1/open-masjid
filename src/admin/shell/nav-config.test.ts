// src/admin/shell/nav-config.test.ts
import { describe, it, expect } from 'vitest'
import { visibleFor, searchEntries } from './nav-config'

describe('visibleFor', () => {
  it('admin sees every top-level area', () => {
    const labels = visibleFor('admin').map((i) => i.label)
    expect(labels).toEqual(
      expect.arrayContaining(['Dashboard', 'Prayer', 'Website', 'Displays', 'Forms', 'Community', 'Programs']),
    )
  })

  it('staff loses Community but keeps content areas', () => {
    const labels = visibleFor('staff').map((i) => i.label)
    expect(labels).toContain('Website')
    expect(labels).toContain('Forms')
    expect(labels).not.toContain('Community')
  })

  it('kioskManager only sees Dashboard and Displays', () => {
    expect(visibleFor('kioskManager').map((i) => i.label)).toEqual(['Dashboard', 'Displays'])
  })

  it('platformOwner sees content areas plus platform entries', () => {
    const labels = visibleFor('platformOwner').map((i) => i.label)
    expect(labels).toContain('Community')
    expect(labels).toContain('Tenants')
  })

  it('filters children of a mega-menu by role', () => {
    const displaysForKiosk = visibleFor('kioskManager').find((i) => i.label === 'Displays')
    expect(displaysForKiosk?.kind).toBe('group')
    // Kiosk keeps all Displays children
    const kids = displaysForKiosk?.kind === 'group' ? displaysForKiosk.children.map((c) => c.label) : []
    expect(kids).toContain('Kiosks')
  })
})

describe('searchEntries', () => {
  it('returns actions and pages matching the query for the role', () => {
    const res = searchEntries('admin', 'event')
    expect(res.actions.some((a) => /event/i.test(a.label))).toBe(true)
    expect(res.pages.some((p) => /event/i.test(p.label))).toBe(true)
  })

  it('empty query returns the full role-scoped set', () => {
    const res = searchEntries('staff', '')
    expect(res.pages.length).toBeGreaterThan(0)
    expect(res.actions.length).toBeGreaterThan(0)
  })

  it('excludes entries the role cannot see', () => {
    const res = searchEntries('kioskManager', '')
    expect(res.pages.every((p) => p.roles.includes('kioskManager'))).toBe(true)
    expect(res.pages.some((p) => p.label === 'Donations')).toBe(false)
  })

  it('no matches yields empty arrays', () => {
    const res = searchEntries('admin', 'zzzznope')
    expect(res.actions).toEqual([])
    expect(res.pages).toEqual([])
  })
})
