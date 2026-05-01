import Link from 'next/link'
import { Heart } from 'lucide-react'
import { getPayload } from 'payload'
import config from '@payload-config'

import type { TenantDonationConfig } from '@/components/types'
import { getCurrentTenant } from '@/lib/tenant-server'
import DonateForm, { type DonateFund } from '@/components/DonateForm'

export const metadata = {
  title: 'Donate',
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

const HADITH =
  'The believer\u2019s shade on the Day of Resurrection will be their charity.'
const CITATION = '\u2014 Prophet Muhammad (peace be upon him)'

function isExternal(href: string): boolean {
  return /^https?:\/\//i.test(href)
}

export default async function DonatePage() {
  const tenant = await getCurrentTenant()
  if (!tenant) return null

  const donationConfig = (tenant.donationConfig ?? {}) as Omit<TenantDonationConfig, 'mode'> & {
    mode?: 'external' | 'connect' | null
    stripeChargesEnabled?: boolean | null
  }
  const mode: 'external' | 'connect' = donationConfig.mode ?? 'external'
  const externalUrl = donationConfig.externalUrl ?? null
  const useExternal = mode === 'external' && !!externalUrl && isExternal(externalUrl)
  const useConnect = mode === 'connect' && !!donationConfig.stripeChargesEnabled

  let funds: DonateFund[] = []
  if (useConnect) {
    try {
      const payload = await getPayload({ config })
      const result = await payload.find({
        collection: 'donation-funds' as never,
        where: {
          tenant: { equals: tenant.id },
          active: { equals: true },
        },
        sort: 'sortOrder',
        limit: 50,
        depth: 0,
      })
      funds = (result.docs as Array<{
        id: string | number
        name: string
        description?: string | null
        zakatEligible?: boolean | null
        suggestedAmounts?: Array<{ amount: number }> | null
      }>).map((d) => ({
        id: d.id,
        name: d.name,
        description: d.description ?? null,
        zakatEligible: !!d.zakatEligible,
        suggestedAmounts: d.suggestedAmounts ?? undefined,
      }))
    } catch {
      funds = []
    }
  }

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

          {useConnect && funds.length > 0 ? (
            <DonateForm funds={funds} />
          ) : useConnect ? (
            <div className="mx-auto max-w-[480px] rounded-[var(--r-md)] border border-border bg-white p-8 shadow-sh-sm">
              <p className="m-0 font-body text-fs-base text-fg2">
                No donation funds are configured yet.
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
