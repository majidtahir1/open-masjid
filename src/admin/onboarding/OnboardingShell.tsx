'use client'

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
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

export function OnboardingShell({
  initialStates,
  publicUrl,
  showWelcome,
  alreadyCelebrated,
}: Props) {
  const [open, setOpen] = useState(showWelcome)
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
  const allDone = isAllDoneOrDismissed(states)

  return (
    <>
      {/* Re-open trigger — the dashboard tile renders this when modal closed */}
      <div className="rounded-xl border border-border bg-white p-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-base font-semibold text-foreground">
            {showCelebration || allDone
              ? 'Setup complete'
              : `Setup checklist · ${done} of 6 done`}
          </p>
          <p className="text-sm text-muted-foreground">
            {showCelebration || allDone
              ? 'Re-run the wizard any time to revisit the steps.'
              : 'Pick up where you left off.'}
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={async () => {
            if (allDone) {
              await postAction({ type: 'reset' })
              // Reload so the dashboard re-reads onboarding state with dismissed cleared.
              window.location.reload()
              return
            }
            setOpen(true)
          }}
        >
          {allDone ? 'Re-run onboarding' : 'Continue setup'}
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
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
            <MilestonePanel
              slug={activeSlug}
              status={states.find((s) => s.slug === activeSlug)?.status ?? null}
              onBack={() => setActiveSlug(null)}
              onChanged={refresh}
            />
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl">Welcome to OpenMasjid.</DialogTitle>
                <DialogDescription className="text-base">
                  Your site is already live with our defaults. Let&apos;s make it look like your masjid.
                </DialogDescription>
              </DialogHeader>
              <ul className="grid gap-3 mt-4">
                {states.map((s) => (
                  <li key={s.slug}>
                    <MilestoneTile
                      slug={s.slug}
                      status={s.status}
                      onOpen={() => setActiveSlug(s.slug)}
                    />
                  </li>
                ))}
              </ul>
              <div className="flex justify-between items-center pt-4 mt-2 border-t border-border">
                <button
                  type="button"
                  onClick={async () => {
                    await postAction({ type: 'reset' })
                    refresh()
                  }}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  Reset checklist
                </button>
                <Button variant="ghost" onClick={() => setOpen(false)}>
                  Take me to the admin
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
