'use client'

/**
 * ColumnMenu — the "⋮" menu on each spreadsheet column header.
 * Sort ascending / descending + a type-aware filter
 * (text contains, option checklist, or min–max range).
 */

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowDown, ArrowUp, MoreVertical } from 'lucide-react'
import type { ColumnFilterState, ColumnSpec } from '@/lib/submissions-table'

interface Props {
  spec: ColumnSpec
  sortDir: 'asc' | 'desc' | null
  onSort: (dir: 'asc' | 'desc') => void
  filter: ColumnFilterState | undefined
  onFilterChange: (state: ColumnFilterState) => void
}

interface PopPosition {
  top: number
  right: number
}

export default function ColumnMenu({ spec, sortDir, onSort, filter, onFilterChange }: Props) {
  // The popover renders in a portal with fixed positioning: the table sits in
  // an overflow scroll container and the sticky header cells clip overflow,
  // so an absolutely-positioned child would be cut off.
  const [pos, setPos] = useState<PopPosition | null>(null)
  const open = pos !== null
  const rootRef = useRef<HTMLDivElement>(null)
  const popRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = () => setPos(null)
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (rootRef.current?.contains(t) || popRef.current?.contains(t)) return
      close()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    const onScroll = (e: Event) => {
      // Keep the menu anchored: close when anything outside it scrolls.
      if (popRef.current?.contains(e.target as Node)) return
      close()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    document.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  const toggleOpen = () => {
    if (open) {
      setPos(null)
      return
    }
    const rect = rootRef.current?.getBoundingClientRect()
    if (!rect) return
    setPos({ top: rect.bottom + 4, right: Math.max(8, window.innerWidth - rect.right) })
  }

  const toggleOption = (value: string) => {
    const selected = filter?.selected ?? []
    const next = selected.includes(value)
      ? selected.filter((v) => v !== value)
      : [...selected, value]
    onFilterChange({ ...filter, selected: next })
  }

  const rangeInputType = spec.kind === 'numberRange' ? 'number' : 'date'

  return (
    <div className="sv-menu" ref={rootRef}>
      <button
        type="button"
        className="sv-menu__trigger"
        aria-label={`Column options for ${spec.label}`}
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation()
          toggleOpen()
        }}
      >
        <MoreVertical size={13} strokeWidth={1.75} />
      </button>
      {open && createPortal(
        <div
          className="sv-menu__pop"
          ref={popRef}
          style={{ top: pos.top, right: pos.right }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className={`sv-menu__item${sortDir === 'asc' ? ' sv-menu__item--active' : ''}`}
            onClick={() => {
              onSort('asc')
              setPos(null)
            }}
          >
            <ArrowUp size={13} aria-hidden />
            Sort ascending
          </button>
          <button
            type="button"
            className={`sv-menu__item${sortDir === 'desc' ? ' sv-menu__item--active' : ''}`}
            onClick={() => {
              onSort('desc')
              setPos(null)
            }}
          >
            <ArrowDown size={13} aria-hidden />
            Sort descending
          </button>
          <div className="sv-menu__divider" />
          <div className="sv-menu__filter">
            <div className="sv-menu__filter-label">Filter</div>
            {spec.kind === 'text' && (
              <input
                type="text"
                value={filter?.query ?? ''}
                placeholder="Contains…"
                aria-label={`Filter ${spec.label}`}
                onChange={(e) => onFilterChange({ ...filter, query: e.target.value })}
              />
            )}
            {spec.kind === 'options' && (
              <div className="sv-menu__options">
                {(spec.options ?? []).map((o) => (
                  <label key={o.value} className="sv-menu__option">
                    <input
                      type="checkbox"
                      checked={(filter?.selected ?? []).includes(o.value)}
                      onChange={() => toggleOption(o.value)}
                    />
                    {o.label}
                  </label>
                ))}
              </div>
            )}
            {(spec.kind === 'numberRange' || spec.kind === 'dateRange') && (
              <div className="sv-menu__range">
                <input
                  type={rangeInputType}
                  value={filter?.min ?? ''}
                  aria-label={`${spec.label} minimum`}
                  onChange={(e) => onFilterChange({ ...filter, min: e.target.value })}
                />
                <span>–</span>
                <input
                  type={rangeInputType}
                  value={filter?.max ?? ''}
                  aria-label={`${spec.label} maximum`}
                  onChange={(e) => onFilterChange({ ...filter, max: e.target.value })}
                />
              </div>
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
