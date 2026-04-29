'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  type MilestoneSlug,
  type MilestoneState,
  isAllDoneOrDismissed,
  doneCount,
} from '@/lib/onboarding'
import { MilestoneTile } from './MilestoneTile'
import { MilestonePanel } from './MilestonePanel'
import { CelebrationScreen } from './CelebrationScreen'

type Props = {
  initialStates: MilestoneState[]
  publicUrl: string
  /** Tenant display name for the card header. */
  tenantName: string
  /** True iff this user has never seen the welcome modal yet — used only to fire seen-welcome API call. */
  showWelcome: boolean
  /** True iff onboardingCompletedAt is set on the tenant — celebratory was already dismissed. */
  alreadyCelebrated: boolean
}

async function postAction(action: object): Promise<void> {
  await fetch('/admin/api/onboarding', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(action),
  })
}

export function OnboardingShell({
  initialStates,
  publicUrl,
  tenantName,
  showWelcome,
  alreadyCelebrated,
}: Props) {
  const [states] = useState(initialStates)
  const [activeSlug, setActiveSlug] = useState<MilestoneSlug | null>(null)
  const [showCelebration, setShowCelebration] = useState(
    !alreadyCelebrated && isAllDoneOrDismissed(initialStates),
  )
  // When true the full card collapses to a thin strip ("Hide for now")
  const [hidden, setHidden] = useState(false)

  // Fire seen-welcome API call once on first render if needed — no modal is shown.
  useEffect(() => {
    if (showWelcome) {
      void postAction({ type: 'seen-welcome' })
    }
  }, [showWelcome])

  const refresh = () => {
    window.location.reload()
  }

  const done = doneCount(states)
  const total = states.length || 6
  const allDone = isAllDoneOrDismissed(states)
  const remaining = Math.max(0, total - done)
  const pct = Math.min(100, Math.round((done / total) * 100))

  // Public URL stripped to "<slug>.openmasjid.app" for editorial display
  const publicHost = publicUrl.replace(/^https?:\/\//, '')

  /* ---------- Fully complete + celebrated: small ghost strip ---------- */
  if (alreadyCelebrated && allDone) {
    return (
      <button
        type="button"
        onClick={async () => {
          await postAction({ type: 'reset' })
          window.location.reload()
        }}
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        Setup complete · review →
      </button>
    )
  }

  /* ---------- Celebration screen ---------- */
  if (showCelebration) {
    return (
      <div className="rounded-2xl border border-border overflow-hidden">
        <CelebrationScreen
          publicUrl={publicUrl}
          onDismiss={async () => {
            await postAction({ type: 'celebrate-dismissed' })
            setShowCelebration(false)
          }}
        />
      </div>
    )
  }

  /* ---------- Collapsed strip (user clicked "Hide for now") ---------- */
  if (hidden) {
    return (
      <div className="rounded-xl border border-border bg-white px-5 py-3 flex items-center justify-between gap-4 text-sm">
        <span className="text-muted-foreground">
          Continue setup · {done} of {total} done →
        </span>
        <button
          type="button"
          onClick={() => setHidden(false)}
          className="font-medium text-foreground hover:text-[var(--accent,#28A0B4)]"
        >
          Show checklist
        </button>
      </div>
    )
  }

  const hasResettable = states.some(
    (s) => s.status === 'complete' || s.status === 'dismissed',
  )

  /* ---------- Active milestone panel (inline replacement) ---------- */
  if (activeSlug) {
    return (
      <div className="rounded-2xl border border-border bg-white overflow-hidden">
        <div className="p-6 md:p-8">
          <MilestonePanel
            slug={activeSlug}
            status={states.find((s) => s.slug === activeSlug)?.status ?? null}
            onBack={() => setActiveSlug(null)}
            onChanged={refresh}
          />
        </div>
      </div>
    )
  }

  /* ---------- Full editorial grid card ---------- */
  return (
    <div className="rounded-2xl border border-border bg-white overflow-hidden relative">
      {/* Reset checklist affordance — top-right of the card */}
      {hasResettable && (
        <button
          type="button"
          onClick={async () => {
            await postAction({ type: 'reset' })
            refresh()
          }}
          className="absolute right-5 top-4 z-10 text-xs text-muted-foreground hover:text-foreground"
        >
          Reset checklist
        </button>
      )}

      {/* Header band — soft tinted background */}
      <div className="bg-muted/40 px-8 py-8 md:px-12 md:py-10">
        <div className="flex items-start justify-between gap-10">
          <div className="flex-1 min-w-0">
            <h2
              className="text-2xl md:text-[32px] text-foreground leading-tight"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Welcome — let&apos;s make{' '}
              <em
                className="text-[var(--brand,#0F1E4A)]"
                style={{ fontStyle: 'italic' }}
              >
                {tenantName}
              </em>{' '}
              feel like yours.
            </h2>
            <p className="mt-3 text-sm text-muted-foreground max-w-2xl leading-relaxed">
              Your site at{' '}
              <span className="font-mono text-foreground/80">{publicHost}</span>{' '}
              is already live with platform defaults. About 15 minutes of setup
              gets it looking like your masjid. Skip anything you&apos;d rather
              come back to.
            </p>
          </div>

          {/* Progress block — bar above fraction */}
          <div className="shrink-0 w-[160px] md:w-[200px]">
            <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${pct}%`,
                  background:
                    'linear-gradient(90deg, var(--brand, #0F1E4A), var(--accent, #28A0B4))',
                }}
              />
            </div>
            <p
              className="mt-3 text-right leading-none text-foreground tabular-nums"
              style={{
                fontFamily: 'var(--font-display)',
                fontStyle: 'italic',
                fontWeight: 400,
              }}
            >
              <span className="text-5xl md:text-6xl">{done}</span>
              <span className="text-2xl md:text-3xl text-muted-foreground/70">
                /{total}
              </span>
            </p>
            <p className="mt-2 text-right text-[11px] uppercase tracking-wider text-muted-foreground">
              {remaining === 0 ? 'all done' : `${remaining} to go`}
            </p>
          </div>
        </div>
      </div>

      {/* Tile grid */}
      <div className="px-8 pt-8 pb-2 md:px-12 bg-white">
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 overflow-hidden rounded-2xl border border-border divide-x divide-y divide-border">
          {states.map((s, i) => (
            <li key={s.slug} className="flex">
              <MilestoneTile
                slug={s.slug}
                status={s.status}
                index={i + 1}
                onOpen={() => setActiveSlug(s.slug)}
              />
            </li>
          ))}
        </ul>
      </div>

      {/* Footer row */}
      <div className="px-8 py-6 md:px-12 flex flex-wrap items-center justify-between gap-3 text-sm bg-white">
        <span className="text-muted-foreground">
          Need a hand?{' '}
          <a
            href="https://cal.com/openmasjid/15min"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-foreground hover:text-[var(--accent,#28A0B4)] underline-offset-4 hover:underline"
          >
            Schedule a 15-min call →
          </a>
        </span>
        <button
          type="button"
          onClick={() => setHidden(true)}
          className="text-muted-foreground hover:text-foreground"
        >
          Hide for now
        </button>
      </div>
    </div>
  )
}
