import { randomInt } from 'node:crypto'

// Ambiguous chars removed: 0, O, 1, I, L (visual confusion on TV screens).
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const SEGMENT = 3

export function generatePairingCode(): string {
  const pick = () => ALPHABET[randomInt(0, ALPHABET.length)]
  const segment = () => Array.from({ length: SEGMENT }, pick).join('')
  return `${segment()}-${segment()}`
}

export function normalizePairingCode(raw: string): string {
  const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (cleaned.length !== SEGMENT * 2) return cleaned
  return `${cleaned.slice(0, SEGMENT)}-${cleaned.slice(SEGMENT)}`
}

export function isValidPairingCode(raw: string): boolean {
  const normalized = normalizePairingCode(raw)
  return /^[A-HJ-NP-Z2-9]{3}-[A-HJ-NP-Z2-9]{3}$/.test(normalized)
}
