/**
 * Shared component prop types.
 *
 * These are intentionally loose structural types — they describe the data the
 * components need to render, not the full Payload record shape. When
 * `payload generate:types` starts working, callers can pass the real Event /
 * HeroSlide / PrayerSchedule / Service / Tenant records and TypeScript will be
 * happy because these interfaces are a subset.
 */

export type Accent = 'cream' | 'teal' | 'navy' | 'gold'

/** Minimal media record shape used for logo / flyer images. */
export interface MediaLike {
  url?: string | null
  alt?: string | null
  filename?: string | null
  width?: number | null
  height?: number | null
}

export interface TenantBranding {
  logo?: MediaLike | string | number | null
  primaryColor?: string | null
  secondaryColor?: string | null
  accentColor?: string | null
  displayFont?: string | null
}

export interface TenantContactInfo {
  phone?: string | null
  email?: string | null
  address?: string | null
}

export interface TenantSocialLink {
  platform: 'facebook' | 'instagram' | 'youtube' | 'twitter' | 'linkedin'
  url: string
}

export interface TenantDonationConfig {
  mode?: 'external' | 'stripe' | null
  externalUrl?: string | null
  stripeAccountId?: string | null
}

export interface TenantCustomDomain {
  domain: string
}

export interface TenantLike {
  id?: string | number
  name?: string | null
  slug?: string | null
  siteType?: 'masjid' | 'umbrella' | null
  customDomains?: Array<TenantCustomDomain | string> | null
  branding?: TenantBranding | null
  contactInfo?: TenantContactInfo | null
  socialLinks?: TenantSocialLink[] | null
  donationConfig?: TenantDonationConfig | null
  footerTagline?: string | null
}

export interface HeroCta {
  label: string
  /** Pre-resolved href. Preferred — callers should resolve page/url before passing. */
  href?: string
  /** Legacy: a relative page path. Either this or url is used to derive href. */
  page?: string | null
  /** Legacy: an external url. */
  url?: string | null
  linkType?: 'page' | 'url' | null
  icon?: string | null
  primary?: boolean | null
}

export type HeroStyle = 'original' | 'split' | 'live' | 'photo'
export type PhotoTone = 'teal' | 'gold' | 'navy'
export type HeroPhotoPattern = 'arch' | 'geometric' | 'stars' | 'lattice'

/** Variant-specific fields shown only when style === 'split'. */
export interface HeroSplitFields {
  photoLabel?: string | null
  photoTone?: PhotoTone | null
  cardTag?: string | null
  cardTitle?: string | null
  /** Optional Media upload. URL resolved at render time. */
  image?: MediaLike | string | number | null
}

/** Variant-specific fields shown only when style === 'photo'. */
export interface HeroPhotoFields {
  photoLabel?: string | null
  photoTone?: PhotoTone | null
  photoPattern?: HeroPhotoPattern | null
  image?: MediaLike | string | number | null
  ayahArabic?: string | null
  ayahTranslation?: string | null
  ayahCitation?: string | null
}

export interface HeroSlideLike {
  id?: string | number
  eyebrow?: string | null
  title: string
  body?: string | null
  meta?: string | null
  accent: Accent
  /** Layout variant. Defaults to 'original' (single column, current behavior). */
  style?: HeroStyle | null
  splitFields?: HeroSplitFields | null
  photoFields?: HeroPhotoFields | null
  ctas?: HeroCta[] | null
  /** Used only for hero-wrapped events. Optional. */
  kind?: 'mission' | 'program' | 'flyer' | 'announcement' | null
}

/** Live data passed in from the server for variants that show real-time info. */
export interface HeroLiveData {
  /** Next iqamah from the tenant's prayer schedule. */
  nextIqamah?: {
    name: string
    /** Display string, e.g. "6:00 pm". */
    atTime: string
    /** Seconds until iqamah. Used for the countdown. */
    secondsUntil: number
  } | null
  /** Up to N upcoming events for the "Live" widget. */
  upcomingEvents?: Array<{
    id: string | number
    title: string
    when: string
    href: string
  }> | null
}

export interface ServiceLike {
  id?: string | number
  title: string
  description?: string | null
  /** Lucide icon name in kebab-case, e.g. "hand-heart". */
  icon: string
  sortOrder?: number | null
}

export interface EventLike {
  id?: string | number
  title: string
  slug?: string | null
  shortDescription?: string | null
  tag?: string | null
  when?: string | null
  startDate?: string | null
  endDate?: string | null
  location?: string | null
  address?: string | null
  displayMode: 'image' | 'template' | 'text'
  flyerImage?: MediaLike | string | number | null
  templateVariant?: 'default' | 'navy' | 'gold' | null
  status?: 'draft' | 'published' | null
}

export interface PrayerTimePair {
  adhan?: string | null
  iqamah?: string | null
}

export interface PrayerScheduleLike {
  id?: string | number
  name?: string | null
  startDate?: string | null
  fajr?: PrayerTimePair | null
  zuhr?: PrayerTimePair | null
  asr?: PrayerTimePair | null
  maghrib?: PrayerTimePair | null
  isha?: PrayerTimePair | null
  jummahTimes?: Array<{ time?: string | null } | string> | null
  notes?: string | null
}

/** Resolve a media-like field (upload) to a URL string. */
export function mediaUrl(m: unknown): string | null {
  if (!m) return null
  if (typeof m === 'string') return null // unpopulated relationship id
  if (typeof m === 'number') return null
  if (typeof m === 'object') {
    const rec = m as { url?: string | null }
    return rec.url ?? null
  }
  return null
}

/** Resolve a media-like field to an alt string, best-effort. */
export function mediaAlt(m: unknown, fallback = ''): string {
  if (!m) return fallback
  if (typeof m !== 'object') return fallback
  const rec = m as { alt?: string | null }
  return rec.alt ?? fallback
}
