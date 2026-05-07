import React from 'react'

import { getAdminUser, getAdminTenant } from '@/lib/admin-context'
import { darken, lighten } from '@/lib/tenantTheme'

/**
 * Inject tenant-branded CSS into the admin shell so the sidebar (and a few
 * other accents) pick up the tenant's primary brand color.
 *
 * Mounted via `admin.components.header` in `payload.config.ts`. Runs as a
 * server component on every admin render — no extra fetch when the tenant
 * record is unchanged because Payload caches the in-flight read in this
 * request lifecycle.
 *
 * Only applies for tenant-scoped users (admin / staff). Platform owners see
 * the default Payload theme.
 */

type TenantRef =
  | string
  | number
  | { id: string | number; branding?: { primaryColor?: string | null } }
  | null
  | undefined

function tenantIdOf(t: TenantRef): string | number | null {
  if (!t) return null
  if (typeof t === 'object' && 'id' in t) return t.id
  return t as string | number
}

function pickTextOn(hex: string): string {
  // YIQ luminance: dark text on light bg, white text on dark bg.
  const m = hex.replace('#', '')
  if (m.length !== 3 && m.length !== 6) return '#ffffff'
  const exp = m.length === 3 ? m.split('').map((c) => c + c).join('') : m
  const r = parseInt(exp.slice(0, 2), 16)
  const g = parseInt(exp.slice(2, 4), 16)
  const b = parseInt(exp.slice(4, 6), 16)
  if ([r, g, b].some(Number.isNaN)) return '#ffffff'
  const yiq = (r * 299 + g * 587 + b * 114) / 1000
  return yiq >= 150 ? '#1f2937' : '#ffffff'
}

async function resolvePrimaryColor(): Promise<string | null> {
  try {
    const { user } = await getAdminUser()
    if (!user) return null

    const u = user as { tenant?: TenantRef }
    const tenantId = tenantIdOf(u.tenant)
    if (!tenantId) return null

    const tenant = (await getAdminTenant(tenantId)) as unknown as
      | { branding?: { primaryColor?: string | null } }
      | null

    const color = tenant?.branding?.primaryColor
    if (!color || typeof color !== 'string') return null
    if (!/^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(color.trim())) return null
    return color.trim()
  } catch {
    return null
  }
}

export default async function TenantThemeStyle() {
  const primary = await resolvePrimaryColor()
  if (!primary) return null

  const text = pickTextOn(primary)
  const muted = text === '#ffffff' ? 'rgba(255,255,255,0.62)' : 'rgba(31,41,55,0.62)'
  const hoverBg = text === '#ffffff' ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)'
  const activeBg = text === '#ffffff' ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.10)'
  const borderCol = text === '#ffffff' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)'
  const press = darken(primary, 0.08) ?? primary
  const soft = lighten(primary, 0.9) ?? primary

  // Selectors target Payload's default admin shell. The `.nav` element is the
  // sidebar; we paint its background with the tenant's primary color and tune
  // foreground colors for legibility against either a light or dark brand.
  const css = `
    .nav, .nav__scroll {
      background: ${primary} !important;
      color: ${text};
    }
    .nav a, .nav button, .nav__link, .nav-group__toggle {
      color: ${muted} !important;
    }
    .nav a:hover, .nav button:hover, .nav__link:hover {
      color: ${text} !important;
      background: ${hoverBg} !important;
    }
    .nav .active, .nav__link.active, .nav__link[aria-current="page"] {
      color: ${text} !important;
      background: ${activeBg} !important;
    }
    .nav .nav-group__toggle, .nav .nav-group__indicator {
      color: ${muted} !important;
    }
    .nav, .nav__scroll {
      border-right: 1px solid ${borderCol} !important;
    }
    .nav hr, .nav__separator {
      border-color: ${borderCol} !important;
    }
    /* Re-color a couple of brand-coupled accents elsewhere in the admin so
       primary buttons match the tenant. */
    :root {
      --theme-success-500: ${primary};
      --tenant-brand: ${primary};
      --tenant-brand-press: ${press};
      --tenant-brand-soft: ${soft};
    }
  `

  return <style dangerouslySetInnerHTML={{ __html: css }} />
}
