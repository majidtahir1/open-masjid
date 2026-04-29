'use client'

import { useEffect, useState } from 'react'
import { Clock, Check, RotateCcw, Sparkles, ArrowLeft } from 'lucide-react'
import {
  type MilestoneSlug,
  type MilestoneState,
  isAllDoneOrDismissed,
  doneCount,
} from '@/lib/onboarding'
import { MilestoneTile } from './MilestoneTile'
import { MilestonePanel } from './MilestonePanel'
import { CelebrationScreen } from './CelebrationScreen'
import { BrandingStep, type BrandingInitial } from './steps/BrandingStep'
import { Dialog, DialogContent } from '@/components/ui/dialog'

type View = 'welcome' | 'grid' | 'milestone' | 'celebration'

type Props = {
  initialStates: MilestoneState[]
  publicUrl: string
  /** Tenant display name for the card header. */
  tenantName: string
  /** True iff this user has never seen the welcome modal yet — used only to fire seen-welcome API call. */
  showWelcome: boolean
  /** True iff onboardingCompletedAt is set on the tenant — celebratory was already dismissed. */
  alreadyCelebrated: boolean
  /** Current branding values used to seed the rich Branding step. */
  brandingInitial?: BrandingInitial
}

async function postAction(action: object): Promise<void> {
  await fetch('/admin/api/onboarding', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(action),
  })
}

function initialView(allDone: boolean, alreadyCelebrated: boolean): View {
  if (allDone && !alreadyCelebrated) return 'celebration'
  return 'welcome'
}

export function OnboardingShell({
  initialStates,
  publicUrl,
  tenantName,
  showWelcome,
  alreadyCelebrated,
  brandingInitial,
}: Props) {
  const [states] = useState(initialStates)
  const [activeSlug, setActiveSlug] = useState<MilestoneSlug | null>(null)

  const done = doneCount(states)
  const total = states.length || 6
  const allDone = isAllDoneOrDismissed(states)
  const remaining = Math.max(0, total - done)
  const pct = Math.min(100, Math.round((done / total) * 100))

  // Public URL stripped to "<slug>.openmasjid.app" for editorial display
  const publicHost = publicUrl.replace(/^https?:\/\//, '')

  const hasResettable = states.some(
    (s) => s.status === 'complete' || s.status === 'dismissed',
  )

  // Modal open/close state
  const [welcomeOpen, setWelcomeOpen] = useState(showWelcome)

  // Internal view state — always reset to 'welcome' (or 'celebration') when modal opens
  const [view, setView] = useState<View>(() => initialView(allDone, alreadyCelebrated))

  // Fire seen-welcome API call once when the modal first opens.
  useEffect(() => {
    if (showWelcome) {
      void postAction({ type: 'seen-welcome' })
    }
  }, [showWelcome])

  const refresh = () => {
    window.location.reload()
  }

  // When modal opens, reset view to welcome (or celebration if appropriate)
  const openModal = () => {
    setView(initialView(allDone, alreadyCelebrated))
    setActiveSlug(null)
    setWelcomeOpen(true)
  }

  const closeModal = () => {
    setWelcomeOpen(false)
  }

  // Handle dialog's own close (via X button / Escape key)
  const handleOpenChange = (open: boolean) => {
    if (!open) closeModal()
    else setWelcomeOpen(true)
  }

  /* ---------- Dashboard strip ---------- */
  const dashboardStrip = alreadyCelebrated && allDone ? (
    <button
      type="button"
      onClick={openModal}
      style={{
        fontFamily: 'var(--font-body)',
        fontSize: 'var(--fs-sm)',
        color: 'var(--fg3)',
        transition: 'color var(--dur-base) var(--ease-out)',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        padding: 0,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--fg1)')}
      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--fg3)')}
    >
      Setup complete · review →
    </button>
  ) : (
    <div
      className="flex items-center justify-between gap-4"
      style={{
        background: 'var(--bg)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-md)',
        boxShadow: 'var(--sh-xs)',
        padding: 'var(--sp-3) var(--sp-5)',
        fontFamily: 'var(--font-body)',
        fontSize: 'var(--fs-sm)',
      }}
    >
      <span style={{ color: 'var(--fg3)' }}>
        Setup checklist · {done} of {total} done
      </span>
      <button
        type="button"
        onClick={openModal}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          background: 'var(--brand)',
          color: 'white',
          padding: '8px 16px',
          borderRadius: 'var(--r-md)',
          fontFamily: 'var(--font-body)',
          fontWeight: 600,
          fontSize: 'var(--fs-sm)',
          border: 'none',
          cursor: 'pointer',
          transition:
            'background var(--dur-base) var(--ease-out), transform var(--dur-base) var(--ease-out)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--brand-hover)'
          e.currentTarget.style.transform = 'translateY(-1px)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'var(--brand)'
          e.currentTarget.style.transform = 'none'
        }}
      >
        {allDone ? 'Re-run onboarding' : 'Continue setup'}
      </button>
    </div>
  )

  /* ---------- Welcome view (inside modal) ---------- */
  const welcomeView = (
    <div className="flex flex-col overflow-y-auto" style={{ maxHeight: '90vh' }}>
      {/* Top zone — dark navy with radial gradient accents */}
      <div
        style={{
          backgroundImage: [
            'radial-gradient(ellipse 60% 50% at 90% 10%, rgba(20,184,166,0.18) 0%, transparent 70%)',
            'radial-gradient(ellipse 50% 45% at 85% 85%, rgba(234,179,8,0.14) 0%, transparent 70%)',
          ].join(', '),
          backgroundColor: 'var(--icp-navy-900)',
          padding: 'var(--sp-12)',
        }}
      >
        {/* Inner max-width constraint for welcome feel */}
        <div style={{ maxWidth: '36rem' }}>
          {/* Bismillah */}
          <p
            style={{
              fontFamily: 'var(--font-arabic)',
              color: 'var(--icp-teal-300)',
              fontSize: 'clamp(1.75rem, 3vw, 2.25rem)',
              letterSpacing: '0.04em',
              opacity: 0.85,
              margin: '0 0 var(--sp-8) 0',
            }}
          >
            ﷽
          </p>

          {/* Headline */}
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 500,
              fontSize: 'clamp(2rem, 4vw, 2.75rem)',
              color: 'white',
              lineHeight: 1.1,
              marginBottom: 'var(--sp-6)',
              marginTop: 0,
            }}
          >
            Welcome to{' '}
            <em
              style={{
                fontStyle: 'italic',
                color: 'var(--om-gold, var(--icp-gold-500))',
              }}
            >
              OpenMasjid.
            </em>
          </h2>

          {/* Body */}
          <p
            style={{
              color: 'rgba(255,255,255,0.85)',
              fontFamily: 'var(--font-body)',
              fontSize: 16,
              lineHeight: 1.6,
              margin: 0,
            }}
          >
            <span style={{ fontWeight: 600, color: 'white' }}>{tenantName}</span>{' '}
            is already live at{' '}
            <code
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.9em',
                padding: '2px 6px',
                borderRadius: 4,
                background: 'rgba(255,255,255,0.1)',
                color: 'white',
              }}
            >
              {publicHost}
            </code>{' '}
            with our defaults. Take 15 minutes now to make it look like your
            masjid — or jump straight into the admin and come back later.
          </p>
        </div>
      </div>

      {/* Bottom zone — white */}
      <div
        style={{
          background: 'white',
          padding: 'var(--sp-8) var(--sp-12)',
        }}
      >
        <div style={{ maxWidth: '36rem' }}>
          {/* Trust pills */}
          <div
            className="flex flex-wrap items-center"
            style={{ gap: 'var(--sp-8)', marginBottom: 'var(--sp-8)' }}
          >
            <span
              className="flex items-center gap-1.5"
              style={{ color: 'var(--fg2)', fontSize: 14, fontFamily: 'var(--font-body)' }}
            >
              <Clock size={16} strokeWidth={1.75} style={{ color: 'var(--icp-teal-500)', flexShrink: 0 }} />
              ~15 minutes
            </span>
            <span
              className="flex items-center gap-1.5"
              style={{ color: 'var(--fg2)', fontSize: 14, fontFamily: 'var(--font-body)' }}
            >
              <Check size={16} strokeWidth={1.75} style={{ color: 'var(--icp-teal-500)', flexShrink: 0 }} />
              Skip anything
            </span>
            <span
              className="flex items-center gap-1.5"
              style={{ color: 'var(--fg2)', fontSize: 14, fontFamily: 'var(--font-body)' }}
            >
              <RotateCcw size={16} strokeWidth={1.75} style={{ color: 'var(--icp-teal-500)', flexShrink: 0 }} />
              Resume any time
            </span>
          </div>

          {/* CTAs */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Primary — goes to grid view */}
            <button
              type="button"
              onClick={() => setView('grid')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                background: 'var(--brand)',
                color: 'white',
                padding: '12px 22px',
                borderRadius: 'var(--r-md)',
                fontFamily: 'var(--font-body)',
                fontWeight: 600,
                fontSize: 14,
                border: 'none',
                cursor: 'pointer',
                transition:
                  'background var(--dur-base) var(--ease-out), transform var(--dur-base) var(--ease-out), box-shadow var(--dur-base) var(--ease-out)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--brand-hover)'
                e.currentTarget.style.transform = 'translateY(-1px)'
                e.currentTarget.style.boxShadow = 'var(--sh-md)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--brand)'
                e.currentTarget.style.transform = 'none'
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              <Sparkles size={16} strokeWidth={2} />
              Set up your site
            </button>

            {/* Secondary — closes modal */}
            <button
              type="button"
              onClick={closeModal}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                background: 'transparent',
                border: 'none',
                color: 'var(--fg2)',
                fontFamily: 'var(--font-body)',
                fontWeight: 500,
                fontSize: 14,
                padding: '12px 18px',
                cursor: 'pointer',
                transition: 'color var(--dur-base) var(--ease-out)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--fg1)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--fg2)')}
            >
              Take me to the admin
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  /* ---------- Grid view (inside modal) ---------- */
  const gridView = (
    <div className="flex flex-col overflow-hidden" style={{ maxHeight: '90vh' }}>
      {/* Header band */}
      <div
        style={{
          background: 'var(--bg-alt)',
          padding: 'var(--sp-8) var(--sp-10)',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
          position: 'relative',
        }}
      >
        {hasResettable && (
          <button
            type="button"
            onClick={async () => {
              await postAction({ type: 'reset' })
              refresh()
            }}
            className="absolute z-10"
            style={{
              right: 'var(--sp-5)',
              top: 'var(--sp-4)',
              fontFamily: 'var(--font-body)',
              fontSize: 'var(--fs-xs)',
              color: 'var(--fg3)',
              transition: 'color var(--dur-base) var(--ease-out)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--fg1)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--fg3)')}
          >
            Reset checklist
          </button>
        )}

        <div className="flex items-start justify-between gap-10">
          <div className="flex-1 min-w-0">
            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 500,
                fontSize: 'clamp(1.5rem, 2.8vw, 2.25rem)',
                lineHeight: 1.1,
                color: 'var(--fg1)',
                margin: 0,
              }}
            >
              Welcome — let&apos;s make{' '}
              <em style={{ fontStyle: 'italic', color: 'var(--brand)' }}>
                {tenantName}
              </em>{' '}
              feel like yours.
            </h2>
            <p
              className="max-w-xl"
              style={{
                marginTop: 'var(--sp-3)',
                fontFamily: 'var(--font-body)',
                fontSize: 'var(--fs-sm)',
                color: 'var(--fg2)',
                lineHeight: 1.55,
              }}
            >
              Your site at{' '}
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg1)' }}>
                {publicHost}
              </span>{' '}
              is already live with platform defaults. About 15 minutes of setup
              gets it looking like your masjid. Skip anything you&apos;d rather
              come back to.
            </p>
          </div>

          {/* Progress block */}
          <div className="shrink-0 w-[140px] md:w-[180px]">
            <div
              style={{
                height: 4,
                width: '100%',
                borderRadius: 'var(--r-pill)',
                background: 'var(--icp-gray-100)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${pct}%`,
                  borderRadius: 'var(--r-pill)',
                  background: 'linear-gradient(90deg, var(--brand), var(--accent))',
                  transition: 'width var(--dur-base) var(--ease-out)',
                }}
              />
            </div>
            <p
              className="text-right tabular-nums"
              style={{
                marginTop: 'var(--sp-3)',
                lineHeight: 1,
                fontFamily: 'var(--font-display)',
                fontWeight: 500,
                color: 'var(--fg1)',
              }}
            >
              <span style={{ fontSize: 'clamp(2rem, 4vw, 3rem)' }}>{done}</span>
              <span style={{ fontSize: 'var(--fs-xl)', color: 'var(--fg3)', marginLeft: 2 }}>
                /{total}
              </span>
            </p>
            <p
              className="text-right"
              style={{
                marginTop: 'var(--sp-2)',
                fontFamily: 'var(--font-body)',
                fontSize: 'var(--fs-xs)',
                fontWeight: 600,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'var(--fg3)',
              }}
            >
              {remaining === 0 ? 'all done' : `${remaining} to go`}
            </p>
          </div>
        </div>
      </div>

      {/* Tile grid — scrollable */}
      <div className="overflow-y-auto flex-1" style={{ background: 'var(--bg)' }}>
        <ul
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
          style={{ listStyle: 'none', margin: 0, padding: 0 }}
        >
          {states.map((s, i) => (
            <li
              key={s.slug}
              className="flex"
              style={{
                borderTop: i >= 3 ? '1px solid var(--border)' : 'none',
                borderLeft: i % 3 === 0 ? 'none' : '1px solid var(--border)',
              }}
            >
              <MilestoneTile
                slug={s.slug}
                status={s.status}
                index={i + 1}
                onOpen={() => {
                  setActiveSlug(s.slug)
                  setView('milestone')
                }}
              />
            </li>
          ))}
        </ul>

        {/* Footer row */}
        <div
          className="flex flex-wrap items-center justify-between gap-3"
          style={{
            padding: 'var(--sp-6) var(--sp-8)',
            borderTop: '1px solid var(--border)',
            background: 'var(--bg)',
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--fs-sm)',
          }}
        >
          <span style={{ color: 'var(--fg2)' }}>
            Need a hand?{' '}
            <a
              href="https://cal.com/openmasjid/15min"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontWeight: 600,
                color: 'var(--brand)',
                transition: 'color var(--dur-base) var(--ease-out)',
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.color = 'var(--brand-hover)')
              }
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--brand)')}
            >
              Schedule a 15-min call →
            </a>
          </span>
          <button
            type="button"
            onClick={closeModal}
            style={{
              background: 'transparent',
              border: 'none',
              padding: 'var(--sp-2) var(--sp-3)',
              borderRadius: 'var(--r-md)',
              fontFamily: 'var(--font-body)',
              fontSize: 'var(--fs-sm)',
              fontWeight: 500,
              color: 'var(--fg3)',
              cursor: 'pointer',
              transition:
                'background var(--dur-base) var(--ease-out), color var(--dur-base) var(--ease-out)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--icp-gray-100)'
              e.currentTarget.style.color = 'var(--fg1)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = 'var(--fg3)'
            }}
          >
            Hide for now
          </button>
        </div>
      </div>
    </div>
  )

  /* ---------- Milestone view (inside modal) ---------- */
  const goBackToGrid = () => {
    setActiveSlug(null)
    setView('grid')
  }

  const milestoneView = activeSlug ? (
    activeSlug === 'branding' ? (
      <div className="overflow-y-auto flex-1">
        <BrandingStep
          initial={brandingInitial ?? {}}
          tenantName={tenantName}
          publicUrl={publicUrl}
          onClose={goBackToGrid}
          onSaved={refresh}
        />
      </div>
    ) : (
      <div className="overflow-y-auto flex-1" style={{ padding: 'var(--sp-8)' }}>
        <MilestonePanel
          slug={activeSlug}
          status={states.find((s) => s.slug === activeSlug)?.status ?? null}
          onBack={goBackToGrid}
          onChanged={refresh}
        />
      </div>
    )
  ) : null

  /* ---------- Celebration view (inside modal) ---------- */
  const celebrationView = (
    <div className="overflow-y-auto flex-1">
      <CelebrationScreen
        publicUrl={publicUrl}
        onDismiss={async () => {
          await postAction({ type: 'celebrate-dismissed' })
          closeModal()
        }}
      />
    </div>
  )

  return (
    <>
      {/* Dashboard surface — small horizontal strip */}
      {dashboardStrip}

      {/* Modal — all views live inside here */}
      <Dialog open={welcomeOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-5xl p-0 overflow-hidden gap-0 max-h-[90vh] flex flex-col">
          {view === 'welcome' && welcomeView}
          {view === 'grid' && gridView}
          {view === 'milestone' && milestoneView}
          {view === 'celebration' && celebrationView}
        </DialogContent>
      </Dialog>
    </>
  )
}
