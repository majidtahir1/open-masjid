'use client'

import { useEffect, useRef, useState } from 'react'
import { FIELD_TYPES, type FieldTypeId } from '@/lib/form-schema'
import FieldTypeIcon from './FieldTypeIcon'

/** One-line description for each field type displayed in the popover tiles. */
const FIELD_DESCRIPTIONS: Record<FieldTypeId, string> = {
  'short-text': 'Single-line text answer',
  'email': 'Email address with validation',
  'phone': 'Phone number input',
  'long-text': 'Multi-line paragraph answer',
  'number': 'Numeric value with optional min/max',
  'date': 'Date picker',
  'dropdown': 'Select one from a list',
  'radio': 'Single choice from visible options',
  'multiselect': 'Multiple choices from a list',
  'checkbox-group': 'Multiple checkbox selections',
  'consent': 'Mandatory agree/consent checkbox',
  'page-break': 'Split form into multiple steps',
}

interface AddFieldPopoverProps {
  onAdd: (typeId: FieldTypeId) => void
  onClose: () => void
}

export default function AddFieldPopover({ onAdd, onClose }: AddFieldPopoverProps) {
  const [search, setSearch] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Auto-focus the search input when the popover mounts
  useEffect(() => {
    searchRef.current?.focus()
  }, [])

  // Close on click outside
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [onClose])

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const filtered = FIELD_TYPES.filter((ft) =>
    ft.label.toLowerCase().includes(search.trim().toLowerCase()),
  )

  return (
    <div className="fb-popover" ref={containerRef} role="dialog" aria-label="Add field">
      <div className="fb-popover-search">
        <input
          ref={searchRef}
          className="fb-popover-search-input"
          type="text"
          placeholder="Search field types…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="fb-popover-grid">
        {filtered.map((ft) => (
          <button
            key={ft.id}
            type="button"
            className="fb-popover-tile"
            onClick={() => {
              onAdd(ft.id)
              onClose()
            }}
          >
            <span className="fb-popover-tile-icon">
              <FieldTypeIcon type={ft.id} size={18} />
            </span>
            <span className="fb-popover-tile-text">
              <span className="fb-popover-tile-label">{ft.label}</span>
              <span className="fb-popover-tile-desc">{FIELD_DESCRIPTIONS[ft.id]}</span>
            </span>
          </button>
        ))}
        {filtered.length === 0 && (
          <div
            style={{
              gridColumn: '1 / -1',
              padding: '24px',
              textAlign: 'center',
              color: 'var(--theme-elevation-400)',
              fontSize: 13,
            }}
          >
            No field types match &ldquo;{search}&rdquo;
          </div>
        )}
      </div>
    </div>
  )
}
