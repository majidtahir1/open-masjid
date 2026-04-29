'use client'

import { useEffect, useState } from 'react'
import { Clock, Check, Sparkles } from 'lucide-react'
import {
  type MilestoneSlug,
  type MilestoneState,
  MILESTONES,
  doneCount,
} from '@/lib/onboarding'
import { MilestoneTile } from './MilestoneTile'
import { MilestonePanel } from './MilestonePanel'
import { BrandingStep, type BrandingInitial } from './steps/BrandingStep'
import { IdentityStep, type IdentityInitial } from './steps/IdentityStep'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'

type View = 'welcome' | 'grid' | 'milestone'

type Props = {
  initialStates: MilestoneState[]
  publicUrl: string
  /** Tenant display name for the card header. */
  tenantName: string
  /** True iff this user has never seen the welcome modal yet — auto-opens the wizard once. */
  showWelcome: boolean
  /** Current branding values used to seed the rich Branding step. */
  brandingInitial?: BrandingInitial
  /** Current identity values used to seed the rich Identity step. */
  identityInitial?: IdentityInitial
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
  brandingInitial,
  identityInitial,
}: Props) {
  const [states] = useState(initialStates)
  const [activeSlug, setActiveSlug] = useState<MilestoneSlug | null>(null)

  const done = doneCount(states)
  const total = states.length || 6
  const remaining = Math.max(0, total - done)
  const pct = Math.min(100, Math.round((done / total) * 100))

  // Public URL stripped to "<slug>.openmasjid.app" for editorial display
  const publicHost = publicUrl.replace(/^https?:\/\//, '')

  const [welcomeOpen, setWelcomeOpen] = useState(showWelcome)

  // Auto-open shows the welcome view first; manual open jumps straight to the grid.
  const [view, setView] = useState<View>(showWelcome ? 'welcome' : 'grid')

  // Fire seen-welcome API call once when the modal first auto-opens.
  useEffect(() => {
    if (showWelcome) {
      void postAction({ type: 'seen-welcome' })
    }
  }, [showWelcome])

  const refresh = () => {
    window.location.reload()
  }

  const openModal = () => {
    setView('grid')
    setActiveSlug(null)
    setWelcomeOpen(true)
  }

  const closeModal = () => {
    setWelcomeOpen(false)
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) closeModal()
    else setWelcomeOpen(true)
  }

  /* ---------- Dashboard strip ---------- */
  const dashboardStrip = (
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
        Run onboarding wizard
      </button>
    </div>
  )

  /* ---------- Welcome view (inside modal) ---------- */
  const welcomeView = (
    <div className="flex flex-col overflow-y-auto" style={{ maxHeight: '90vh' }}>
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
        <div style={{ maxWidth: '36rem' }}>
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

      <div
        style={{
          background: 'white',
          padding: 'var(--sp-8) var(--sp-12)',
        }}
      >
        <div style={{ maxWidth: '36rem' }}>
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
              Resume any time
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
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
      <div
        style={{
          background: 'var(--bg-alt)',
          padding: 'var(--sp-10) var(--sp-12) var(--sp-8)',
          flexShrink: 0,
          position: 'relative',
        }}
      >
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
              gets it looking like your masjid.
            </p>
          </div>

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

      <div
        className="overflow-y-auto flex-1"
        style={{
          background: 'var(--bg-alt)',
          padding: 'var(--sp-8) var(--sp-12) var(--sp-10)',
        }}
      >
        <ul
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            background: 'var(--bg)',
            border: '1px solid rgba(15, 30, 74, 0.06)',
            borderRadius: 'var(--r-lg)',
            overflow: 'hidden',
            boxShadow: 'var(--sh-xs)',
          }}
        >
          {states.map((s, i) => (
            <li
              key={s.slug}
              className="flex"
              style={{
                borderTop: i >= 3 ? '1px solid rgba(15, 30, 74, 0.06)' : 'none',
                borderLeft: i % 3 === 0 ? 'none' : '1px solid rgba(15, 30, 74, 0.06)',
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

        <div
          className="flex flex-wrap items-center justify-between gap-3"
          style={{
            marginTop: 'var(--sp-6)',
            padding: '0 var(--sp-1)',
            background: 'transparent',
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
            Close
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

  const advanceTo = (current: MilestoneSlug) => {
    const idx = MILESTONES.indexOf(current)
    const next = MILESTONES[idx + 1]
    if (next) {
      setActiveSlug(next)
      setView('milestone')
    } else {
      goBackToGrid()
    }
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
          onAdvance={() => advanceTo('branding')}
        />
      </div>
    ) : activeSlug === 'identity' ? (
      <div className="overflow-y-auto flex-1">
        <IdentityStep
          initial={identityInitial ?? {}}
          tenantName={tenantName}
          publicUrl={publicUrl}
          onClose={goBackToGrid}
          onSaved={refresh}
          onAdvance={() => advanceTo('identity')}
        />
      </div>
    ) : (
      <div className="overflow-y-auto flex-1" style={{ padding: 'var(--sp-8)' }}>
        <MilestonePanel
          slug={activeSlug}
          status={states.find((s) => s.slug === activeSlug)?.status ?? null}
          onBack={goBackToGrid}
        />
      </div>
    )
  ) : null

  return (
    <>
      {dashboardStrip}

      <Dialog open={welcomeOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-5xl p-0 overflow-hidden gap-0 max-h-[90vh] flex flex-col" hideCloseButton>
          <DialogTitle
            style={{
              position: 'absolute',
              width: 1,
              height: 1,
              padding: 0,
              margin: -1,
              overflow: 'hidden',
              clip: 'rect(0, 0, 0, 0)',
              whiteSpace: 'nowrap',
              border: 0,
            }}
          >
            {view === 'welcome' && 'Welcome to OpenMasjid'}
            {view === 'grid' && 'Setup checklist'}
            {view === 'milestone' && 'Setup step'}
          </DialogTitle>
          {view === 'welcome' && welcomeView}
          {view === 'grid' && gridView}
          {view === 'milestone' && milestoneView}
        </DialogContent>
      </Dialog>
    </>
  )
}
