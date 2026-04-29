'use client'

import type { MilestoneSlug, MilestoneStatus } from '@/lib/onboarding'
import { Check } from 'lucide-react'

const COPY: Record<
  MilestoneSlug,
  { title: string; desc: string; action: string }
> = {
  branding: {
    title: 'Branding',
    desc: 'Upload your logo, pick three colors, choose a display font.',
    action: 'Configure branding',
  },
  identity: {
    title: 'Identity & Contact',
    desc: 'Address, phone, email, social links, footer tagline.',
    action: 'Add details',
  },
  prayer: {
    title: 'Prayer Times',
    desc: 'Calculation method and madhab, then add your first schedule.',
    action: 'Configure prayer',
  },
  firstEvent: {
    title: 'Your first event',
    desc: "We've prefilled this Friday's Jummah — edit, save, or skip.",
    action: 'Open the sample',
  },
  hero: {
    title: 'Hero & homepage',
    desc: 'Pick how the homepage hero looks — generated, photo, or default.',
    action: 'Pick a hero',
  },
  donations: {
    title: 'Donations',
    desc: 'Native Stripe, paste an external link, or hide the button.',
    action: 'Set up donations',
  },
}

const DEFAULT_INDEX: Record<MilestoneSlug, number> = {
  branding: 1,
  identity: 2,
  prayer: 3,
  firstEvent: 4,
  hero: 5,
  donations: 6,
}

export function MilestoneTile({
  slug,
  status,
  onOpen,
  index,
}: {
  slug: MilestoneSlug
  status: MilestoneStatus
  onOpen: () => void
  index?: number
}) {
  const meta = COPY[slug]
  const num = (index ?? DEFAULT_INDEX[slug]).toString().padStart(2, '0')
  const actionLabel =
    status === 'complete'
      ? 'Review'
      : status === 'dismissed'
        ? 'Open anyway'
        : meta.action

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative flex h-full w-full flex-col rounded-xl border border-border bg-white p-5 text-left transition-all hover:-translate-y-0.5 hover:border-[var(--accent,#28A0B4)] hover:shadow-md"
    >
      {/* Numbered badge / state circle */}
      <span aria-hidden className="mb-4 inline-flex items-center">
        {status === 'complete' ? (
          <span className="grid size-8 place-items-center rounded-full bg-[var(--brand,#0F1E4A)] text-white">
            <Check className="size-4" />
          </span>
        ) : status === 'dismissed' ? (
          <span className="grid size-8 place-items-center rounded-full border border-border bg-muted text-muted-foreground">
            <span className="block h-px w-3 bg-current" />
          </span>
        ) : (
          <span className="grid size-8 place-items-center rounded-full border border-border bg-white text-xs font-semibold tracking-wider text-muted-foreground">
            {num}
          </span>
        )}
      </span>

      {/* Done pill */}
      {status === 'complete' && (
        <span className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-[var(--brand,#0F1E4A)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
          <Check className="size-3" aria-hidden /> Done
        </span>
      )}

      <h3
        className="text-xl text-foreground"
        style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic' }}
      >
        {meta.title}
      </h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
        {meta.desc}
      </p>

      <span className="mt-auto pt-5">
        <span className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--brand,#0F1E4A)] group-hover:gap-2 transition-all">
          {actionLabel} <span aria-hidden>→</span>
        </span>
      </span>
    </button>
  )
}
