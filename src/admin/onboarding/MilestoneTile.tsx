'use client'

import type { MilestoneSlug, MilestoneStatus } from '@/lib/onboarding'
import { Check, ChevronRight, MinusCircle } from 'lucide-react'

const TITLES: Record<MilestoneSlug, { title: string; subtitle: string }> = {
  branding: { title: 'Branding', subtitle: 'Logo, colors, and font' },
  identity: { title: 'Identity & Contact', subtitle: 'Name, address, socials' },
  prayer: { title: 'Prayer Times', subtitle: 'Schedule and method' },
  firstEvent: { title: 'Your first event', subtitle: 'Sample Jummah ready to edit' },
  hero: { title: 'Hero & homepage', subtitle: 'What visitors see first' },
  donations: { title: 'Donations', subtitle: 'Stripe, link out, or hide' },
}

export function MilestoneTile({
  slug,
  status,
  onOpen,
}: {
  slug: MilestoneSlug
  status: MilestoneStatus
  onOpen: () => void
}) {
  const meta = TITLES[slug]
  const cta =
    status === 'complete' ? 'Review' : status === 'dismissed' ? 'Open anyway' : 'Start'
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex w-full items-start gap-4 rounded-xl border border-border bg-white p-5 text-left transition-all hover:border-primary hover:shadow-md"
    >
      <span
        aria-hidden
        className={`grid size-9 shrink-0 place-items-center rounded-full text-white ${
          status === 'complete'
            ? 'bg-green-600'
            : status === 'dismissed'
              ? 'bg-muted text-muted-foreground'
              : 'bg-secondary'
        }`}
      >
        {status === 'complete' ? (
          <Check className="size-5" />
        ) : status === 'dismissed' ? (
          <MinusCircle className="size-5" />
        ) : (
          <span className="text-sm font-bold">·</span>
        )}
      </span>
      <span className="flex-1 space-y-1">
        <span className="block text-base font-semibold text-foreground">{meta.title}</span>
        <span className="block text-sm text-muted-foreground">{meta.subtitle}</span>
      </span>
      <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary group-hover:underline">
        {cta} <ChevronRight className="size-4" aria-hidden />
      </span>
    </button>
  )
}
