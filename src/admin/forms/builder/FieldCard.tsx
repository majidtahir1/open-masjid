'use client'

import { GripVertical, Trash2, Copy } from 'lucide-react'
import type { Field } from '@/lib/form-schema'
import { FIELD_TYPES } from '@/lib/form-schema'
import FieldTypeIcon from './FieldTypeIcon'

interface FieldCardProps {
  field: Field
  selected: boolean
  onSelect: () => void
  onDuplicate: () => void
  onDelete: () => void
}

function FieldPreview({ field }: { field: Field }) {
  if (field.type === 'page-break') return null

  switch (field.type) {
    case 'short-text':
    case 'email':
    case 'phone':
    case 'number':
    case 'date':
      return (
        <div className="fb-preview-input">
          <span className="fb-preview-placeholder">
            {field.placeholder ?? `Enter ${field.label.toLowerCase()}...`}
          </span>
        </div>
      )
    case 'long-text':
      return (
        <div className="fb-preview-input fb-preview-input--textarea">
          <span className="fb-preview-placeholder">
            {field.placeholder ?? `Enter ${field.label.toLowerCase()}...`}
          </span>
        </div>
      )
    case 'dropdown':
      return (
        <div className="fb-preview-input" style={{ justifyContent: 'space-between' }}>
          <span className="fb-preview-placeholder">Select an option</span>
          <FieldTypeIcon type="dropdown" size={14} />
        </div>
      )
    case 'radio':
      return (
        <div>
          {(field.options ?? []).slice(0, 3).map((opt) => (
            <div key={opt.value} className="fb-preview-option">
              <span className="fb-preview-radio" />
              {opt.label}
            </div>
          ))}
          {(field.options ?? []).length > 3 && (
            <div className="fb-preview-option" style={{ color: 'var(--theme-elevation-350)', fontSize: 11 }}>
              +{field.options.length - 3} more
            </div>
          )}
        </div>
      )
    case 'multiselect':
    case 'checkbox-group':
      return (
        <div>
          {(field.options ?? []).slice(0, 3).map((opt) => (
            <div key={opt.value} className="fb-preview-option">
              <span className="fb-preview-checkbox" />
              {opt.label}
            </div>
          ))}
          {(field.options ?? []).length > 3 && (
            <div className="fb-preview-option" style={{ color: 'var(--theme-elevation-350)', fontSize: 11 }}>
              +{field.options.length - 3} more
            </div>
          )}
        </div>
      )
    case 'consent':
      return (
        <div className="fb-preview-consent">
          <span className="fb-preview-checkbox" />
          I agree to the terms
        </div>
      )
    default:
      return null
  }
}

function getTypeLabel(type: Field['type']): string {
  return FIELD_TYPES.find((t) => t.id === type)?.label ?? type
}

export default function FieldCard({
  field,
  selected,
  onSelect,
  onDuplicate,
  onDelete,
}: FieldCardProps) {
  if (field.type === 'page-break') {
    // Page-break rendered as a divider inline in the canvas
    return null
  }

  const isRequired = 'required' in field ? field.required : false
  const helpText = 'helpText' in field ? field.helpText : undefined

  return (
    <div
      className={`fb-card${selected ? ' fb-card--selected' : ''}`}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
    >
      {/* Grip handle — visually present, wired in D3 */}
      <div className="fb-card-grip" onClick={(e) => e.stopPropagation()}>
        <GripVertical size={14} />
      </div>

      {/* Body */}
      <div className="fb-card-body">
        <div className="fb-card-header">
          <span className="fb-card-label">{field.label || 'Untitled'}</span>
          {isRequired && <span className="fb-card-required">*</span>}
          <span className="fb-type-pill">
            <FieldTypeIcon type={field.type} size={11} />
            {getTypeLabel(field.type)}
          </span>
        </div>
        {helpText && <div className="fb-card-help">{helpText}</div>}
        <div className="fb-preview">
          <FieldPreview field={field} />
        </div>
      </div>

      {/* Actions — shown on hover / selected */}
      <div className="fb-card-actions" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="fb-card-action-btn"
          title="Duplicate"
          onClick={onDuplicate}
        >
          <Copy size={13} />
        </button>
        <button
          type="button"
          className="fb-card-action-btn fb-card-action-btn--danger"
          title="Delete"
          onClick={onDelete}
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )
}
