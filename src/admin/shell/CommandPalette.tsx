'use client'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@payloadcms/ui'
import { searchEntries, type Role } from './nav-config'

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter()
  const { user } = useAuth()
  const role = ((user as { role?: Role } | null)?.role ?? 'staff') as Role
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const { actions, pages } = useMemo(() => searchEntries(role, query), [role, query])
  const flat = useMemo(
    () => [...actions.map((a) => a.href), ...pages.map((p) => p.href)],
    [actions, pages],
  )

  useEffect(() => { if (open) { setQuery(''); setActive(0); inputRef.current?.focus() } }, [open])

  const go = (href: string) => { onClose(); router.push(href) }

  const onKeyDown = (e: React.KeyboardEvent) => {
    const n = flat.length
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => (n ? (i + 1) % n : 0)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => (n ? (i - 1 + n) % n : 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); if (flat[active]) go(flat[active]) }
    else if (e.key === 'Escape') { e.preventDefault(); onClose() }
  }

  if (!open) return null
  const ai = flat.length ? Math.min(active, flat.length - 1) : 0
  return (
    <div className="omk" style={{ position: 'fixed', inset: 0, zIndex: 100 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(10,22,56,.32)' }} />
      <div role="dialog" aria-modal style={{
        position: 'absolute', top: 88, left: '50%', transform: 'translateX(-50%)',
        width: 600, maxWidth: '92vw', background: '#fff', borderRadius: 16,
        boxShadow: '0 30px 80px rgba(10,22,56,.4)', overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '18px 20px', borderBottom: '1px solid #EEF0F0' }}>
          <input
            ref={inputRef} value={query} onChange={(e) => { setQuery(e.target.value); setActive(0) }}
            onKeyDown={onKeyDown} placeholder="Search pages and actions…"
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: 16, background: 'transparent' }}
          />
          <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: '#F7F8F8', color: '#747C7C' }}>esc</span>
        </div>
        <div style={{ maxHeight: 420, overflowY: 'auto', padding: 10 }}>
          {actions.length > 0 && <Section title="Actions" items={actions.map((a, i) => ({ key: a.href, label: a.label, group: a.group, activeRow: i === ai, onClick: () => go(a.href) }))} />}
          {pages.length > 0 && <Section title="Go to" items={pages.map((p, i) => ({ key: p.href, label: p.label, group: p.label, activeRow: actions.length + i === ai, onClick: () => go(p.href) }))} />}
          {flat.length === 0 && <div style={{ padding: '34px 12px', textAlign: 'center', color: '#9CA4A4' }}>No matches for &ldquo;{query}&rdquo;</div>}
        </div>
      </div>
    </div>
  )
}

function Section({ title, items }: { title: string; items: { key: string; label: string; group: string; activeRow: boolean; onClick: () => void }[] }) {
  return (
    <div>
      <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9CA4A4', padding: '8px 12px 6px' }}>{title}</div>
      {items.map((it) => (
        <div key={it.key} onClick={it.onClick} style={{ display: 'flex', gap: 13, padding: '11px 12px', borderRadius: 10, cursor: 'pointer', background: it.activeRow ? '#EEF0FA' : 'transparent' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: '#141616' }}>{it.label}</div>
            <div style={{ fontSize: 12, color: '#9CA4A4' }}>{it.group}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
