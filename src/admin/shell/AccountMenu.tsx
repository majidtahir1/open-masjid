'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@payloadcms/ui'
import type { Role } from './nav-config'

type AccountUser = {
  name: string
  email: string
  role: Role
  initial: string
}

function Row({
  label,
  href,
  newTab,
  onClick,
}: {
  label: string
  href?: string
  newTab?: boolean
  onClick?: () => void
}) {
  const style: React.CSSProperties = {
    display: 'block',
    padding: '9px 12px',
    borderRadius: 8,
    fontSize: 13.5,
    color: 'var(--om-text-body)',
    textDecoration: 'none',
    cursor: 'pointer',
    background: 'transparent',
    border: 'none',
    width: '100%',
    textAlign: 'left',
    fontFamily: 'inherit',
  }
  const onEnter = (e: React.MouseEvent<HTMLElement>) => {
    e.currentTarget.style.background = 'var(--om-hover-bg)'
  }
  const onLeave = (e: React.MouseEvent<HTMLElement>) => {
    e.currentTarget.style.background = 'transparent'
  }
  if (href) {
    return (
      <a
        href={href}
        target={newTab ? '_blank' : undefined}
        rel={newTab ? 'noopener noreferrer' : undefined}
        onClick={onClick}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        style={style}
      >
        {label}
      </a>
    )
  }
  return (
    <button type="button" onClick={onClick} onMouseEnter={onEnter} onMouseLeave={onLeave} style={style}>
      {label}
    </button>
  )
}

export function AccountMenu({
  open,
  onToggle,
  user,
  viewSiteHref,
  tenantEditHref,
  showSettings,
}: {
  open: boolean
  onToggle: () => void
  user: AccountUser
  viewSiteHref?: string
  tenantEditHref?: string
  showSettings: boolean
}) {
  const router = useRouter()
  const { logOut } = useAuth()

  const signOut = async () => {
    try {
      await logOut()
    } catch {
      /* ignore */
    }
    router.push('/admin/login')
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={onToggle}
        aria-label="Account menu"
        style={{
          width: 34,
          height: 34,
          borderRadius: '50%',
          background: '#28A0B4',
          color: '#fff',
          fontSize: 13,
          fontWeight: 600,
          border: 'none',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'inherit',
        }}
      >
        {user.initial}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 10px)',
            right: 0,
            zIndex: 70,
            width: 260,
            background: 'var(--om-pop-bg)',
            border: '1px solid var(--om-pop-border)',
            borderRadius: 14,
            boxShadow: '0 18px 44px rgba(15,30,74,.20)',
            padding: 8,
          }}
        >
          <div style={{ padding: '8px 12px 10px' }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--om-text-strong)' }}>{user.name}</div>
            <div style={{ fontSize: 12, color: 'var(--om-text-muted)', marginTop: 2 }}>{user.email}</div>
          </div>
          <Row label="My Profile" href="/admin/account" onClick={onToggle} />
          {showSettings && tenantEditHref && (
            <Row label="Site Settings" href={tenantEditHref} onClick={onToggle} />
          )}
          {viewSiteHref && <Row label="View site" href={viewSiteHref} newTab onClick={onToggle} />}
          <div style={{ height: 1, background: 'var(--om-divider)', margin: '6px 4px' }} />
          <Row label="Sign out" onClick={signOut} />
        </div>
      )}
    </div>
  )
}
