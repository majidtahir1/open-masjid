/**
 * WCAG contrast ratio helper.
 *
 * `contrastRatio(hexA, hexB)` returns the WCAG 2.x contrast ratio between
 * two sRGB colors expressed as hex strings (with or without leading `#`,
 * 3- or 6-digit). Returns 1.0 for identical colors, up to 21 for black/white.
 *
 * Intended for the branding step's tiny "Aa 4.7" chips — round to 1 decimal
 * for display.
 */

function normalizeHex(hex: string): string {
  let h = hex.trim().replace(/^#/, '')
  if (h.length === 3) {
    h = h
      .split('')
      .map((c) => c + c)
      .join('')
  }
  return h.toLowerCase()
}

function hexToRgb(hex: string): [number, number, number] {
  const h = normalizeHex(hex)
  if (!/^[0-9a-f]{6}$/.test(h)) {
    return [0, 0, 0]
  }
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return [r, g, b]
}

function channelLuminance(c: number): number {
  const s = c / 255
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex)
  return (
    0.2126 * channelLuminance(r) +
    0.7152 * channelLuminance(g) +
    0.0722 * channelLuminance(b)
  )
}

export function contrastRatio(hexA: string, hexB: string): number {
  const la = relativeLuminance(hexA)
  const lb = relativeLuminance(hexB)
  const lighter = Math.max(la, lb)
  const darker = Math.min(la, lb)
  return (lighter + 0.05) / (darker + 0.05)
}
