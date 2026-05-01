import Link from 'next/link'

import { getCurrentTenant } from '@/lib/tenant-server'

export const metadata = {
  title: 'Thank you',
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function DonateThanksPage() {
  const tenant = await getCurrentTenant()
  const tenantName = tenant?.name ?? 'our masjid'

  return (
    <section className="py-20">
      <div className="mx-auto max-w-[760px] px-6 text-center">
        <div className="mb-5 font-body text-fs-xs font-semibold uppercase tracking-caps text-brand">
          Jazak Allahu khairan
        </div>
        <h1 className="mb-4 font-display text-[56px] font-medium leading-[1.06] tracking-tight text-fg1">
          Thank you for your gift
        </h1>
        <p className="m-0 mb-10 font-body text-fs-lg leading-relaxed text-fg2">
          Your contribution to {tenantName} has been received. A receipt is on its way to your
          email. May Allah accept it and multiply its reward, in this life and the next.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-[var(--r-md)] border border-border bg-white px-8 py-[16px] font-body text-fs-base font-semibold text-fg2 shadow-sh-sm transition-all duration-base ease-out hover:-translate-y-px hover:border-border-teal hover:shadow-sh-md"
        >
          Back to home
        </Link>
      </div>
    </section>
  )
}
