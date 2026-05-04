import type { TenantRecord } from '@/lib/tenant-parse'
import { mediaUrl } from '@/components/types'
import type {
  TenantContactInfo,
  TenantSocialLink,
} from '@/components/types'
import type { PrayerScheduleRecord } from '@/lib/prayer-schedule'

interface MosqueJsonLdProps {
  tenant: TenantRecord
  origin: string
  schedule: PrayerScheduleRecord | null
}

interface PostalAddress {
  '@type': 'PostalAddress'
  streetAddress?: string
  addressLocality?: string
  addressRegion?: string
  postalCode?: string
  addressCountry?: string
}

/**
 * Best-effort parse of a multi-line address string into PostalAddress parts.
 *
 * Editors enter `contactInfo.address` as free-form text. We support two
 * common shapes and degrade gracefully:
 *   "123 Main St\nProsper, TX 75078"  → split into street + city/state/zip
 *   "123 Main St, Prosper, TX 75078"  → same, comma-separated
 * If we can't confidently parse, we emit just `streetAddress` with the full
 * blob — Rich Results Test accepts that, it just gets fewer rich features.
 */
function parseAddress(raw: string | null | undefined): PostalAddress | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed) return null

  // Split by newline first; if single line, fall back to commas.
  const parts = (trimmed.includes('\n') ? trimmed.split('\n') : trimmed.split(','))
    .map((p) => p.trim())
    .filter(Boolean)

  if (parts.length === 0) return null
  if (parts.length === 1) {
    return { '@type': 'PostalAddress', streetAddress: parts[0] }
  }

  const street = parts[0]
  // Try to parse "City, ST 12345" or "City ST 12345" out of the remaining parts.
  const cityLine = parts.slice(1).join(', ')
  const m = cityLine.match(
    /^(?<city>[^,]+?),?\s+(?<region>[A-Z]{2})\s+(?<zip>\d{5}(-\d{4})?)\s*(?:,\s*(?<country>[A-Z]{2,3}|United States|USA))?$/,
  )
  if (m && m.groups) {
    const out: PostalAddress = {
      '@type': 'PostalAddress',
      streetAddress: street,
      addressLocality: m.groups.city.trim(),
      addressRegion: m.groups.region,
      postalCode: m.groups.zip,
      addressCountry: m.groups.country?.includes('US') ? 'US' : m.groups.country ?? 'US',
    }
    return out
  }

  return {
    '@type': 'PostalAddress',
    streetAddress: street,
    addressLocality: cityLine,
  }
}

const DAY_MAP: Record<string, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
}

/**
 * Convert a "h:mm a" or "HH:mm" time string to 24h "HH:MM" suitable for
 * schema.org `opens`/`closes`. Returns null if it cannot parse.
 */
function to24h(value: string | null | undefined): string | null {
  if (!value) return null
  const v = value.trim()
  // Already 24h
  const m24 = v.match(/^([0-2]?\d):([0-5]\d)$/)
  if (m24) {
    const hh = m24[1].padStart(2, '0')
    return `${hh}:${m24[2]}`
  }
  const m12 = v.match(/^(\d{1,2}):?(\d{2})?\s*(am|pm|AM|PM)$/)
  if (m12) {
    let hour = parseInt(m12[1], 10)
    const min = m12[2] ?? '00'
    const mer = m12[3].toLowerCase()
    if (mer === 'pm' && hour < 12) hour += 12
    if (mer === 'am' && hour === 12) hour = 0
    return `${String(hour).padStart(2, '0')}:${min}`
  }
  return null
}

interface OpeningHoursSpec {
  '@type': 'OpeningHoursSpecification'
  dayOfWeek: string
  opens: string
  closes: string
}

/**
 * Derive a Friday Jummah opening-hours block from the active schedule.
 * We pick the first Jummah time and emit a 30-minute window starting then,
 * which is the conservative interpretation Rich Results Test will accept.
 *
 * Returns an empty array if no Jummah time is configured — better to omit
 * than to emit malformed structured data.
 */
function deriveOpeningHours(
  schedule: PrayerScheduleRecord | null,
): OpeningHoursSpec[] {
  if (!schedule?.jummahTimes?.length) return []
  const first = schedule.jummahTimes[0]
  const raw =
    typeof first === 'string' ? first : (first?.time ?? null)
  const opens = to24h(raw)
  if (!opens) return []
  // 30-minute Jummah window
  const [h, m] = opens.split(':').map(Number)
  const closesMin = h * 60 + m + 30
  const closes = `${String(Math.floor(closesMin / 60) % 24).padStart(2, '0')}:${String(
    closesMin % 60,
  ).padStart(2, '0')}`

  return [
    {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: DAY_MAP.friday,
      opens,
      closes,
    },
  ]
}

/**
 * Renders schema.org/Mosque JSON-LD on the tenant homepage.
 * Omits any field whose underlying data is missing — Rich Results Test
 * fails on empty/invalid values, but tolerates absent optional fields.
 */
export default function MosqueJsonLd({ tenant, origin, schedule }: MosqueJsonLdProps) {
  const contactInfo = tenant.contactInfo as TenantContactInfo | null | undefined
  const socialLinks = (tenant.socialLinks as TenantSocialLink[] | null | undefined) ?? []
  const branding = tenant.branding as { logo?: unknown } | null | undefined
  const location = tenant.location as
    | { lat?: number | null; lng?: number | null }
    | null
    | undefined

  const logoPath = mediaUrl(branding?.logo)
  const logoUrl = logoPath
    ? logoPath.startsWith('http')
      ? logoPath
      : `${origin}${logoPath.startsWith('/') ? '' : '/'}${logoPath}`
    : null

  const address = parseAddress(contactInfo?.address)
  const sameAs = socialLinks.map((l) => l.url).filter(Boolean)
  const openingHours = deriveOpeningHours(schedule)

  // Build the JSON-LD object, omitting falsy fields entirely.
  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Mosque',
    name: tenant.name,
    url: origin,
  }

  if (logoUrl) jsonLd.logo = logoUrl
  if (logoUrl) jsonLd.image = logoUrl
  if (address) jsonLd.address = address
  if (contactInfo?.phone) jsonLd.telephone = contactInfo.phone
  if (contactInfo?.email) jsonLd.email = contactInfo.email
  if (
    typeof location?.lat === 'number' &&
    typeof location?.lng === 'number'
  ) {
    jsonLd.geo = {
      '@type': 'GeoCoordinates',
      latitude: location.lat,
      longitude: location.lng,
    }
  }
  if (sameAs.length > 0) jsonLd.sameAs = sameAs
  if (openingHours.length > 0) jsonLd.openingHoursSpecification = openingHours

  return (
    <script
      type="application/ld+json"
      // schema.org JSON is safe to embed; we control every value.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  )
}
