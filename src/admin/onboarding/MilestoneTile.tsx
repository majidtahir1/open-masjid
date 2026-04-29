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

  const badge =
    status === 'complete' ? (
      <span
        aria-hidden
        className="grid size-7 shrink-0 place-items-center rounded-full bg-[var(--brand,#0F1E4A)] text-white"
      >
        <Check className="size-3.5" />
      </span>
    ) : status === 'dismissed' ? (
      <span
        aria-hidden
        className="grid size-7 shrink-0 place-items-center rounded-full border border-border bg-muted text-muted-foreground"
      >
        <span className="block h-px w-2.5 bg-current" />
      </span>
    ) : (
      <span
        aria-hidden
        className="grid size-7 shrink-0 place-items-center rounded-full border border-border bg-white text-[11px] font-semibold tracking-wider text-muted-foreground"
      >
        {num}
      </span>
    )

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex h-full w-full flex-col gap-4 bg-white p-8 text-left transition-colors hover:bg-muted/40"
    >
      <div className="flex items-center gap-4">
        {badge}
        <h3
          className="font-display text-2xl font-medium text-foreground leading-tight"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {meta.title}
        </h3>
      </div>
      <p className="text-base leading-relaxed text-muted-foreground">
        {meta.desc}
      </p>
      <span className="mt-auto inline-flex items-center gap-2 text-base font-semibold text-foreground">
        {actionLabel} <span aria-hidden>→</span>
      </span>
    </button>
  )
}
