'use client'

import { useCallback, useRef, useState } from 'react'
import { X, GripVertical, Plus, Trash2, Info } from 'lucide-react'
import type { Field } from '@/lib/form-schema'
import { FIELD_TYPES } from '@/lib/form-schema'
import FieldTypeIcon from './FieldTypeIcon'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DrawerTab = 'general' | 'validation' | 'logic'

// Field types where placeholder doesn't apply
const NO_PLACEHOLDER_TYPES = new Set([
  'dropdown',
  'radio',
  'multiselect',
  'checkbox-group',
  'consent',
  'page-break',
])

// Field types that have options
const HAS_OPTIONS_TYPES = new Set(['dropdown', 'radio', 'multiselect', 'checkbox-group'])

function getTypeLabel(type: Field['type']): string {
  return FIELD_TYPES.find((t) => t.id === type)?.label ?? type
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s_]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    || 'untitled'
}

// ---------------------------------------------------------------------------
// Option row for options editor
// ---------------------------------------------------------------------------

interface OptionRowProps {
  value: string
  label: string
  onValueChange: (v: string) => void
  onLabelChange: (v: string) => void
  onDelete: () => void
}

function OptionRow({ value, label, onValueChange, onLabelChange, onDelete }: OptionRowProps) {
  return (
    <div className="fb-drawer-option-row">
      <span className="fb-drawer-option-grip">
        <GripVertical size={14} />
      </span>
      <input
        className="fb-drawer-input fb-drawer-input--mono"
        type="text"
        placeholder="value"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        aria-label="Option value"
        style={{ flex: '0 0 110px' }}
      />
      <input
        className="fb-drawer-input"
        type="text"
        placeholder="Label"
        value={label}
        onChange={(e) => onLabelChange(e.target.value)}
        aria-label="Option label"
        style={{ flex: '1' }}
      />
      <button
        type="button"
        className="fb-drawer-icon-btn fb-drawer-icon-btn--danger"
        onClick={onDelete}
        title="Delete option"
      >
        <Trash2 size={13} />
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// General tab body
// ---------------------------------------------------------------------------

interface GeneralTabProps {
  field: Field
  onChange: (updated: Field) => void
}

function GeneralTab({ field, onChange }: GeneralTabProps) {
  // Track whether the field name has been manually edited so we stop auto-slugging
  const nameWasEdited = useRef(
    'name' in field && !!field.name && field.name !== slugify('untitled'),
  )
  const [showNameWarning, setShowNameWarning] = useState(false)

  if (field.type === 'page-break') {
    return (
      <div className="fb-drawer-body">
        <p className="fb-drawer-note">Page break has no configurable properties.</p>
      </div>
    )
  }

  const currentField = field as Extract<Field, { label: string }>

  function handleLabelChange(newLabel: string) {
    const updated: typeof currentField = { ...currentField, label: newLabel }
    // Auto-slug the field name if user hasn't manually edited it
    if (!nameWasEdited.current) {
      ;(updated as { name: string }).name = slugify(newLabel)
    }
    onChange(updated as Field)
  }

  function handleNameChange(newName: string) {
    const hadExisting = !!currentField.name
    nameWasEdited.current = true
    if (hadExisting) {
      setShowNameWarning(true)
    }
    onChange({ ...currentField, name: newName } as Field)
  }

  function handleHelpTextChange(val: string) {
    onChange({ ...currentField, helpText: val } as Field)
  }

  function handlePlaceholderChange(val: string) {
    onChange({ ...currentField, placeholder: val } as Field)
  }

  function handleRequiredChange(checked: boolean) {
    if (currentField.type === 'consent') return // consent always required
    onChange({ ...currentField, required: checked } as Field)
  }

  // Options editor (dropdown/radio/multiselect/checkbox-group)
  const hasOptions = HAS_OPTIONS_TYPES.has(currentField.type)
  const options =
    hasOptions && 'options' in currentField ? (currentField as { options: Array<{ value: string; label: string }> }).options : null

  function handleOptionChange(
    idx: number,
    key: 'value' | 'label',
    val: string,
  ) {
    if (!options) return
    const next = options.map((o, i) => (i === idx ? { ...o, [key]: val } : o))
    onChange({ ...currentField, options: next } as Field)
  }

  function handleOptionDelete(idx: number) {
    if (!options) return
    const next = options.filter((_, i) => i !== idx)
    // Keep at least one option
    if (next.length === 0) return
    onChange({ ...currentField, options: next } as Field)
  }

  function handleAddOption() {
    if (!options) return
    const n = options.length + 1
    const next = [
      ...options,
      { value: `option_${n}`, label: `Option ${n}` },
    ]
    onChange({ ...currentField, options: next } as Field)
  }

  const showPlaceholder = !NO_PLACEHOLDER_TYPES.has(currentField.type)
  const isConsentField = currentField.type === 'consent'

  return (
    <div className="fb-drawer-body">
      {/* Label */}
      <div className="fb-drawer-field">
        <label className="fb-drawer-label">Label</label>
        <input
          className="fb-drawer-input"
          type="text"
          value={currentField.label}
          onChange={(e) => handleLabelChange(e.target.value)}
          placeholder="Field label"
        />
      </div>

      {/* Field name */}
      <div className="fb-drawer-field">
        <label className="fb-drawer-label">Field name</label>
        <input
          className="fb-drawer-input fb-drawer-input--mono"
          type="text"
          value={currentField.name}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder="field_name"
        />
        {showNameWarning && (
          <p className="fb-drawer-warning">
            Changing the field name may break webhooks/CSV exports for existing submissions.
          </p>
        )}
      </div>

      {/* Help text */}
      <div className="fb-drawer-field">
        <label className="fb-drawer-label">Help text</label>
        <input
          className="fb-drawer-input"
          type="text"
          value={'helpText' in currentField ? (currentField.helpText ?? '') : ''}
          onChange={(e) => handleHelpTextChange(e.target.value)}
          placeholder="Optional hint below the field"
        />
      </div>

      {/* Placeholder */}
      {showPlaceholder && (
        <div className="fb-drawer-field">
          <label className="fb-drawer-label">Placeholder</label>
          <input
            className="fb-drawer-input"
            type="text"
            value={'placeholder' in currentField ? (currentField.placeholder ?? '') : ''}
            onChange={(e) => handlePlaceholderChange(e.target.value)}
            placeholder="Placeholder text"
          />
        </div>
      )}

      {/* Options editor */}
      {hasOptions && options && (
        <div className="fb-drawer-field">
          <label className="fb-drawer-label">Options</label>
          <div className="fb-drawer-options-list">
            {options.map((opt, idx) => (
              <OptionRow
                key={idx}
                value={opt.value}
                label={opt.label}
                onValueChange={(v) => handleOptionChange(idx, 'value', v)}
                onLabelChange={(v) => handleOptionChange(idx, 'label', v)}
                onDelete={() => handleOptionDelete(idx)}
              />
            ))}
          </div>
          <button
            type="button"
            className="fb-drawer-add-option-btn"
            onClick={handleAddOption}
          >
            <Plus size={13} />
            Add option
          </button>
        </div>
      )}

      {/* Behavior section */}
      <div className="fb-drawer-section-divider" />
      <div className="fb-drawer-section-title">Behavior</div>

      {/* Required toggle */}
      <div className="fb-drawer-toggle-row">
        <span className="fb-drawer-toggle-label">Required</span>
        <label className="fb-drawer-toggle">
          <input
            type="checkbox"
            checked={'required' in currentField ? !!currentField.required : false}
            onChange={(e) => handleRequiredChange(e.target.checked)}
            disabled={isConsentField}
          />
          <span className="fb-drawer-toggle-slider" />
        </label>
      </div>

      {/* Show on review step — disabled placeholder */}
      <div
        className="fb-drawer-toggle-row fb-drawer-toggle-row--disabled"
        title="Review step coming soon"
      >
        <span className="fb-drawer-toggle-label">Show on review step</span>
        <label className="fb-drawer-toggle">
          <input type="checkbox" disabled checked={false} onChange={() => {}} />
          <span className="fb-drawer-toggle-slider" />
        </label>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Validation tab body
// ---------------------------------------------------------------------------

interface ValidationTabProps {
  field: Field
  onChange: (updated: Field) => void
}

function ValidationTab({ field, onChange }: ValidationTabProps) {
  if (field.type === 'page-break') {
    return (
      <div className="fb-drawer-body">
        <p className="fb-drawer-note">No validation options for page break.</p>
      </div>
    )
  }

  const currentField = field as Extract<Field, { label: string }>

  if (currentField.type === 'number') {
    const numField = currentField as Extract<Field, { type: 'number' }>
    return (
      <div className="fb-drawer-body">
        <div className="fb-drawer-field">
          <label className="fb-drawer-label">Minimum value</label>
          <input
            className="fb-drawer-input"
            type="number"
            value={numField.min ?? ''}
            onChange={(e) =>
              onChange({
                ...numField,
                min: e.target.value === '' ? undefined : Number(e.target.value),
              } as Field)
            }
            placeholder="No minimum"
          />
        </div>
        <div className="fb-drawer-field">
          <label className="fb-drawer-label">Maximum value</label>
          <input
            className="fb-drawer-input"
            type="number"
            value={numField.max ?? ''}
            onChange={(e) =>
              onChange({
                ...numField,
                max: e.target.value === '' ? undefined : Number(e.target.value),
              } as Field)
            }
            placeholder="No maximum"
          />
        </div>
      </div>
    )
  }

  if (
    currentField.type === 'short-text' ||
    currentField.type === 'long-text' ||
    currentField.type === 'phone'
  ) {
    // maxLength not in schema but we store it as an extra property gracefully
    const maxLength = (currentField as { maxLength?: number }).maxLength
    return (
      <div className="fb-drawer-body">
        <div className="fb-drawer-field">
          <label className="fb-drawer-label">Max length (characters)</label>
          <input
            className="fb-drawer-input"
            type="number"
            min={1}
            value={maxLength ?? ''}
            onChange={(e) =>
              onChange({
                ...(currentField as unknown as Record<string, unknown>),
                maxLength: e.target.value === '' ? undefined : Number(e.target.value),
              } as unknown as Field)
            }
            placeholder="No limit"
          />
        </div>
      </div>
    )
  }

  return (
    <div className="fb-drawer-body">
      <p className="fb-drawer-note">No validation options for this field type.</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Logic tab body (disabled placeholder)
// ---------------------------------------------------------------------------

function LogicTab() {
  return (
    <div className="fb-drawer-body fb-drawer-body--centered">
      <div className="fb-drawer-logic-placeholder">
        <div className="fb-drawer-logic-icon">
          <Info size={24} />
        </div>
        <p className="fb-drawer-logic-title">Conditional logic</p>
        <p className="fb-drawer-logic-desc">
          Show or hide this field based on other answers — coming soon.
        </p>
        <button type="button" className="fb-drawer-logic-cta" disabled>
          Set up logic
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// PropertiesDrawer
// ---------------------------------------------------------------------------

interface PropertiesDrawerProps {
  field: Field
  onChange: (updated: Field) => void
  onClose: () => void
}

export default function PropertiesDrawer({ field, onChange, onClose }: PropertiesDrawerProps) {
  const [activeTab, setActiveTab] = useState<DrawerTab>('general')

  const handleTabChange = useCallback((tab: DrawerTab) => {
    if (tab === 'logic') return // logic tab is disabled
    setActiveTab(tab)
  }, [])

  const typeLabel = getTypeLabel(field.type)
  const fieldName = 'name' in field ? field.name : ''

  return (
    <aside className="fb-drawer" role="complementary" aria-label="Field properties">
      {/* Header */}
      <div className="fb-drawer-header">
        <span className="fb-drawer-header-icon">
          <FieldTypeIcon type={field.type} size={15} />
        </span>
        <div className="fb-drawer-header-meta">
          <span className="fb-drawer-header-type">{typeLabel}</span>
          {fieldName && (
            <span className="fb-drawer-header-name">{fieldName}</span>
          )}
        </div>
        <button
          type="button"
          className="fb-drawer-close"
          onClick={onClose}
          aria-label="Close properties drawer"
        >
          <X size={16} />
        </button>
      </div>

      {/* Tabs */}
      <div className="fb-drawer-tabs" role="tablist">
        {(['general', 'validation', 'logic'] as DrawerTab[]).map((tab) => {
          const isDisabled = tab === 'logic'
          const isActive = activeTab === tab
          return (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-disabled={isDisabled}
              className={[
                'fb-drawer-tab',
                isActive ? 'fb-drawer-tab--active' : '',
                isDisabled ? 'fb-drawer-tab--disabled' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => handleTabChange(tab)}
              tabIndex={isDisabled ? -1 : 0}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          )
        })}
      </div>

      {/* Tab panels */}
      <div className="fb-drawer-panel" role="tabpanel">
        {activeTab === 'general' && (
          <GeneralTab field={field} onChange={onChange} />
        )}
        {activeTab === 'validation' && (
          <ValidationTab field={field} onChange={onChange} />
        )}
        {activeTab === 'logic' && <LogicTab />}
      </div>
    </aside>
  )
}
