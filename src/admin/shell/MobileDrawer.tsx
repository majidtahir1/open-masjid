'use client'

import React from 'react'
import { NavIcon } from './icons'
import type { NavItem, NavLeaf } from './nav-config'

function LeafRow({
  leaf,
  onNavigate,
  submissionsCount,
}: {
  leaf: NavLeaf
  onNavigate: () => void
  submissionsCount?: number
}) {
  const showBadge =
    leaf.badge === 'submissions' && typeof submissionsCount === 'number' && submissionsCount > 0
  return (
    <a
      href={leaf.href}
      onClick={onNavigate}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 8px',
        borderRadius: 9,
        color: '#3A3F3F',
        fontSize: 14.5,
        textDecoration: 'none',
      }}
    >
      <span style={{ color: '#1E7E8E', display: 'inline-flex' }}>
        <NavIcon name={leaf.icon} size={19} />
      </span>
      {leaf.label}
      {showBadge && (
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
          {submissionsCount}
        </span>
      )}
    </a>
  )
}

export function MobileDrawer({
  open,
  items,
  submissionsCount,
  onNavigate,
}: {
  open: boolean
  items: NavItem[]
  submissionsCount?: number
  onNavigate: () => void
}) {
  if (!open) return null
  return (
    <div
      style={{
        position: 'absolute',
        top: 62,
        left: 0,
        right: 0,
        zIndex: 65,
        background: '#fff',
        borderBottom: '1px solid #DDE1E1',
        boxShadow: '0 18px 44px rgba(15,30,74,.20)',
        padding: 12,
        maxHeight: 'calc(100vh - 62px)',
        overflowY: 'auto',
      }}
    >
      {items.map((item) =>
        item.kind === 'leaf' ? (
          <LeafRow key={item.href} leaf={item} onNavigate={onNavigate} submissionsCount={submissionsCount} />
        ) : (
          <div key={item.label} style={{ marginTop: 10 }}>
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: '#9CA4A4',
                padding: '8px 8px 4px',
              }}
            >
              {item.label}
            </div>
            {item.children.map((c) => (
              <LeafRow key={c.href} leaf={c} onNavigate={onNavigate} submissionsCount={submissionsCount} />
            ))}
          </div>
        ),
      )}
    </div>
  )
}
