/**
 * Pure tenant theme CSS generation.
 *
 * Given a tenant record, emit a CSS string suitable for inline injection
 * inside a `<style>` tag in the root layout. Maps tenant-chosen brand
 * colors onto the design-system CSS custom properties defined in
 * `globals.css`, and derives hover/press/soft shades programmatically so
 * tenant admins only have to pick three base colors.
 *
 * This module is intentionally dependency-free so it is safe to import from
 * any runtime (Edge, Node, client).
 */

import type { TenantRecord } from './tenant-parse'

type RGB = { r: number; g: number; b: number }

/**
 * Parse `#rgb` or `#rrggbb` into an RGB triple. Returns `null` for anything
 * that doesn't look like a hex color so callers can no-op gracefully.
 */
function parseHex(input: string | undefined | null): RGB | null {
  if (!input) return null
  const raw = input.trim().replace(/^#/, '')
  if (raw.length === 3) {
    const r = parseInt(raw[0] + raw[0], 16)
    const g = parseInt(raw[1] + raw[1], 16)
    const b = parseInt(raw[2] + raw[2], 16)
    if ([r, g, b].some(Number.isNaN)) return null
    return { r, g, b }
  }
  if (raw.length === 6) {
    const r = parseInt(raw.slice(0, 2), 16)
    const g = parseInt(raw.slice(2, 4), 16)
    const b = parseInt(raw.slice(4, 6), 16)
    if ([r, g, b].some(Number.isNaN)) return null
    return { r, g, b }
  }
  return null
}

function toHex({ r, g, b }: RGB): string {
  const h = (n: number) => clamp255(n).toString(16).padStart(2, '0')
  return `#${h(r)}${h(g)}${h(b)}`
}

function clamp255(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)))
}

/**
 * Mix a color with black (`amount > 0` → darker) or white (`amount < 0` →
 * lighter). `amount` is in [-1, 1]: `0.1` = darken 10%, `-0.9` = lighten 90%.
 */
function mix(rgb: RGB, amount: number): RGB {
  const target = amount >= 0 ? 0 : 255
  const a = Math.abs(amount)
  return {
    r: rgb.r * (1 - a) + target * a,
    g: rgb.g * (1 - a) + target * a,
    b: rgb.b * (1 - a) + target * a,
  }
}

export function darken(hex: string, amount: number): string | null {
  const rgb = parseHex(hex)
  if (!rgb) return null
  return toHex(mix(rgb, Math.abs(amount)))
}

export function lighten(hex: string, amount: number): string | null {
  const rgb = parseHex(hex)
  if (!rgb) return null
  return toHex(mix(rgb, -Math.abs(amount)))
}

/**
 * Pull primary / secondary / accent from a tenant record. Supports both
 * the flat `branding.primaryColor` shape (what the admin form produces)
 * and the nested `branding.colors.brand` shape (legacy / alternate).
 */
function extractBrandColors(tenant: TenantRecord | null | undefined): {
  primary?: string
  secondary?: string
  accent?: string
} {
  const branding = tenant?.branding
  if (!branding) return {}

  const primary =
    branding.primaryColor ??
    branding.colors?.brand ??
    undefined
  const secondary =
    branding.secondaryColor ??
    branding.colors?.secondary ??
    undefined
  const accent =
    branding.accentColor ??
    branding.colors?.accent ??
    undefined

  return { primary, secondary, accent }
}

/**
 * Build a CSS rule string mapping tenant brand colors onto design-system
 * custom properties.
 *
 * Intended usage in a server component:
 *   ```tsx
 *   <style dangerouslySetInnerHTML={{ __html: tenantThemeCss(tenant) }} />
 *   ```
 *
 * Returns an empty string when there is no tenant or no colors to apply,
 * so the base tokens from `globals.css` take effect.
 */
export function tenantThemeCss(tenant: TenantRecord | null | undefined): string {
  const { primary, secondary, accent } = extractBrandColors(tenant)

  const decls: string[] = []

  if (primary) {
    decls.push(`--brand: ${primary};`)
    const hover = darken(primary, 0.1)
    const press = darken(primary, 0.2)
    const soft = lighten(primary, 0.9)
    if (hover) decls.push(`--brand-hover: ${hover};`)
    if (press) decls.push(`--brand-press: ${press};`)
    if (soft) decls.push(`--brand-soft: ${soft};`)
  }

  if (secondary) {
    decls.push(`--secondary: ${secondary};`)
    const hover = darken(secondary, 0.1)
    const soft = lighten(secondary, 0.9)
    if (hover) decls.push(`--secondary-hover: ${hover};`)
    if (soft) decls.push(`--secondary-soft: ${soft};`)
  }

  if (accent) {
    decls.push(`--accent: ${accent};`)
    const hover = darken(accent, 0.1)
    const soft = lighten(accent, 0.9)
    if (hover) decls.push(`--accent-hover: ${hover};`)
    if (soft) decls.push(`--accent-soft: ${soft};`)
  }

  if (decls.length === 0) return ''

  return `:root { ${decls.join(' ')} }`
}
