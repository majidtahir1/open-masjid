import Link from 'next/link'
import { Heart } from 'lucide-react'

import type { TenantDonationConfig } from './types'

export interface DonateCTAProps {
  donationConfig?: TenantDonationConfig | null
  /** Hadith or quote shown in the pull quote. Has a sensible default. */
  hadith?: string
  /** Citation line shown below the hadith. */
  citation?: string
  /** Section eyebrow. */
  eyebrow?: string
}

const DEFAULT_HADITH =
  'The most beloved deeds to Allah are those done consistently, even if small.'
const DEFAULT_CITATION = '— Prophet Muhammad (peace be upon him)'

function isExternal(href: string): boolean {
  return /^https?:\/\//i.test(href)
}

export default function DonateCTA({
  donationConfig,
  hadith = DEFAULT_HADITH,
  citation = DEFAULT_CITATION,
  eyebrow = 'Build with us',
}: DonateCTAProps) {
  const mode = donationConfig?.mode ?? 'external'
  const externalUrl = donationConfig?.externalUrl ?? null

  const useExternal = mode === 'external' && !!externalUrl && isExternal(externalUrl)
  const href = useExternal ? (externalUrl as string) : '/donate'

  const buttonClasses = [
    'inline-flex items-center gap-2 rounded-[var(--r-md)]',
    'bg-brand px-7 py-[14px] font-body text-fs-base font-semibold text-white',
    'shadow-sh-sm transition-all duration-base ease-out',
    'hover:-translate-y-px hover:bg-brand-hover hover:shadow-sh-md',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2',
  ].join(' ')

  const button = (
    <>
      <Heart size={18} strokeWidth={1.75} aria-hidden="true" />
      <span>Donate now</span>
    </>
  )

  return (
    <section className="bg-secondary-soft py-20">
      <div className="mx-auto max-w-page px-6">
        <div className="mx-auto max-w-[760px] text-center">
          <div className="mb-5 font-body text-fs-xs font-semibold uppercase tracking-caps text-brand">
            {eyebrow}
          </div>
          <blockquote className="m-0">
            <p className="type-quote m-0 mb-4">
              &ldquo;{hadith}&rdquo;
            </p>
            {citation && (
              <cite className="not-italic font-body text-fs-sm text-fg3">
                {citation}
              </cite>
            )}
          </blockquote>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            {useExternal ? (
              <a
                href={href}
                className={buttonClasses}
                target="_blank"
                rel="noopener noreferrer"
              >
                {button}
              </a>
            ) : (
              <Link href={href} className={buttonClasses}>
                {button}
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
