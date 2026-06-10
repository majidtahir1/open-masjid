'use client'

/**
 * ColumnMenu — the "⋮" menu on each spreadsheet column header.
 * Sort ascending / descending + a type-aware filter
 * (text contains, option checklist, or min–max range).
 */

import { useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, MoreVertical } from 'lucide-react'
import type { ColumnFilterState, ColumnSpec } from '@/lib/submissions-table'

interface Props {
  spec: ColumnSpec
  sortDir: 'asc' | 'desc' | null
  onSort: (dir: 'asc' | 'desc') => void
  filter: ColumnFilterState | undefined
  onFilterChange: (state: ColumnFilterState) => void
}

export default function ColumnMenu({ spec, sortDir, onSort, filter, onFilterChange }: Props) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

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
          setOpen((o) => !o)
        }}
      >
        <MoreVertical size={13} strokeWidth={1.75} />
      </button>
      {open && (
        <div className="sv-menu__pop" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className={`sv-menu__item${sortDir === 'asc' ? ' sv-menu__item--active' : ''}`}
            onClick={() => {
              onSort('asc')
              setOpen(false)
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
              setOpen(false)
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
        </div>
      )}
    </div>
  )
}
