'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import { Heart, Menu, X } from 'lucide-react'

import { mediaUrl, type TenantLike } from './types'

export interface HeaderProps {
  /** Tenant record for logo, name, and donation routing. */
  tenant?: TenantLike | null
  /** Current pathname (optional) — used to highlight the active nav link. */
  currentPath?: string
}

const NAV_LINKS: Array<{ href: string; label: string }> = [
  { href: '/', label: 'Home' },
  { href: '/prayer-times', label: 'Prayer Times' },
  { href: '/events', label: 'Events' },
  { href: '/about', label: 'About' },
]

function isActive(currentPath: string | undefined, href: string): boolean {
  if (!currentPath) return false
  if (href === '/') return currentPath === '/'
  return currentPath === href || currentPath.startsWith(href + '/')
}

export default function Header({ tenant, currentPath }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Close the mobile menu on route change (best-effort via path prop).
  useEffect(() => {
    setMenuOpen(false)
  }, [currentPath])

  // Prevent body scroll while the mobile menu is open.
  useEffect(() => {
    if (!menuOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [menuOpen])

  const logoSrc = mediaUrl(tenant?.branding?.logo)
  const tenantName = tenant?.name ?? 'OpenMasjid'

  return (
    <header
      className={[
        'sticky top-0 z-50 w-full border-b border-border',
        'transition-colors duration-base ease-out',
        scrolled
          ? 'bg-white/80 backdrop-blur-[10px] supports-[backdrop-filter]:bg-white/70'
          : 'bg-white/95',
      ].join(' ')}
    >
      <div className="mx-auto flex h-36 max-w-page items-center justify-between gap-6 px-6">
        <Link
          href="/"
          className="inline-flex h-28 items-center"
          aria-label={`${tenantName} — Home`}
        >
          {logoSrc ? (
            <Image
              src={logoSrc}
              alt={tenantName}
              width={416}
              height={112}
              priority
              className="h-28 w-[416px] object-contain"
              unoptimized={logoSrc.startsWith('/')}
            />
          ) : (
            <span className="font-display text-[28px] font-semibold leading-none text-brand-ink">
              {tenantName}
            </span>
          )}
        </Link>

        {/* Desktop nav */}
        <nav
          className="hidden flex-1 justify-center gap-1 md:flex"
          aria-label="Main"
        >
          {NAV_LINKS.map((link) => {
            const active = isActive(currentPath, link.href)
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={[
                  'px-[14px] py-2 text-fs-sm font-medium transition-colors duration-base ease-out',
                  'rounded-[var(--r-sm)] outline-none',
                  'focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2',
                  active
                    ? 'bg-brand-soft text-brand'
                    : 'text-fg2 hover:bg-gray-100 hover:text-fg1',
                ].join(' ')}
              >
                {link.label}
              </Link>
            )
          })}
        </nav>

        {/* Desktop CTA */}
        <div className="hidden items-center gap-2 md:flex">
          <Link
            href="/donate"
            className={[
              'inline-flex items-center gap-2 border border-transparent bg-brand',
              'px-[14px] py-[7px] text-fs-sm font-semibold text-white',
              'rounded-[var(--r-md)] transition-all duration-base ease-out',
              'hover:-translate-y-px hover:bg-brand-hover hover:shadow-sh-md',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2',
            ].join(' ')}
          >
            <Heart size={14} strokeWidth={1.75} />
            Donate
          </Link>
        </div>

        {/* Mobile toggle */}
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className={[
            'inline-flex h-11 w-11 items-center justify-center border border-border md:hidden',
            'rounded-[var(--r-md)] text-fg1 hover:bg-gray-100',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2',
          ].join(' ')}
          aria-expanded={menuOpen}
          aria-controls="mobile-nav"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
        >
          {menuOpen ? <X size={20} strokeWidth={1.75} /> : <Menu size={20} strokeWidth={1.75} />}
        </button>
      </div>

      {/* Mobile slide-out menu */}
      <div
        id="mobile-nav"
        className={[
          'overflow-hidden border-t border-border bg-white md:hidden',
          'transition-[max-height,opacity] duration-base ease-out',
          menuOpen ? 'max-h-[480px] opacity-100' : 'max-h-0 opacity-0',
        ].join(' ')}
        aria-hidden={!menuOpen}
      >
        <nav className="flex flex-col gap-1 p-4" aria-label="Mobile">
          {NAV_LINKS.map((link) => {
            const active = isActive(currentPath, link.href)
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={[
                  'px-4 py-3 text-fs-base font-medium transition-colors duration-base ease-out',
                  'rounded-[var(--r-md)]',
                  active
                    ? 'bg-brand-soft text-brand'
                    : 'text-fg2 hover:bg-gray-100 hover:text-fg1',
                ].join(' ')}
              >
                {link.label}
              </Link>
            )
          })}
          <Link
            href="/donate"
            className={[
              'mt-2 inline-flex items-center justify-center gap-2 bg-brand px-4 py-3',
              'rounded-[var(--r-md)] text-fs-base font-semibold text-white hover:bg-brand-hover',
            ].join(' ')}
          >
            <Heart size={16} strokeWidth={1.75} />
            Donate
          </Link>
        </nav>
      </div>
    </header>
  )
}
