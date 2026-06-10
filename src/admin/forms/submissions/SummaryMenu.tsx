'use client'

/**
 * SummaryMenu — per-column summary picker in the spreadsheet footer.
 * Shows the computed value (e.g. "SUM 41") and opens a small menu of
 * summary kinds: Sum/Avg for numeric columns, Empty/Filled for all.
 */

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronUp, Plus } from 'lucide-react'
import {
  SUMMARY_LABELS,
  summaryOptionsFor,
  type ColumnSpec,
  type SummaryKind,
} from '@/lib/submissions-table'

interface Props {
  spec: ColumnSpec
  value: SummaryKind
  /** Pre-computed summary text for the current (filtered) rows. */
  display: string
  onChange: (kind: SummaryKind) => void
}

interface PopPosition {
  bottom: number
  right: number
}

export default function SummaryMenu({ spec, value, display, onChange }: Props) {
  // Portaled + fixed for the same reason as ColumnMenu: the table's scroll
  // container would clip an absolutely-positioned popover. The footer sits
  // at the bottom, so this one opens upward.
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
    setPos({
      bottom: window.innerHeight - rect.top + 4,
      right: Math.max(8, window.innerWidth - rect.right),
    })
  }

  return (
    <div className="sv-sum" ref={rootRef}>
      <button
        type="button"
        className={`sv-sum__trigger${value === 'none' ? ' sv-sum__trigger--empty' : ''}`}
        aria-label={`Summary for ${spec.label}`}
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation()
          toggleOpen()
        }}
      >
        {value === 'none' ? (
          <Plus size={12} strokeWidth={1.75} aria-hidden />
        ) : (
          <>
            <span className="sv-sum__kind">{SUMMARY_LABELS[value]}</span>
            <span className="sv-sum__value">{display}</span>
            <ChevronUp size={11} strokeWidth={1.75} aria-hidden />
          </>
        )}
      </button>
      {open && createPortal(
        <div
          className="sv-menu__pop sv-menu__pop--up"
          ref={popRef}
          style={{ bottom: pos.bottom, right: pos.right }}
          onClick={(e) => e.stopPropagation()}
        >
          {summaryOptionsFor(spec).map((kind) => (
            <button
              key={kind}
              type="button"
              className={`sv-menu__item${value === kind ? ' sv-menu__item--active' : ''}`}
              onClick={() => {
                onChange(kind)
                setPos(null)
              }}
            >
              {SUMMARY_LABELS[kind]}
              {value === kind && <Check size={12} aria-hidden style={{ marginLeft: 'auto' }} />}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  )
}
