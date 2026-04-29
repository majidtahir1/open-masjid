'use client'

import { useState, type CSSProperties } from 'react'
import type { MilestoneSlug, MilestoneStatus } from '@/lib/onboarding'
import { HINTS } from '@/lib/onboardingHints'
import { HintRail } from './HintRail'
import { ArrowLeft, ExternalLink } from 'lucide-react'

type PanelMeta = {
  title: string
  intro: string
  primaryHref: string
  primaryLabel: string
}

const PANELS: Record<MilestoneSlug, PanelMeta> = {
  branding: {
    title: 'Make it look like your masjid',
    intro:
      'Upload a logo, pick three colors, and choose a display font. The rest of the palette derives automatically.',
    primaryHref: '/admin/collections/tenants',
    primaryLabel: 'Open branding settings',
  },
  identity: {
    title: 'Tell visitors who you are',
    intro:
      'Add your masjid name, address (we geocode it for you), phone, public email, and the socials you actually use.',
    primaryHref: '/admin/collections/tenants',
    primaryLabel: 'Open identity settings',
  },
  prayer: {
    title: 'Add your prayer schedule',
    intro:
      "Pick a calculation method and add at least one schedule. We'll keep it on the homepage strip and the prayer times page.",
    primaryHref: '/admin/collections/prayer-schedules/create',
    primaryLabel: 'Open the schedule editor',
  },
  firstEvent: {
    title: 'Your first event is ready to edit',
    intro:
      "We've prefilled a sample Jummah event. Edit it, save it, or skip and add your own later.",
    primaryHref: '/admin/collections/events/create',
    primaryLabel: 'Open the event editor',
  },
  hero: {
    title: 'Set your homepage hero',
    intro:
      "Featured events become hero slides automatically — or you can upload a photo. Skip if you'd rather use the default.",
    primaryHref: '/admin/collections/hero-slides/create',
    primaryLabel: 'Open the hero editor',
  },
  donations: {
    title: 'Set up donations',
    intro:
      'Native Stripe (with Sadaqah / Zakat / Building Fund tabs), an external link, or hide the donate button entirely. Your call.',
    primaryHref: '/admin/collections/tenants',
    primaryLabel: 'Open donation settings',
  },
}

async function postAction(action: object): Promise<void> {
  await fetch('/admin/api/onboarding', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(action),
  })
}

const baseBtn: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '10px 18px',
  borderRadius: 'var(--r-md)',
  fontFamily: 'var(--font-body)',
  fontSize: 'var(--fs-sm)',
  fontWeight: 600,
  lineHeight: 1,
  cursor: 'pointer',
  border: '1px solid transparent',
  transition:
    'background var(--dur-base) var(--ease-out), color var(--dur-base) var(--ease-out), box-shadow var(--dur-base) var(--ease-out), transform var(--dur-base) var(--ease-out), border-color var(--dur-base) var(--ease-out)',
}

function PrimaryLink({
  href,
  children,
}: {
  href: string
  children: React.ReactNode
}) {
  const [hover, setHover] = useState(false)
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        ...baseBtn,
        background: hover ? 'var(--brand-hover)' : 'var(--brand)',
        color: '#fff',
        boxShadow: hover ? 'var(--sh-md)' : 'none',
        transform: hover ? 'translateY(-1px)' : 'translateY(0)',
      }}
    >
      {children}
    </a>
  )
}

function SecondaryButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  const [hover, setHover] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        ...baseBtn,
        background: hover ? 'var(--brand-soft)' : '#fff',
        color: 'var(--brand)',
        borderColor: 'var(--border-navy)',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {children}
    </button>
  )
}

function GhostButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  const [hover, setHover] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        ...baseBtn,
        background: hover ? 'var(--icp-gray-100)' : 'transparent',
        color: 'var(--fg1)',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {children}
    </button>
  )
}

export function MilestonePanel({
  slug,
  status,
  onBack,
  onChanged,
  onAdvance,
}: {
  slug: MilestoneSlug
  status: MilestoneStatus
  onBack: () => void
  onChanged: () => void
  onAdvance?: () => void
}) {
  const meta = PANELS[slug]
  const [busy, setBusy] = useState(false)

  const act = async (action: { type: string; [key: string]: unknown }) => {
    setBusy(true)
    try {
      await postAction(action)
      if (action.type === 'mark-complete' && onAdvance) {
        onAdvance()
      } else {
        onChanged()
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="grid md:grid-cols-[1fr_280px]"
      style={{ gap: 'var(--sp-8)', fontFamily: 'var(--font-body)' }}
    >
      <div style={{ display: 'grid', gap: 'var(--sp-6)' }}>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center"
          style={{
            gap: 'var(--sp-1)',
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--fs-sm)',
            fontWeight: 600,
            color: 'var(--fg3)',
            background: 'transparent',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            transition: 'color var(--dur-base) var(--ease-out)',
            justifySelf: 'start',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--fg1)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--fg3)')}
        >
          <ArrowLeft size={16} aria-hidden /> Back to checklist
        </button>
        <div>
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 500,
              fontSize: 'clamp(1.5rem, 2.4vw, 2rem)',
              lineHeight: 1.25,
              color: 'var(--fg1)',
              margin: 0,
            }}
          >
            {meta.title}
          </h2>
          <p
            style={{
              marginTop: 'var(--sp-2)',
              fontFamily: 'var(--font-body)',
              fontSize: 'var(--fs-sm)',
              lineHeight: 1.55,
              color: 'var(--fg2)',
            }}
          >
            {meta.intro}
          </p>
        </div>

        <div className="flex flex-wrap" style={{ gap: 'var(--sp-3)' }}>
          <PrimaryLink href={meta.primaryHref}>
            {meta.primaryLabel}
            <ExternalLink size={16} aria-hidden />
          </PrimaryLink>
          {status !== 'complete' && (
            <SecondaryButton
              disabled={busy}
              onClick={() => act({ type: 'mark-complete', slug })}
            >
              Mark complete
            </SecondaryButton>
          )}
          {status !== 'dismissed' && status !== 'complete' && (
            <GhostButton
              disabled={busy}
              onClick={() => act({ type: 'skip', slug })}
            >
              Skip for now
            </GhostButton>
          )}
        </div>
      </div>

      <HintRail hints={HINTS[slug]} />
    </div>
  )
}
