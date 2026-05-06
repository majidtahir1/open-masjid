'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useField } from '@payloadcms/ui'
import { Plus, LayoutTemplate } from 'lucide-react'
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Field, FieldTypeId, FormSchema } from '@/lib/form-schema'
import { FIELD_TYPES } from '@/lib/form-schema'
import FieldCard from './builder/FieldCard'
import AddFieldPopover from './builder/AddFieldPopover'
import PropertiesDrawer from './builder/PropertiesDrawer'
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
  stepIndex: number
  afterFieldId: string | null
}

// ---------------------------------------------------------------------------
// Sortable FieldCard wrapper (D3)
// ---------------------------------------------------------------------------

interface SortableFieldCardProps {
  field: Field
  selected: boolean
  onSelect: () => void
  onDuplicate: () => void
  onDelete: () => void
}

function SortableFieldCard({
  field,
  selected,
  onSelect,
  onDuplicate,
  onDelete,
}: SortableFieldCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.id })

  // Suppress SSR hydration mismatch from dnd-kit's auto-generated
  // `aria-describedby="DndDescribedBy-N"` (the counter differs across renders).
  // Only attach drag attributes after the client has mounted.
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style}>
      <FieldCard
        field={field}
        selected={selected}
        onSelect={onSelect}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
        dragHandleProps={mounted ? { ...attributes, ...listeners } : undefined}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FormBuilderFieldClient(props: Record<string, unknown>) {
  const { value, setValue } = useField<FormSchema>({
    potentiallyStalePath: (props.path as string) ?? 'schema',
  })

  // Sibling fields for the public-URL link
  const { value: slugValue } = useField<string>({ path: 'slug' })
  const { value: tenantField } = useField<string | { id: string | number } | null>({
    path: 'tenant',
  })
  const tenantId =
    tenantField && typeof tenantField === 'object' && 'id' in tenantField
      ? tenantField.id
      : (tenantField as string | number | null)
  const [tenantSlug, setTenantSlug] = useState<string | null>(null)
  useEffect(() => {
    if (!tenantId) return
    let cancelled = false
    fetch(`/api/tenants/${tenantId}?depth=0`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled && d?.slug) setTenantSlug(d.slug) })
      .catch(() => { /* fall back */ })
    return () => { cancelled = true }
  }, [tenantId])
  const publicHref = (() => {
    if (!slugValue) return null
    if (typeof window === 'undefined') return `/forms/${slugValue}`
    const host = window.location.host
    const firstLabel = host.split(':')[0].split('.')[0].toLowerCase()
    const isBareLocal = firstLabel === 'localhost' || firstLabel === '127' || firstLabel === '0'
    const isAdminHost = firstLabel === 'admin'
    if ((isBareLocal || isAdminHost) && tenantSlug) {
      return `${window.location.protocol}//${tenantSlug}.${host}/forms/${slugValue}`
    }
    return `/forms/${slugValue}`
  })()

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
  const [activeId, setActiveId] = useState<string | null>(null)
  const popoverAnchorRef = useRef<Map<string, HTMLElement>>(new Map())

  const totalSteps = schema.steps.length

  // DnD sensors (pointer + keyboard for accessibility)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

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

  const updateField = useCallback(
    (updated: Field) => {
      const nextSteps = schema.steps.map((step) => ({
        ...step,
        fields: step.fields.map((f) => (f.id === updated.id ? updated : f)),
      }))
      updateSchema({ ...schema, steps: nextSteps })
    },
    [schema, updateSchema],
  )

  // ------------------------------------------------------------------
  // DnD handlers (D3)
  // ------------------------------------------------------------------

  // Build a map from fieldId -> stepIndex for quick lookup
  function buildFieldStepMap(): Map<string, number> {
    const map = new Map<string, number>()
    schema.steps.forEach((step, si) => {
      step.fields.forEach((f) => map.set(f.id, si))
    })
    return map
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string)
    setPopoverAt(null)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null)
    const { active, over } = event
    if (!over || active.id === over.id) return

    const fieldStepMap = buildFieldStepMap()
    const srcStepIdx = fieldStepMap.get(active.id as string)
    const dstStepIdx = fieldStepMap.get(over.id as string)

    if (srcStepIdx === undefined || dstStepIdx === undefined) return

    if (srcStepIdx === dstStepIdx) {
      // Intra-step reorder
      const step = schema.steps[srcStepIdx]
      const oldIdx = step.fields.findIndex((f) => f.id === active.id)
      const newIdx = step.fields.findIndex((f) => f.id === over.id)
      if (oldIdx === -1 || newIdx === -1) return

      const newFields = [...step.fields]
      const [moved] = newFields.splice(oldIdx, 1)
      newFields.splice(newIdx, 0, moved)

      const nextSteps = schema.steps.map((s, i) =>
        i === srcStepIdx ? { ...s, fields: newFields } : s,
      )
      updateSchema({ ...schema, steps: nextSteps })
    } else {
      // Cross-step reorder
      const srcStep = schema.steps[srcStepIdx]
      const dstStep = schema.steps[dstStepIdx]

      const srcFields = [...srcStep.fields]
      const srcIdx = srcFields.findIndex((f) => f.id === active.id)
      if (srcIdx === -1) return
      const [movedField] = srcFields.splice(srcIdx, 1)

      const dstFields = [...dstStep.fields]
      const dstIdx = dstFields.findIndex((f) => f.id === over.id)
      dstFields.splice(dstIdx >= 0 ? dstIdx : dstFields.length, 0, movedField)

      const nextSteps = schema.steps.map((s, i) => {
        if (i === srcStepIdx) return { ...s, fields: srcFields }
        if (i === dstStepIdx) return { ...s, fields: dstFields }
        return s
      })
      updateSchema({ ...schema, steps: nextSteps })
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function handleDragOver(_event: DragOverEvent) {
    // No-op: we handle everything in dragEnd for simplicity
  }

  // ------------------------------------------------------------------
  // Selected field
  // ------------------------------------------------------------------

  let selectedField: Field | undefined
  for (const step of schema.steps) {
    const found = step.fields.find((f) => f.id === selectedFieldId)
    if (found) { selectedField = found; break }
  }

  // Active dragging field (for overlay)
  let activeDragField: Field | undefined
  if (activeId) {
    for (const step of schema.steps) {
      const found = step.fields.find((f) => f.id === activeId)
      if (found) { activeDragField = found; break }
    }
  }

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

  // Collect all field IDs per step for SortableContext
  const stepFieldIds = schema.steps.map((step) => step.fields.map((f) => f.id))

  return (
    <div className="fb-layout">
      <div className="fb-layout-canvas">
        {publicHref && (
          <div className="fb-canvas-toolbar">
            <a
              href={publicHref}
              target="_blank"
              rel="noopener noreferrer"
              className="fb-canvas-toolbar__link"
            >
              View public form ↗
            </a>
          </div>
        )}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
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
              const elements: React.ReactNode[] = []

              if (totalSteps > 1) {
                elements.push(
                  <div key={`step-heading-${step.id}`} className="fb-step-header">
                    Step {si + 1}
                  </div>,
                )
              }

              elements.push(
                <AddPill key={`pill-top-${step.id}`} stepIndex={si} afterFieldId={null} />,
              )

              const sortableIds = stepFieldIds[si]

              elements.push(
                <SortableContext
                  key={`sortable-${step.id}`}
                  items={sortableIds}
                  strategy={verticalListSortingStrategy}
                >
                  {step.fields.map((field, fi) => {
                    if (field.type === 'page-break') {
                      const stepsBefore = si
                      return (
                        <div key={field.id}>
                          <SortableFieldCard
                            field={field}
                            selected={false}
                            onSelect={() => {}}
                            onDuplicate={() => duplicateField(field.id)}
                            onDelete={() => deleteField(field.id)}
                          />
                          <div className="fb-page-break">
                            <div className="fb-page-break-line" />
                            <span className="fb-page-break-label">
                              Step {stepsBefore + 1} of {totalSteps}
                            </span>
                            <div className="fb-page-break-line" />
                          </div>
                          <AddPill
                            key={`pill-${step.id}-${fi}`}
                            stepIndex={si}
                            afterFieldId={field.id}
                          />
                        </div>
                      )
                    }
                    return (
                      <div key={field.id}>
                        <SortableFieldCard
                          field={field}
                          selected={selectedFieldId === field.id}
                          onSelect={() =>
                            setSelectedFieldId(selectedFieldId === field.id ? null : field.id)
                          }
                          onDuplicate={() => duplicateField(field.id)}
                          onDelete={() => deleteField(field.id)}
                        />
                        <AddPill
                          key={`pill-${step.id}-${fi}`}
                          stepIndex={si}
                          afterFieldId={field.id}
                        />
                      </div>
                    )
                  })}
                </SortableContext>,
              )

              return <div key={step.id}>{elements}</div>
            })}
          </div>

          {/* DragOverlay — keeps the dragged item visible */}
          <DragOverlay>
            {activeDragField ? (
              <div style={{ opacity: 0.85 }}>
                <FieldCard
                  field={activeDragField}
                  selected={false}
                  onSelect={() => {}}
                  onDuplicate={() => {}}
                  onDelete={() => {}}
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Properties drawer (D2) */}
      {selectedField && (
        <PropertiesDrawer
          field={selectedField}
          onChange={updateField}
          onClose={() => setSelectedFieldId(null)}
        />
      )}
    </div>
  )
}
