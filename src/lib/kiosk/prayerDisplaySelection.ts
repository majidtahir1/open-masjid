import type { ContentEntry } from './prayerContentSeeds'

export type PrayerVariant = 'cream' | 'night' | 'mihrab'

export const VARIANTS: PrayerVariant[] = ['cream', 'night', 'mihrab']

export function pickVariant(previous: PrayerVariant | null): PrayerVariant {
  const candidates = previous ? VARIANTS.filter((v) => v !== previous) : VARIANTS
  return candidates[Math.floor(Math.random() * candidates.length)]
}

export function pickContent(pool: ContentEntry[], seenIds: string[]): ContentEntry | null {
  if (pool.length === 0) return null
  const seen = new Set(seenIds)
  const unseen = pool.filter((e) => !seen.has(e.id))
  const candidates = unseen.length > 0 ? unseen : pool
  return candidates[Math.floor(Math.random() * candidates.length)]
}
