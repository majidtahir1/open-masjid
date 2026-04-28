'use client'

import { useState } from 'react'
import type { MilestoneSlug, MilestoneStatus } from '@/lib/onboarding'
import { HINTS } from '@/lib/onboardingHints'
import { HintRail } from './HintRail'
import { Button } from '@/components/ui/button'
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

export function MilestonePanel({
  slug,
  status,
  onBack,
  onChanged,
}: {
  slug: MilestoneSlug
  status: MilestoneStatus
  onBack: () => void
  onChanged: () => void
}) {
  const meta = PANELS[slug]
  const [busy, setBusy] = useState(false)

  const act = async (action: object) => {
    setBusy(true)
    try {
      await postAction(action)
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-8 md:grid-cols-[1fr_280px]">
      <div className="space-y-6">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden /> Back to checklist
        </button>
        <div>
          <h2 className="text-2xl font-semibold text-foreground">{meta.title}</h2>
          <p className="mt-2 text-base text-muted-foreground leading-relaxed">{meta.intro}</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <a href={meta.primaryHref} target="_blank" rel="noopener noreferrer">
              {meta.primaryLabel}
              <ExternalLink className="size-4" aria-hidden />
            </a>
          </Button>
          {status !== 'complete' && (
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => act({ type: 'mark-complete', slug })}
            >
              Mark complete
            </Button>
          )}
          {status !== 'dismissed' && status !== 'complete' && (
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => act({ type: 'skip', slug })}
            >
              Skip for now
            </Button>
          )}
        </div>
      </div>

      <HintRail hints={HINTS[slug]} />
    </div>
  )
}
