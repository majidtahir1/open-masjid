'use client'

import React from 'react'
import { NavIcon } from './icons'
import type { NavGroup } from './nav-config'

const CARD: React.CSSProperties = {
  position: 'absolute',
  top: 'calc(100% + 10px)',
  left: 0,
  zIndex: 70,
  background: '#fff',
  border: '1px solid #DDE1E1',
  borderRadius: 14,
  boxShadow: '0 18px 44px rgba(15,30,74,.20)',
}

function SubmissionsBadge({ count }: { count: number }) {
  return (
    <span
      style={{
        marginLeft: 'auto',
        minWidth: 20,
        height: 20,
        padding: '0 6px',
        borderRadius: 999,
        background: '#B2493C',
        color: '#fff',
        fontSize: 11,
        fontWeight: 700,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {count}
    </span>
  )
}

export function MegaMenu({
  group,
  open,
  onToggle,
  submissionsCount,
}: {
  group: NavGroup
  open: boolean
  onToggle: () => void
  submissionsCount?: number
}) {
  const hover = (e: React.MouseEvent<HTMLAnchorElement>, on: boolean) => {
    e.currentTarget.style.background = on ? '#F7F8F8' : 'transparent'
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          padding: '8px 13px',
          borderRadius: 9,
          fontSize: 13.5,
          cursor: 'pointer',
          border: 'none',
          background: open ? 'rgba(40,160,180,.20)' : 'transparent',
          color: open ? '#fff' : '#B6C0E0',
          fontWeight: open ? 600 : 500,
          fontFamily: 'inherit',
        }}
      >
        {group.label}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && group.layout === 'grid' && (
        <div
          style={{
            ...CARD,
            width: 540,
            padding: 14,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 2,
          }}
        >
          {group.children.map((c) => (
            <a
              key={c.href}
              href={c.href}
              onMouseEnter={(e) => hover(e, true)}
              onMouseLeave={(e) => hover(e, false)}
              style={{
                display: 'flex',
                gap: 12,
                padding: '11px 12px',
                borderRadius: 10,
                textDecoration: 'none',
                background: 'transparent',
              }}
            >
              <span style={{ color: '#1E7E8E', flexShrink: 0, marginTop: 1 }}>
                <NavIcon name={c.icon} size={18} />
              </span>
              <span>
                <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: '#141616' }}>{c.label}</span>
                {c.description && (
                  <span style={{ display: 'block', fontSize: 12, color: '#747C7C', marginTop: 2 }}>{c.description}</span>
                )}
              </span>
            </a>
          ))}
        </div>
      )}

      {open && group.layout === 'list' && (
        <div style={{ ...CARD, width: 300, padding: 10 }}>
          {group.children.map((c) => {
            const showBadge = c.badge === 'submissions' && typeof submissionsCount === 'number' && submissionsCount > 0
            return (
              <a
                key={c.href}
                href={c.href}
                onMouseEnter={(e) => hover(e, true)}
                onMouseLeave={(e) => hover(e, false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 11,
                  padding: '10px 11px',
                  borderRadius: 9,
                  color: '#3A3F3F',
                  fontSize: 13.5,
                  textDecoration: 'none',
                  background: 'transparent',
                }}
              >
                <span style={{ color: '#1E7E8E', flexShrink: 0, display: 'inline-flex' }}>
                  <NavIcon name={c.icon} size={18} />
                </span>
                {c.label}
                {showBadge && <SubmissionsBadge count={submissionsCount as number} />}
              </a>
            )
          })}
        </div>
      )}
    </div>
  )
}
