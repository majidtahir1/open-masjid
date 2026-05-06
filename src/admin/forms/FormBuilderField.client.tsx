'use client'

import { useCallback, useRef, useState } from 'react'
import { useField } from '@payloadcms/ui'
import { Plus, LayoutTemplate } from 'lucide-react'
import type { Field, FieldTypeId, FormSchema } from '@/lib/form-schema'
import { FIELD_TYPES } from '@/lib/form-schema'
import FieldCard from './builder/FieldCard'
import AddFieldPopover from './builder/AddFieldPopover'
import './builder.css'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function randomId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
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

function uniqueName(base: string, existing: Set<string>): string {
  if (!existing.has(base)) return base
  let n = 2
  while (existing.has(`${base}_${n}`)) n++
  return `${base}_${n}`
}

function collectNames(schema: FormSchema): Set<string> {
  const names = new Set<string>()
  for (const step of schema.steps) {
    for (const f of step.fields) {
      if (f.type !== 'page-break' && 'name' in f) names.add(f.name)
    }
  }
  return names
}

function makeDefaultField(typeId: FieldTypeId, existingNames: Set<string>): Field {
  const baseName = slugify(FIELD_TYPES.find((t) => t.id === typeId)?.label ?? 'untitled')
  const name = uniqueName(baseName, existingNames)
  const common = {
    id: randomId(),
    name,
    label: 'Untitled',
    required: false as const,
  }

  if (typeId === 'page-break') {
    return { type: 'page-break', id: common.id, name }
  }
  if (typeId === 'consent') {
    return { type: 'consent', ...common, label: 'I agree', required: true as const }
  }
  const hasOptions = FIELD_TYPES.find((t) => t.id === typeId)?.hasOptions ?? false
  if (hasOptions) {
    return {
      type: typeId as 'dropdown' | 'radio' | 'multiselect' | 'checkbox-group',
      ...common,
      options: [{ value: 'option_1', label: 'Option 1' }],
    } as Field
  }
  return { type: typeId, ...common } as Field
}

// ---------------------------------------------------------------------------
// Popover position state
// ---------------------------------------------------------------------------

interface PopoverPosition {
  /** Index of the step containing the insertion point */
  stepIndex: number
  /** Insert after this field id; null = before all fields in the step */
  afterFieldId: string | null
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FormBuilderFieldClient(props: Record<string, unknown>) {
  // Payload v3 uses potentiallyStalePath to avoid re-registering on every render
  const { value, setValue } = useField<FormSchema>({
    potentiallyStalePath: (props.path as string) ?? 'schema',
  })

  // Normalise: Payload may store raw JSON as a string or as null
  const schema: FormSchema = (() => {
    if (!value) return { steps: [{ id: 's1', fields: [] }] }
    if (typeof value === 'string') {
      try {
        return JSON.parse(value) as FormSchema
      } catch {
        return { steps: [{ id: 's1', fields: [] }] }
      }
    }
    return value
  })()

  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null)
  const [popoverAt, setPopoverAt] = useState<PopoverPosition | null>(null)
  const popoverAnchorRef = useRef<Map<string, HTMLElement>>(new Map())

  const totalSteps = schema.steps.length

  // ------------------------------------------------------------------
  // Mutators
  // ------------------------------------------------------------------

  const updateSchema = useCallback(
    (next: FormSchema) => {
      setValue(next)
    },
    [setValue],
  )

  const addField = useCallback(
    (typeId: FieldTypeId, position: PopoverPosition) => {
      const existingNames = collectNames(schema)
      const field = makeDefaultField(typeId, existingNames)

      const nextSteps = schema.steps.map((step, si) => {
        if (si !== position.stepIndex) return step
        const fields = [...step.fields]
        if (position.afterFieldId === null) {
          fields.unshift(field)
        } else {
          const idx = fields.findIndex((f) => f.id === position.afterFieldId)
          fields.splice(idx + 1, 0, field)
        }
        return { ...step, fields }
      })

      updateSchema({ ...schema, steps: nextSteps })
      setSelectedFieldId(field.id)
      setPopoverAt(null)
    },
    [schema, updateSchema],
  )

  const duplicateField = useCallback(
    (fieldId: string) => {
      const existingNames = collectNames(schema)
      const nextSteps = schema.steps.map((step) => {
        const idx = step.fields.findIndex((f) => f.id === fieldId)
        if (idx === -1) return step
        const orig = step.fields[idx]
        const newName =
          orig.type !== 'page-break' && 'name' in orig
            ? uniqueName(orig.name, existingNames)
            : uniqueName('copy', existingNames)
        const copy: Field = { ...orig, id: randomId(), ...('name' in orig ? { name: newName } : {}) } as Field
        const fields = [...step.fields]
        fields.splice(idx + 1, 0, copy)
        return { ...step, fields }
      })
      updateSchema({ ...schema, steps: nextSteps })
    },
    [schema, updateSchema],
  )

  const deleteField = useCallback(
    (fieldId: string) => {
      const nextSteps = schema.steps.map((step) => ({
        ...step,
        fields: step.fields.filter((f) => f.id !== fieldId),
      }))
      updateSchema({ ...schema, steps: nextSteps })
      if (selectedFieldId === fieldId) setSelectedFieldId(null)
    },
    [schema, updateSchema, selectedFieldId],
  )

  // ------------------------------------------------------------------
  // Render helpers
  // ------------------------------------------------------------------

  function AddPill({
    stepIndex,
    afterFieldId,
  }: {
    stepIndex: number
    afterFieldId: string | null
  }) {
    const key = `${stepIndex}-${afterFieldId ?? 'top'}`
    const isOpen =
      popoverAt?.stepIndex === stepIndex && popoverAt?.afterFieldId === afterFieldId

    return (
      <div
        className="fb-add-pill-wrap fb-popover-anchor"
        ref={(el) => {
          if (el) popoverAnchorRef.current.set(key, el)
          else popoverAnchorRef.current.delete(key)
        }}
      >
        <div className="fb-add-pill-line" />
        <button
          type="button"
          className="fb-add-pill"
          onClick={() =>
            setPopoverAt(isOpen ? null : { stepIndex, afterFieldId })
          }
        >
          <Plus size={12} />
          Add field
        </button>
        {isOpen && (
          <AddFieldPopover
            onAdd={(typeId) => addField(typeId, { stepIndex, afterFieldId })}
            onClose={() => setPopoverAt(null)}
          />
        )}
      </div>
    )
  }

  // ------------------------------------------------------------------
  // Canvas
  // ------------------------------------------------------------------

  const isEmpty = schema.steps.every((s) => s.fields.length === 0)

  return (
    <div className="fb-canvas">
      {isEmpty && (
        <div className="fb-empty">
          <div className="fb-empty-icon">
            <LayoutTemplate size={40} />
          </div>
          <div className="fb-empty-title">No fields yet</div>
          <div className="fb-empty-desc">
            Click &ldquo;+ Add field&rdquo; to start building your form.
          </div>
        </div>
      )}

      {schema.steps.map((step, si) => {
        // Flatten: render a page-break divider inline when encountered
        const elements: React.ReactNode[] = []

        // Show step heading only for multi-step forms
        if (totalSteps > 1) {
          elements.push(
            <div key={`step-heading-${step.id}`} className="fb-step-header">
              Step {si + 1}
            </div>,
          )
        }

        // "Add field" pill at the very top of the step
        elements.push(
          <AddPill key={`pill-top-${step.id}`} stepIndex={si} afterFieldId={null} />,
        )

        step.fields.forEach((field, fi) => {
          if (field.type === 'page-break') {
            // Count steps up to this point for the label
            const stepsBefore = si
            elements.push(
              <div key={field.id} className="fb-page-break">
                <div className="fb-page-break-line" />
                <span className="fb-page-break-label">
                  Step {stepsBefore + 1} of {totalSteps}
                </span>
                <div className="fb-page-break-line" />
              </div>,
            )
          } else {
            elements.push(
              <FieldCard
                key={field.id}
                field={field}
                selected={selectedFieldId === field.id}
                onSelect={() =>
                  setSelectedFieldId(selectedFieldId === field.id ? null : field.id)
                }
                onDuplicate={() => duplicateField(field.id)}
                onDelete={() => deleteField(field.id)}
              />,
            )
          }

          // "Add field" pill after every field
          elements.push(
            <AddPill
              key={`pill-${step.id}-${fi}`}
              stepIndex={si}
              afterFieldId={field.id}
            />,
          )
        })

        return <div key={step.id}>{elements}</div>
      })}
    </div>
  )
}
