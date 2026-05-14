import { createHash } from 'node:crypto'

export interface VersionInput {
  slideIds: string[]
  slideUpdatedAts: string[]
  day: string
  broadcastAt: string | null
  pushAt: string | null
}

export function versionHash(input: VersionInput): string {
  const parts = [
    input.slideIds.join(','),
    input.slideUpdatedAts.join(','),
    input.day,
    input.broadcastAt ?? '',
    input.pushAt ?? '',
  ].join('|')
  return createHash('sha1').update(parts).digest('hex').slice(0, 16)
}
