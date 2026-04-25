'use client'

import { FieldLabel, useField } from '@payloadcms/ui'
import { DynamicIcon, iconNames, type IconName } from 'lucide-react/dynamic'
import React, { useDeferredValue, useMemo, useState } from 'react'
import { Grid, type CellComponentProps } from 'react-window'

import LucideIconByName from '@/components/LucideIcon'

// Full Lucide catalog (~1,600 names, kebab-case).
const ALL_ICONS: string[] = [...(iconNames as string[])].sort()

interface Props {
  path: string
  field?: { label?: string | false; required?: boolean; admin?: { description?: string } }
}

const COLUMNS = 6
const CELL_HEIGHT = 80
const GRID_HEIGHT = 360

type CellProps = {
  filtered: string[]
  selected: string
  onPick: (name: string) => void
}

function IconCell({
  columnIndex,
  rowIndex,
  style,
  filtered,
  selected,
  onPick,
}: CellComponentProps<CellProps>) {
  const index = rowIndex * COLUMNS + columnIndex
  const name = filtered[index]
  if (!name) return <div style={style} />
  const active = name === selected
  return (
    <div style={style}>
      <button
        type="button"
        onClick={() => onPick(name)}
        title={name}
        style={{
          width: 'calc(100% - 6px)',
          height: 'calc(100% - 6px)',
          margin: 3,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          padding: '6px 4px',
          border: `1px solid ${
            active
              ? 'var(--theme-elevation-800, #0F1E4A)'
              : 'var(--theme-elevation-150, #e2e8f0)'
          }`,
          borderRadius: 6,
          background: active
            ? 'var(--theme-elevation-100, #f1f5f9)'
            : 'var(--theme-elevation-0, #fff)',
          color: 'var(--theme-text)',
          cursor: 'pointer',
        }}
      >
        <DynamicIcon name={name as IconName} size={22} strokeWidth={1.75} />
        <span
          style={{
            fontSize: 9,
            textAlign: 'center',
            color: 'var(--theme-text-light, #64748b)',
            lineHeight: 1.1,
            wordBreak: 'break-all',
            maxWidth: '100%',
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {name}
        </span>
      </button>
    </div>
  )
}

/**
 * Visual, searchable, virtualized Lucide icon picker.
 *
 * Only icons currently on-screen are mounted — react-window recycles DOM
 * nodes on scroll — so we get the full ~1,600-icon catalog without paying
 * the render + import cost up front. Each visible icon is rendered via
 * `DynamicIcon`, which code-splits the individual SVG on first appearance.
 */
export default function IconPickerField({ path, field }: Props) {
  const { value, setValue } = useField<string>({ path })
  const [query, setQuery] = useState('')
  const deferred = useDeferredValue(query)

  const selected = typeof value === 'string' ? value : ''

  const filtered = useMemo(() => {
    const q = deferred.trim().toLowerCase().replace(/\s+/g, '-')
    if (!q) return ALL_ICONS
    return ALL_ICONS.filter((n) => n.includes(q))
  }, [deferred])

  const label = field?.label === false ? undefined : field?.label ?? undefined
  const required = field?.required ?? false
  const description = field?.admin?.description

  const rowCount = Math.max(1, Math.ceil(filtered.length / COLUMNS))

  return (
    <div className="field-type" style={{ marginBottom: '1rem' }}>
      {label ? <FieldLabel label={label} required={required} /> : null}
      {description ? (
        <p
          style={{
            margin: '0 0 8px',
            color: 'var(--theme-text-light, #64748b)',
            fontSize: 12,
          }}
        >
          {description}
        </p>
      ) : null}

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 10,
        }}
      >
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${ALL_ICONS.length.toLocaleString()} icons…`}
          style={{
            flex: 1,
            padding: '8px 12px',
            borderRadius: 4,
            border: '1px solid var(--theme-elevation-200, #cbd5e1)',
            fontSize: 14,
            background: 'var(--theme-elevation-0, #fff)',
            color: 'var(--theme-text)',
          }}
        />
        {selected ? (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 10px',
              background: 'var(--theme-elevation-50, #f8fafc)',
              border: '1px solid var(--theme-elevation-150, #e2e8f0)',
              borderRadius: 4,
              fontSize: 12,
              color: 'var(--theme-text-light, #64748b)',
            }}
          >
            <LucideIconByName name={selected} size={16} />
            <code style={{ fontSize: 12 }}>{selected}</code>
            <button
              type="button"
              onClick={() => setValue('')}
              title="Clear selection"
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--theme-text-light, #64748b)',
                fontSize: 16,
                padding: 0,
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </span>
        ) : null}
      </div>

      <div
        style={{
          border: '1px solid var(--theme-elevation-150, #e2e8f0)',
          borderRadius: 6,
          overflow: 'hidden',
          background: 'var(--theme-elevation-0, #fff)',
        }}
      >
        {filtered.length === 0 ? (
          <div
            style={{
              padding: 40,
              textAlign: 'center',
              color: 'var(--theme-text-light, #64748b)',
              fontSize: 13,
            }}
          >
            No icons match <code>{deferred}</code>. Try a different search term.
          </div>
        ) : (
          <Grid
            cellComponent={IconCell}
            cellProps={{ filtered, selected, onPick: setValue } satisfies CellProps}
            columnCount={COLUMNS}
            columnWidth={`${100 / COLUMNS}%` as unknown as number}
            defaultHeight={GRID_HEIGHT}
            rowCount={rowCount}
            rowHeight={CELL_HEIGHT}
            style={{ height: GRID_HEIGHT, width: '100%' }}
          />
        )}
      </div>
    </div>
  )
}
