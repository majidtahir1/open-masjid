'use client'

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
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
  /** Tenant display name for the welcome zone + grid header. */
  tenantName: string
  /** True iff this user has never seen the welcome modal yet. */
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

type ViewMode = 'welcome' | 'grid'

export function OnboardingShell({
  initialStates,
  publicUrl,
  tenantName,
  showWelcome,
  alreadyCelebrated,
}: Props) {
  const [open, setOpen] = useState(showWelcome)
  const [viewMode, setViewMode] = useState<ViewMode>(
    showWelcome ? 'welcome' : 'grid',
  )
  const [states] = useState(initialStates)
  const [activeSlug, setActiveSlug] = useState<MilestoneSlug | null>(null)
  const [showCelebration, setShowCelebration] = useState(
    !alreadyCelebrated && isAllDoneOrDismissed(initialStates),
  )

  // Mark the welcome modal "seen" the first time we open it.
  useEffect(() => {
    if (showWelcome) {
      void postAction({ type: 'seen-welcome' })
    }
  }, [showWelcome])

  const refresh = () => {
    // Easiest path: full page reload of admin index — keeps the RSC source of truth.
    window.location.reload()
  }

  const done = doneCount(states)
  const total = states.length || 6
  const allDone = isAllDoneOrDismissed(states)
  const remaining = Math.max(0, total - done)
  const pct = Math.min(100, Math.round((done / total) * 100))

  // Public URL stripped to "<slug>.openmasjid.app" for editorial display
  const publicHost = publicUrl.replace(/^https?:\/\//, '')

  /* ---------- Dashboard tile (always rendered) ---------- */
  const dashboardTile =
    alreadyCelebrated && allDone ? (
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
    ) : (
      <div className="rounded-xl border border-border bg-white px-5 py-4 flex items-center justify-between gap-6">
        <div className="flex-1 min-w-0">
          <p className="text-base font-semibold text-foreground">
            {allDone ? 'Setup complete' : `Setup checklist · ${done} of ${total} done`}
          </p>
          <div className="mt-2 flex items-center gap-3">
            <div className="h-1 flex-1 max-w-xs rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${pct}%`,
                  background:
                    'linear-gradient(90deg, var(--brand, #0F1E4A), var(--accent, #28A0B4))',
                }}
              />
            </div>
            <span className="text-xs text-muted-foreground tabular-nums">
              {pct}%
            </span>
          </div>
        </div>
        <Button
          onClick={async () => {
            if (allDone) {
              await postAction({ type: 'reset' })
              window.location.reload()
              return
            }
            setViewMode('grid')
            setOpen(true)
          }}
          className="bg-[var(--brand,#0F1E4A)] text-white hover:bg-[var(--brand,#0F1E4A)]/90 shrink-0"
        >
          {allDone ? 'Re-run onboarding' : 'Continue setup'}
        </Button>
      </div>
    )

  /* ---------- Welcome view (dark zone + light zone) ---------- */
  const welcomeView = (
    <div>
      {/* Upper dark navy zone */}
      <div
        className="relative px-8 pt-9 pb-10 md:px-12 md:pt-11 md:pb-12 text-white overflow-hidden"
        style={{
          background:
            'radial-gradient(ellipse at top right, rgba(217,168,78,0.18), transparent 55%), radial-gradient(ellipse at bottom left, rgba(40,160,180,0.18), transparent 60%), var(--icp-navy-900, #0A1330)',
        }}
      >
        {/* decorative star */}
        <span
          aria-hidden
          className="absolute right-8 top-6 text-2xl opacity-60"
          style={{ color: 'var(--om-gold, #D9A84E)' }}
        >
          ✦
        </span>

        {/* Bismillah */}
        <p
          className="text-center text-2xl md:text-3xl mb-6 opacity-90"
          style={{
            fontFamily: 'var(--font-arabic, serif)',
            color: 'var(--icp-teal-300, #7AD0DD)',
          }}
        >
          ﷽
        </p>

        <DialogTitle asChild>
          <h2
            className="text-3xl md:text-4xl text-center text-white"
            style={{
              fontFamily: 'var(--font-display)',
              fontStyle: 'italic',
              fontWeight: 400,
            }}
          >
            Welcome to <span className="text-[var(--om-gold,#D9A84E)]">OpenMasjid.</span>
          </h2>
        </DialogTitle>

        <DialogDescription asChild>
          <p className="mt-4 text-center text-sm md:text-base text-white/75 max-w-md mx-auto leading-relaxed">
            <span className="text-white/95">{tenantName}</span> is already live at{' '}
            <span className="font-mono text-[var(--icp-teal-300,#7AD0DD)]">
              {publicHost}
            </span>
            . A few quiet steps will make it feel like yours.
          </p>
        </DialogDescription>
      </div>

      {/* Lower white zone */}
      <div className="px-8 py-8 md:px-12 md:py-10 bg-white">
        {/* Trust pills */}
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs md:text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden>⏱</span> ~15 minutes
          </span>
          <span className="text-border" aria-hidden>
            ·
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden>✓</span> Skip anything
          </span>
          <span className="text-border" aria-hidden>
            ·
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden>↻</span> Resume any time
          </span>
        </div>

        <div className="mt-7 flex flex-col items-center gap-3">
          <Button
            onClick={() => setViewMode('grid')}
            className="bg-[var(--brand,#0F1E4A)] text-white hover:bg-[var(--brand,#0F1E4A)]/90 px-6"
          >
            <span aria-hidden className="mr-1.5 text-[var(--om-gold,#D9A84E)]">
              ✦
            </span>
            Set up your site
          </Button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Take me to the admin
          </button>
        </div>
      </div>
    </div>
  )

  /* ---------- Grid view (editorial tiles) ---------- */
  const hasResettable = states.some(
    (s) => s.status === 'complete' || s.status === 'dismissed',
  )

  const gridView = (
    <div className="bg-white">
      {/* Top-right reset affordance (sits next to the dialog close X) */}
      {hasResettable && (
        <button
          type="button"
          onClick={async () => {
            await postAction({ type: 'reset' })
            refresh()
          }}
          className="absolute right-12 top-4 z-10 text-xs text-muted-foreground hover:text-foreground"
        >
          Reset checklist
        </button>
      )}

      {/* Header band — soft tinted background */}
      <div className="bg-muted/40 px-12 py-10">
        <div className="flex items-start justify-between gap-10">
          <div className="flex-1 min-w-0">
            <DialogTitle asChild>
              <h2
                className="text-3xl md:text-[32px] text-foreground leading-tight"
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
            </DialogTitle>
            <DialogDescription asChild>
              <p className="mt-3 text-sm text-muted-foreground max-w-2xl leading-relaxed">
                Your site at{' '}
                <span className="font-mono text-foreground/80">{publicHost}</span>{' '}
                is already live with platform defaults. About 15 minutes of setup
                gets it looking like your masjid. Skip anything you&apos;d rather
                come back to.
              </p>
            </DialogDescription>
          </div>

          {/* Progress block — bar above fraction */}
          <div className="shrink-0 w-[200px]">
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
              <span className="text-6xl">{done}</span>
              <span className="text-3xl text-muted-foreground/70">/{total}</span>
            </p>
            <p className="mt-2 text-right text-[11px] uppercase tracking-wider text-muted-foreground">
              {remaining === 0 ? 'all done' : `${remaining} to go`}
            </p>
          </div>
        </div>
      </div>

      {/* Tile grid — single bordered container with hairline dividers */}
      <div className="px-12 pt-8 pb-2 bg-white">
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
      <div className="px-12 py-6 flex flex-wrap items-center justify-between gap-3 text-sm bg-white">
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
          onClick={() => setOpen(false)}
          className="text-muted-foreground hover:text-foreground"
        >
          Hide for now
        </button>
      </div>
    </div>
  )

  return (
    <>
      {dashboardTile}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-6xl p-0 overflow-hidden gap-0 max-h-[92vh] overflow-y-auto">
          {showCelebration ? (
            <CelebrationScreen
              publicUrl={publicUrl}
              onDismiss={async () => {
                await postAction({ type: 'celebrate-dismissed' })
                setShowCelebration(false)
                setOpen(false)
              }}
            />
          ) : activeSlug ? (
            <div className="p-6 md:p-8">
              <MilestonePanel
                slug={activeSlug}
                status={
                  states.find((s) => s.slug === activeSlug)?.status ?? null
                }
                onBack={() => setActiveSlug(null)}
                onChanged={refresh}
              />
            </div>
          ) : viewMode === 'welcome' ? (
            welcomeView
          ) : (
            gridView
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
