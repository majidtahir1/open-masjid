'use client'

import type { MilestoneSlug, MilestoneStatus } from '@/lib/onboarding'
import { Check } from 'lucide-react'
import { useState } from 'react'

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
  const actionLabel = status === 'complete' ? 'Review' : meta.action

  const [hover, setHover] = useState(false)

  const badge =
    status === 'complete' ? (
      <span
        aria-hidden
        className="grid place-items-center shrink-0"
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          background: 'var(--brand)',
          color: '#fff',
        }}
      >
        <Check size={16} strokeWidth={2} />
      </span>
    ) : (
      <span
        aria-hidden
        className="grid place-items-center shrink-0 tabular-nums"
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          border: '1px solid var(--border)',
          background: 'var(--bg)',
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--fs-xs)',
          fontWeight: 600,
          letterSpacing: '0.05em',
          color: 'var(--fg3)',
        }}
      >
        {num}
      </span>
    )

  return (
    <button
      type="button"
      onClick={onOpen}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      className="group flex h-full w-full flex-col text-left"
      style={{
        background: hover ? 'var(--bg-alt)' : 'var(--bg)',
        padding: 'var(--sp-8)',
        gap: 'var(--sp-4)',
        transition: 'background var(--dur-base) var(--ease-out)',
        fontFamily: 'var(--font-body)',
        border: 'none',
        outline: 'none',
        cursor: 'pointer',
      }}
    >
      <div className="flex items-center" style={{ gap: 'var(--sp-4)' }}>
        {badge}
        <h3
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 500,
            fontSize: 'var(--fs-lg)',
            lineHeight: 1.25,
            color: 'var(--fg1)',
            margin: 0,
          }}
        >
          {meta.title}
        </h3>
      </div>
      <p
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--fs-sm)',
          lineHeight: 1.55,
          color: 'var(--fg2)',
          margin: 0,
        }}
      >
        {meta.desc}
      </p>
      <span
        className="mt-auto inline-flex items-center"
        style={{
          gap: hover ? 'var(--sp-3)' : 'var(--sp-2)',
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--fs-sm)',
          fontWeight: 600,
          color: hover ? 'var(--brand-hover)' : 'var(--brand)',
          transition:
            'gap var(--dur-base) var(--ease-out), color var(--dur-base) var(--ease-out)',
        }}
      >
        {actionLabel} <span aria-hidden>→</span>
      </span>
    </button>
  )
}
