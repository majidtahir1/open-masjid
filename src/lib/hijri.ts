/**
 * Format a date as a Hijri (islamic-umalqura) date string, e.g.
 * "19 Shawwāl 1447". Client-safe (uses Intl only). Falls back to UTC if the
 * provided timezone is invalid.
 */
export function formatHijri(date: Date, timezone: string): string {
  const make = (tz: string | undefined) =>
    new Intl.DateTimeFormat('en-GB-u-ca-islamic-umalqura', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: tz,
    })
  try {
    return make(timezone).format(date).replace(/\s*AH$/, '')
  } catch {
    return make(undefined).format(date).replace(/\s*AH$/, '')
  }
}
