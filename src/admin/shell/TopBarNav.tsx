'use client'

import React, { useEffect, useState } from 'react'
import { useAuth } from '@payloadcms/ui'
import { visibleFor, type Role, type NavItem } from './nav-config'
import { MegaMenu } from './MegaMenu'
import { AccountMenu } from './AccountMenu'
import { MobileDrawer } from './MobileDrawer'

type ShellUser = {
  role?: Role
  firstName?: string
  lastName?: string
  email?: string
  tenant?: unknown
}

function tenantIdOf(t: unknown): string | number | null {
  if (!t) return null
  if (typeof t === 'object' && t !== null && 'id' in t) {
    return (t as { id: string | number }).id
  }
  if (typeof t === 'string' || typeof t === 'number') return t
  return null
}

const SearchIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
    <path d="m20 20-3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
)

const ExternalIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M14 4h6v6M20 4l-9 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

export default function TopBarNav() {
  const { user } = useAuth()
  const u = (user ?? {}) as ShellUser
  const role: Role = u.role ?? 'staff'
  const items: NavItem[] = visibleFor(role)

  const email = u.email ?? ''
  const name = [u.firstName, u.lastName].filter(Boolean).join(' ') || email || 'Account'
  const initial = (u.firstName?.[0] ?? email?.[0] ?? '?').toUpperCase()
  const showSettings = role === 'admin' || role === 'platformOwner'

  const [width, setWidth] = useState(1280)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [accountOpen, setAccountOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [viewSiteHref, setViewSiteHref] = useState<string | undefined>(undefined)
  const [tenantEditHref, setTenantEditHref] = useState<string | undefined>(undefined)

  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth)
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const tenantId = tenantIdOf(u.tenant)

  useEffect(() => {
    if (tenantId == null) return
    let cancelled = false
    const idStr = String(tenantId)
    setTenantEditHref(`/admin/collections/tenants/${idStr}`)

    fetch(`/api/tenants/${idStr}?depth=0`, { credentials: 'include' })
      .then((r) => (r.ok ? (r.json() as Promise<{ slug?: string | null }>) : null))
      .then((doc) => {
        if (!cancelled && doc?.slug) setViewSiteHref(`https://${doc.slug}.openmasjid.app`)
      })
      .catch(() => {
        /* graceful */
      })

    return () => {
      cancelled = true
    }
  }, [tenantId])

  const isMobile = width < 860
  const openPalette = () => window.dispatchEvent(new Event('om:open-palette'))

  const closeAll = () => {
    setOpenMenu(null)
    setAccountOpen(false)
  }

  const bar: React.CSSProperties = {
    height: 62,
    background: '#0F1E4A',
    display: 'flex',
    alignItems: 'center',
    padding: '0 24px',
    gap: 26,
    position: 'relative',
    zIndex: 60,
  }

  const Logo = (
    <a href="/admin" style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/logo-icp-horizontal-navy.svg"
        alt="OpenMasjid"
        style={{ height: 30, filter: 'brightness(0) invert(1)' }}
      />
    </a>
  )

  const Avatar = (
    <AccountMenu
      open={accountOpen}
      onToggle={() => {
        setOpenMenu(null)
        setAccountOpen((o) => !o)
      }}
      user={{ name, email, role, initial }}
      viewSiteHref={viewSiteHref}
      tenantEditHref={tenantEditHref}
      showSettings={showSettings}
    />
  )

  const anyOpen = openMenu !== null || accountOpen

  if (isMobile) {
    return (
      <nav data-om-topbar style={bar}>
        <button
          type="button"
          aria-label="Open menu"
          onClick={() => setMobileOpen((o) => !o)}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#fff',
            cursor: 'pointer',
            display: 'inline-flex',
            padding: 4,
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        {Logo}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 14 }}>
          <button
            type="button"
            aria-label="Search"
            onClick={openPalette}
            style={{ background: 'transparent', border: 'none', color: '#B6C0E0', cursor: 'pointer', display: 'inline-flex', padding: 4 }}
          >
            <SearchIcon size={19} />
          </button>
          {Avatar}
        </div>
        <MobileDrawer
          open={mobileOpen}
          items={items}
          onNavigate={() => setMobileOpen(false)}
        />
      </nav>
    )
  }

  return (
    <nav data-om-topbar style={bar}>
      {anyOpen && (
        <div
          onClick={closeAll}
          style={{ position: 'fixed', inset: 0, zIndex: 55 }}
          aria-hidden
        />
      )}
      {Logo}

      <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginLeft: 6 }}>
        {items.map((item) =>
          item.kind === 'leaf' ? (
            <a
              key={item.href}
              href={item.href}
              style={{
                padding: '8px 13px',
                borderRadius: 9,
                fontSize: 13.5,
                color: '#B6C0E0',
                fontWeight: 500,
                textDecoration: 'none',
                cursor: 'pointer',
              }}
            >
              {item.label}
            </a>
          ) : (
            <MegaMenu
              key={item.label}
              group={item}
              open={openMenu === item.label}
              onToggle={() => {
                setAccountOpen(false)
                setOpenMenu((cur) => (cur === item.label ? null : item.label))
              }}
            />
          ),
        )}
      </div>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 16 }}>
        <button
          type="button"
          onClick={openPalette}
          style={{
            width: 248,
            height: 38,
            background: 'rgba(255,255,255,.10)',
            color: '#9FAAD0',
            borderRadius: 10,
            padding: '0 12px',
            gap: 10,
            display: 'flex',
            alignItems: 'center',
            border: 'none',
            cursor: 'pointer',
            fontSize: 13,
            fontFamily: 'inherit',
          }}
        >
          <SearchIcon size={16} />
          <span>Search or jump to&hellip;</span>
          <kbd
            style={{
              marginLeft: 'auto',
              background: 'rgba(255,255,255,.14)',
              color: '#C7D0EC',
              borderRadius: 6,
              padding: '2px 6px',
              fontSize: 11,
              fontFamily: 'inherit',
            }}
          >
            &#8984;K
          </kbd>
        </button>

        {viewSiteHref && (
          <a
            href={viewSiteHref}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              color: '#B6C0E0',
              fontSize: 13,
              textDecoration: 'none',
            }}
          >
            <ExternalIcon size={14} />
            View site
          </a>
        )}

        {Avatar}
      </div>
    </nav>
  )
}
