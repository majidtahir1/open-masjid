'use client'

import React, { useState } from 'react'
import { usePathname } from 'next/navigation'
import { NavIcon } from './icons'
import { AccountMenu } from './AccountMenu'
import {
  searchEntries,
  type NavItem,
  type NavLeaf,
  type NavGroup,
  type Role,
} from './nav-config'

// Layout constants (kept here so the page-content offset in custom.scss and
// the overlay padding below stay in sync).
const HEADER_HEIGHT = 118 // approx sticky-header height (overlays start below it)
const TAB_HEIGHT = 84 // fixed bottom tab bar

type ShellUser = { name: string; email: string; initial: string }

const SearchGlyph = ({ size = 17 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
    <path d="m20 20-3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
)

const HomeGlyph = ({ size = 23 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M3 10.5 12 3l9 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const GlobeGlyph = ({ size = 23 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
    <path d="M3 12h18M12 3c2.5 2.5 2.5 15.5 0 18M12 3c-2.5 2.5-2.5 15.5 0 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
)

const DotsGlyph = ({ size = 23 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <circle cx="5" cy="12" r="1.8" fill="currentColor" />
    <circle cx="12" cy="12" r="1.8" fill="currentColor" />
    <circle cx="19" cy="12" r="1.8" fill="currentColor" />
  </svg>
)

const PlusGlyph = ({ size = 26 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
  </svg>
)

const ChevronGlyph = ({ size = 18, color = 'var(--om-drag-handle)' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden style={{ color }}>
    <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const ChevronDown = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="m6 9 6 6 6-6" stroke="#9FAAD0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

// ---- Shared row primitives ------------------------------------------------

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 45,
  background: 'var(--om-sheet-bg)',
  overflowY: 'auto',
  paddingTop: HEADER_HEIGHT,
  paddingBottom: TAB_HEIGHT + 12,
}

const cardStyle: React.CSSProperties = {
  background: 'var(--om-pop-bg)',
  border: '1px solid var(--om-card-border)',
  borderRadius: 15,
  overflow: 'hidden',
}

function LeafLink({
  leaf,
  swatchBg,
  swatchColor,
  last,
  onNavigate,
}: {
  leaf: NavLeaf
  swatchBg: string
  swatchColor: string
  last: boolean
  onNavigate: () => void
}) {
  return (
    <a
      href={leaf.href}
      onClick={onNavigate}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 13,
        padding: '14px 16px',
        borderBottom: last ? 'none' : '1px solid var(--om-row-divider)',
        textDecoration: 'none',
      }}
    >
      <span
        style={{
          width: 32,
          height: 32,
          flex: '0 0 auto',
          borderRadius: 9,
          background: swatchBg,
          color: swatchColor,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <NavIcon name={leaf.icon} size={17} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 14.5, fontWeight: 600, color: 'var(--om-text-strong)' }}>
          {leaf.label}
        </span>
        {leaf.description && (
          <span style={{ display: 'block', fontSize: 12, color: '#9CA4A4', marginTop: 1 }}>
            {leaf.description}
          </span>
        )}
      </span>
      <ChevronGlyph />
    </a>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color: '#9CA4A4',
        padding: '0 4px 8px',
        marginTop: 18,
      }}
    >
      {children}
    </div>
  )
}

// ---- Component ------------------------------------------------------------

export default function MobileShell({
  items,
  role,
  user,
  tenantName: tenantNameProp,
  viewSiteHref,
  tenantEditHref,
  showSettings,
}: {
  items: NavItem[]
  role: Role
  user: ShellUser
  tenantName?: string
  viewSiteHref?: string
  tenantEditHref?: string
  showSettings: boolean
}) {
  const pathname = usePathname()
  const [panel, setPanel] = useState<'website' | 'more' | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)

  const closePanels = () => setPanel(null)

  const websiteGroup = items.find(
    (i): i is NavGroup => i.kind === 'group' && i.label === 'Website',
  )
  const createActions = searchEntries(role, '').actions

  const tenantName = tenantNameProp || 'this masjid'
  const tenantInitial = (tenantName[0] ?? 'M').toUpperCase()

  const homeActive = pathname === '/admin' && panel === null

  const tabColor = (active: boolean) => (active ? 'var(--om-tab-active)' : '#9CA4A4')

  // ---- Header -------------------------------------------------------------
  const header = (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 14,
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            padding: '5px 11px 5px 6px',
            borderRadius: 999,
            background: 'rgba(255,255,255,.12)',
          }}
        >
          <span
            style={{
              width: 22,
              height: 22,
              borderRadius: 6,
              background: '#28A0B4',
              color: '#fff',
              fontSize: 12,
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {tenantInitial}
          </span>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: '#fff', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {tenantName}
          </span>
          <ChevronDown />
        </span>

        <AccountMenu
          open={accountOpen}
          onToggle={() => setAccountOpen((o) => !o)}
          user={{ name: user.name, email: user.email, role, initial: user.initial }}
          viewSiteHref={viewSiteHref}
          tenantEditHref={tenantEditHref}
          showSettings={showSettings}
        />
      </div>

      <button
        type="button"
        onClick={() => window.dispatchEvent(new Event('om:open-palette'))}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          height: 40,
          width: '100%',
          padding: '0 13px',
          borderRadius: 11,
          background: 'rgba(255,255,255,.10)',
          color: '#9FAAD0',
          fontSize: 14,
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        <SearchGlyph size={17} />
        <span>Search pages &amp; actions&hellip;</span>
      </button>
    </>
  )

  // ---- Bottom tab bar -----------------------------------------------------
  const tabSlot = (
    active: boolean,
    icon: React.ReactNode,
    label: string,
  ) => (
    <span
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        color: tabColor(active),
      }}
    >
      {icon}
      <span style={{ fontSize: 10.5, fontWeight: 600 }}>{label}</span>
    </span>
  )

  return (
    <>
      <nav
        data-om-topbar
        style={{ background: '#0F1E4A', padding: '18px 20px 14px', position: 'relative', zIndex: 60 }}
      >
        {header}
      </nav>

      {/* Website panel */}
      {panel === 'website' && (
        <div style={overlayStyle}>
          <div style={{ padding: '0 16px' }}>
            {websiteGroup && websiteGroup.children.length > 0 ? (
              <div style={cardStyle}>
                {websiteGroup.children.map((c, i) => (
                  <LeafLink
                    key={c.href}
                    leaf={c}
                    swatchBg="var(--om-teal-badge-bg)"
                    swatchColor="var(--om-teal-badge-fg)"
                    last={i === websiteGroup.children.length - 1}
                    onNavigate={closePanels}
                  />
                ))}
              </div>
            ) : (
              <div style={{ ...cardStyle, padding: 24, textAlign: 'center', color: '#9CA4A4', fontSize: 14 }}>
                Nothing here for your role.
              </div>
            )}
          </div>
        </div>
      )}

      {/* More panel */}
      {panel === 'more' && (
        <div style={overlayStyle}>
          <div style={{ padding: '0 16px' }}>
            {items
              .filter((i) => i.label !== 'Dashboard' && i.label !== 'Website')
              .map((item) =>
                item.kind === 'leaf' ? (
                  <div key={item.href} style={{ ...cardStyle, marginTop: 12 }}>
                    <LeafLink
                      leaf={item}
                      swatchBg="var(--om-swatch-bg)"
                      swatchColor="var(--om-teal-ink)"
                      last
                      onNavigate={closePanels}
                    />
                  </div>
                ) : (
                  <div key={item.label}>
                    <SectionLabel>{item.label}</SectionLabel>
                    <div style={cardStyle}>
                      {item.children.map((c, i) => (
                        <LeafLink
                          key={c.href}
                          leaf={c}
                          swatchBg="var(--om-swatch-bg)"
                          swatchColor="var(--om-teal-ink)"
                          last={i === item.children.length - 1}
                          onNavigate={closePanels}
                        />
                      ))}
                    </div>
                  </div>
                ),
              )}

            <SectionLabel>Account</SectionLabel>
            <div style={cardStyle}>
              <AccountRow label="My Profile" href="/admin/account" last={false} onNavigate={closePanels} />
              {showSettings && tenantEditHref && (
                <AccountRow label="Site Settings" href={tenantEditHref} last={!viewSiteHref} onNavigate={closePanels} />
              )}
              {viewSiteHref && (
                <AccountRow label="View public site" href={viewSiteHref} newTab last onNavigate={closePanels} />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bottom tab bar */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          height: TAB_HEIGHT,
          background: 'var(--om-tabbar-bg)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          borderTop: '1px solid var(--om-card-border)',
          display: 'flex',
          alignItems: 'flex-start',
          padding: '10px 6px 0',
        }}
      >
        <a
          href="/admin"
          onClick={closePanels}
          style={{ flex: 1, textDecoration: 'none' }}
        >
          {tabSlot(homeActive, <HomeGlyph />, 'Home')}
        </a>

        <button
          type="button"
          onClick={() => setPanel((p) => (p === 'website' ? null : 'website'))}
          style={{ flex: 1, background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          {tabSlot(panel === 'website', <GlobeGlyph />, 'Website')}
        </button>

        <button
          type="button"
          aria-label="Create"
          onClick={() => setCreateOpen(true)}
          style={{
            flex: '0 0 auto',
            width: 54,
            height: 54,
            marginTop: -6,
            borderRadius: 17,
            background: '#28A0B4',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 6px 16px rgba(40,160,180,.4)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <PlusGlyph />
        </button>

        <button
          type="button"
          onClick={() => setPanel((p) => (p === 'more' ? null : 'more'))}
          style={{ flex: 1, background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          {tabSlot(panel === 'more', <DotsGlyph />, 'More')}
        </button>
      </div>

      {/* Create sheet */}
      {createOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 80 }}>
          <div
            onClick={() => setCreateOpen(false)}
            style={{ position: 'absolute', inset: 0, background: 'rgba(10,22,56,.4)' }}
            aria-hidden
          />
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              background: 'var(--om-sheet-bg)',
              borderRadius: '22px 22px 0 0',
              padding: '10px 14px 34px',
              animation: 'om-sheet-up 220ms cubic-bezier(0.22,0.61,0.36,1)',
            }}
          >
            <div
              style={{
                width: 38,
                height: 4,
                borderRadius: 2,
                background: 'var(--om-drag-handle)',
                margin: '0 auto 14px',
              }}
            />
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--om-text-muted)', padding: '0 4px 10px' }}>
              Create new
            </div>
            <div style={cardStyle}>
              {createActions.map((a, i) => (
                <a
                  key={a.href}
                  href={a.href}
                  onClick={() => setCreateOpen(false)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 13,
                    padding: '14px 16px',
                    borderBottom: i === createActions.length - 1 ? 'none' : '1px solid var(--om-row-divider)',
                    textDecoration: 'none',
                  }}
                >
                  <span
                    style={{
                      width: 32,
                      height: 32,
                      flex: '0 0 auto',
                      borderRadius: 9,
                      background: 'var(--om-teal-badge-bg)',
                      color: 'var(--om-teal-badge-fg)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <PlusGlyph size={18} />
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 14.5, fontWeight: 600, color: 'var(--om-text-strong)' }}>
                      {a.label}
                    </span>
                    <span style={{ display: 'block', fontSize: 12, color: '#9CA4A4', marginTop: 1 }}>
                      {a.group}
                    </span>
                  </span>
                </a>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              style={{
                width: '100%',
                marginTop: 12,
                padding: '14px 16px',
                background: 'var(--om-pop-bg)',
                border: '1px solid var(--om-card-border)',
                borderRadius: 15,
                color: 'var(--om-danger)',
                fontSize: 14.5,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  )
}

function AccountRow({
  label,
  href,
  newTab,
  last,
  onNavigate,
}: {
  label: string
  href: string
  newTab?: boolean
  last: boolean
  onNavigate: () => void
}) {
  return (
    <a
      href={href}
      target={newTab ? '_blank' : undefined}
      rel={newTab ? 'noopener noreferrer' : undefined}
      onClick={onNavigate}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 13,
        padding: '14px 16px',
        borderBottom: last ? 'none' : '1px solid var(--om-row-divider)',
        textDecoration: 'none',
      }}
    >
      <span style={{ flex: 1, fontSize: 14.5, fontWeight: 600, color: 'var(--om-text-strong)' }}>{label}</span>
      <ChevronGlyph />
    </a>
  )
}
