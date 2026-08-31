import Image from 'next/image'
import Link from 'next/link'
import type { ReactElement, SVGProps } from 'react'

import type { TenantContactInfo, TenantSocialLink } from './types'

export interface FooterTenant {
  name: string
  contactInfo?: TenantContactInfo | null
  socialLinks?: TenantSocialLink[] | null
  footerTagline?: string | null
  /** Optional legal / disclaimer note rendered in the bottom bar. */
  footerLegalNote?: string | null
  /** Optional tenant logo URL. When omitted, the footer renders no logo. */
  logoUrl?: string | null
  /** True when the logo is a wide lockup that already contains the org name. */
  logoIsWordmark?: boolean | null
}

export interface FooterProps {
  tenant: FooterTenant
  /**
   * Whether the tenant has an active prayer schedule. Mirrors the header:
   * without one, the Prayer Times quick link would lead to an empty page.
   */
  hasPrayerSchedule?: boolean
}

/**
 * Inline brand glyphs. Lucide removed brand icons, so we ship simple SVG
 * marks here — tiny, monochrome, drawn from the brands' own design guidelines
 * to keep them recognisable at 18px.
 */
type BrandIconComponent = (props: SVGProps<SVGSVGElement>) => ReactElement

const FacebookIcon: BrandIconComponent = (props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
    <path d="M13.5 21v-7.5h2.5l.4-3h-2.9V8.6c0-.9.3-1.5 1.6-1.5H16.5V4.4c-.3 0-1.3-.1-2.4-.1-2.4 0-4 1.4-4 4.1v2.1H7.5v3h2.6V21h3.4z" />
  </svg>
)

const InstagramIcon: BrandIconComponent = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.5" cy="6.5" r="0.9" fill="currentColor" stroke="none" />
  </svg>
)

const YoutubeIcon: BrandIconComponent = (props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
    <path d="M21.6 7.2c-.2-.9-.9-1.6-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4c-.9.2-1.6.9-1.8 1.8C2 8.8 2 12 2 12s0 3.2.4 4.8c.2.9.9 1.6 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4c.9-.2 1.6-.9 1.8-1.8.4-1.6.4-4.8.4-4.8s0-3.2-.4-4.8zM10 15V9l5 3-5 3z" />
  </svg>
)

const TwitterIcon: BrandIconComponent = (props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
    <path d="M18.244 3h3.308l-7.227 8.26L22.5 21h-6.67l-5.214-6.814L4.62 21H1.31l7.73-8.838L1.5 3h6.83l4.71 6.228L18.245 3zm-1.161 16.03h1.833L7.02 4.86H5.054l12.03 14.17z" />
  </svg>
)

const LinkedinIcon: BrandIconComponent = (props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
    <path d="M4.98 3.5C4.98 4.88 3.87 6 2.5 6S0 4.88 0 3.5 1.12 1 2.5 1 4.98 2.12 4.98 3.5zM.22 8h4.56v14H.22V8zm7.62 0h4.37v1.92h.06c.61-1.15 2.1-2.36 4.32-2.36 4.62 0 5.48 3.04 5.48 7v7.44h-4.56v-6.6c0-1.57-.03-3.6-2.2-3.6-2.2 0-2.54 1.72-2.54 3.48V22H7.84V8z" />
  </svg>
)

/** Simple send glyph for the Zelle row — matches the stroke style above. */
const ZelleSendIcon: BrandIconComponent = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <path d="M21 3 10.5 13.5" />
    <path d="M21 3l-6.8 18a.4.4 0 0 1-.75.02L10.5 13.5 2.98 10.55a.4.4 0 0 1 .02-.75L21 3z" />
  </svg>
)

const SOCIAL_ICONS: Record<TenantSocialLink['platform'], BrandIconComponent> = {
  facebook: FacebookIcon,
  instagram: InstagramIcon,
  youtube: YoutubeIcon,
  twitter: TwitterIcon,
  linkedin: LinkedinIcon,
}

const SOCIAL_LABELS: Record<TenantSocialLink['platform'], string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  youtube: 'YouTube',
  twitter: 'Twitter / X',
  linkedin: 'LinkedIn',
}

const QUICK_LINKS: Array<{ href: string; label: string }> = [
  { href: '/', label: 'Home' },
  { href: '/prayer-times', label: 'Prayer Times' },
  { href: '/events', label: 'Events' },
  { href: '/about', label: 'About' },
  { href: '/donate', label: 'Donate' },
]

function ContactLines({ contact }: { contact: TenantContactInfo | null | undefined }) {
  if (!contact) return null
  const { phone, email, address, zelle } = contact
  if (!phone && !email && !address && !zelle) return null
  return (
    <div className="space-y-2 text-fs-sm leading-relaxed text-white/75">
      {address && (
        <p className="m-0 whitespace-pre-line">{address}</p>
      )}
      {phone && (
        <p className="m-0">
          <a
            href={`tel:${phone.replace(/\s+/g, '')}`}
            className="text-white/85 transition-colors duration-fast hover:text-[var(--secondary-on-dark)]"
          >
            {phone}
          </a>
        </p>
      )}
      {email && (
        <p className="m-0">
          <a
            href={`mailto:${email}`}
            className="text-white/85 transition-colors duration-fast hover:text-[var(--secondary-on-dark)]"
          >
            {email}
          </a>
        </p>
      )}
      {zelle && (
        <p className="m-0 inline-flex items-center gap-2 text-white/85">
          <ZelleSendIcon width={14} height={14} className="shrink-0 text-[var(--secondary-on-dark)]" />
          <span>Zelle: {zelle}</span>
        </p>
      )}
    </div>
  )
}

export default function Footer({ tenant, hasPrayerSchedule = true }: FooterProps) {
  const quickLinks = QUICK_LINKS.filter(
    (link) => hasPrayerSchedule || link.href !== '/prayer-times',
  )
  const year = new Date().getFullYear()
  const tagline =
    tenant.footerTagline ?? 'A community built on knowledge, tarbiya, and prayer.'
  const socials = (tenant.socialLinks ?? []).filter(
    (s): s is TenantSocialLink => !!s && !!s.platform && !!s.url,
  )
  const legalNote =
    typeof tenant.footerLegalNote === 'string' ? tenant.footerLegalNote.trim() : ''

  return (
    <footer className="border-t border-brand/30 bg-brand-ink text-fg-inverse">
      <div className="mx-auto max-w-page px-6 py-16">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-4">
          {/* Tagline + identity */}
          <div>
            <div className="mb-4 flex items-center gap-3">
              {tenant.logoUrl && (
                // Light tile keeps dark-toned (or transparent) logos legible
                // on the dark footer background.
                <span className="inline-flex shrink-0 items-center justify-center rounded-lg bg-white/90 p-1.5">
                  <Image
                    src={tenant.logoUrl}
                    alt=""
                    width={220}
                    height={60}
                    className="h-auto max-h-[60px] w-auto max-w-[220px] object-contain"
                    unoptimized={tenant.logoUrl.startsWith('/')}
                  />
                </span>
              )}
              {!(tenant.logoUrl && tenant.logoIsWordmark) && (
                <div className="font-display text-[22px] font-semibold leading-snug text-white">
                  {tenant.name}
                </div>
              )}
            </div>
            <p className="m-0 max-w-[32ch] text-fs-sm leading-relaxed text-white/75">
              {tagline}
            </p>
          </div>

          {/* Contact */}
          <div>
            <div className="mb-4 font-body text-fs-xs font-semibold uppercase tracking-caps text-[var(--secondary-on-dark)]">
              Contact
            </div>
            <ContactLines contact={tenant.contactInfo} />
          </div>

          {/* Quick links */}
          <div>
            <div className="mb-4 font-body text-fs-xs font-semibold uppercase tracking-caps text-[var(--secondary-on-dark)]">
              Explore
            </div>
            <ul className="m-0 list-none space-y-2 p-0 text-fs-sm">
              {quickLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-white/85 transition-colors duration-fast hover:text-[var(--secondary-on-dark)]"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Social */}
          <div>
            <div className="mb-4 font-body text-fs-xs font-semibold uppercase tracking-caps text-[var(--secondary-on-dark)]">
              Follow
            </div>
            {socials.length > 0 ? (
              <ul className="m-0 flex list-none flex-wrap gap-3 p-0">
                {socials.map((s, i) => {
                  const Icon = SOCIAL_ICONS[s.platform]
                  const label = SOCIAL_LABELS[s.platform]
                  if (!Icon) return null
                  return (
                    <li key={`${s.platform}-${i}`}>
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`${tenant.name} on ${label}`}
                        className={[
                          'inline-flex h-10 w-10 items-center justify-center rounded-[var(--r-md)]',
                          'border border-white/15 bg-white/5 text-white/80',
                          'transition-colors duration-base ease-out',
                          'hover:border-[var(--secondary-on-dark)] hover:bg-white/10 hover:text-[var(--secondary-on-dark)]',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--secondary-on-dark)] focus-visible:ring-offset-2 focus-visible:ring-offset-brand-ink',
                        ].join(' ')}
                      >
                        <Icon width={18} height={18} />
                      </a>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="m-0 text-fs-sm text-white/60">Coming soon.</p>
            )}
          </div>
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-white/10 pt-6 text-fs-sm text-white/60 md:flex-row md:items-center">
          <div className="space-y-1">
            <p className="m-0">
              &copy; {year} {tenant.name}. All rights reserved.
            </p>
            {legalNote && (
              <p className="m-0 max-w-[64ch] whitespace-pre-line text-[12px] leading-relaxed text-white/45">
                {legalNote}
              </p>
            )}
          </div>
          <p className="m-0 text-[12px] text-white/45">
            Powered by{' '}
            <a
              href="https://openmasjid.app"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/60 underline underline-offset-2 transition-colors duration-fast hover:text-[var(--secondary-on-dark)]"
            >
              OpenMasjid
            </a>
          </p>
        </div>
      </div>
    </footer>
  )
}
