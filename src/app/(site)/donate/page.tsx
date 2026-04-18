import Link from 'next/link'
import { Heart } from 'lucide-react'

import type { TenantDonationConfig } from '@/components/types'
import { getCurrentTenant } from '@/lib/tenant-server'

export const metadata = {
  title: 'Donate',
}

const HADITH =
  'The believer\u2019s shade on the Day of Resurrection will be their charity.'
const CITATION = '\u2014 Prophet Muhammad (peace be upon him)'

function isExternal(href: string): boolean {
  return /^https?:\/\//i.test(href)
}

export default async function DonatePage() {
  const tenant = await getCurrentTenant()
  if (!tenant) return null

  const config = (tenant.donationConfig ?? {}) as TenantDonationConfig
  const mode = config.mode ?? 'external'
  const externalUrl = config.externalUrl ?? null
  const useExternal = mode === 'external' && !!externalUrl && isExternal(externalUrl)

  return (
    <>
      <section className="py-20">
        <div className="mx-auto max-w-[820px] px-6 text-center">
          <div className="mb-5 font-body text-fs-xs font-semibold uppercase tracking-caps text-brand">
            Build with us
          </div>
          <h1 className="mb-4 font-display text-[56px] font-medium leading-[1.06] tracking-tight text-fg1">
            Support {tenant.name ?? 'our masjid'}
          </h1>
          <p className="m-0 mb-10 text-[18px] leading-relaxed text-fg2">
            Your generosity sustains daily prayers, weekly halaqas, youth
            programs, and the space itself. Every contribution, small or large,
            helps keep the doors open.
          </p>

          {mode === 'stripe' ? (
            <div className="mx-auto max-w-[480px] rounded-[var(--r-md)] border border-border bg-white p-8 shadow-sh-sm">
              <div className="mb-6 font-body text-fs-xs font-semibold uppercase tracking-caps text-fg3">
                Choose an amount
              </div>
              <div className="mb-4 grid grid-cols-3 gap-2">
                {['$25', '$50', '$100'].map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    disabled
                    className="rounded-[var(--r-md)] border border-border bg-bg-alt px-4 py-3 font-body text-fs-base font-semibold text-fg3"
                  >
                    {amount}
                  </button>
                ))}
              </div>
              <button
                type="button"
                disabled
                className="w-full rounded-[var(--r-md)] bg-brand/60 px-6 py-[14px] font-body text-fs-base font-semibold text-white"
              >
                Give now
              </button>
              <p className="mt-4 text-fs-xs text-fg3">
                Stripe checkout coming soon.
              </p>
            </div>
          ) : useExternal ? (
            <a
              href={externalUrl as string}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-[var(--r-md)] bg-brand px-8 py-[16px] font-body text-[17px] font-semibold text-white shadow-sh-sm transition-all duration-base ease-out hover:-translate-y-px hover:bg-brand-hover hover:shadow-sh-md"
            >
              <Heart size={18} strokeWidth={1.75} />
              Donate now
            </a>
          ) : (
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-[var(--r-md)] border border-border bg-white px-8 py-[16px] font-body text-fs-base font-semibold text-fg2 hover:border-border-teal"
            >
              Donation setup pending
            </Link>
          )}
        </div>
      </section>

      <section className="bg-secondary-soft py-20">
        <div className="mx-auto max-w-[760px] px-6 text-center">
          <blockquote className="m-0">
            <p className="type-quote m-0 mb-4">&ldquo;{HADITH}&rdquo;</p>
            <cite className="not-italic font-body text-fs-sm text-fg3">
              {CITATION}
            </cite>
          </blockquote>
        </div>
      </section>
    </>
  )
}
