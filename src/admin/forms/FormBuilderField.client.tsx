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
import type { Field, FieldTypeId, FormSchema, LeafField } from '@/lib/form-schema'
import { FIELD_TYPES } from '@/lib/form-schema'
import { ensureStudentFields, hasRequiredRegistrationFields } from '@/lib/registration-fields'
import { PLATFORM_DOMAIN } from '@/lib/tenant-parse'
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
      // A repeatable-group's child names share the one form-wide namespace.
      if (f.type === 'repeatable-group') {
        for (const child of f.fields) names.add(child.name)
      }
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
  if (typeId === 'section') {
    return { type: 'section', id: common.id, name, label: 'Section' }
  }
  if (typeId === 'repeatable-group') {
    return {
      type: 'repeatable-group',
      id: common.id,
      name,
      label: 'Children',
      itemLabel: 'Child',
      min: 1,
      fields: [],
    }
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
  /** When set, the new field is added inside this repeatable-group's fields[]. */
  groupFieldId?: string
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
  const [tenantInfo, setTenantInfo] = useState<{ slug: string; customDomain: string | null } | null>(null)
  useEffect(() => {
    if (!tenantId) return
    let cancelled = false
    fetch(`/api/tenants/${tenantId}?depth=0`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { slug?: string; customDomains?: Array<{ domain?: string | null }> } | null) => {
        if (cancelled || !d?.slug) return
        setTenantInfo({
          slug: d.slug,
          customDomain: d.customDomains?.find((c) => c?.domain)?.domain ?? null,
        })
      })
      .catch(() => { /* fall back */ })
    return () => { cancelled = true }
  }, [tenantId])
  // Build an absolute public-form URL the same way ViewPublicSiteLink does:
  // the tenant's custom domain when set, otherwise the platform subdomain.
  // The current host can't be used as a base — on the platform admin host
  // (admin.<domain>) prefixing the slug would produce a dead hostname.
  const publicHref = (() => {
    if (!slugValue) return null
    const path = `/forms/${slugValue}`
    if (typeof window === 'undefined' || !tenantInfo) return path
    if (tenantInfo.customDomain) return `https://${tenantInfo.customDomain}${path}`
    const [hostname, port] = window.location.host.split(':')
    const isLocal =
      hostname === 'localhost' ||
      hostname.endsWith('.localhost') ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0'
    if (isLocal) {
      return `${window.location.protocol}//${tenantInfo.slug}.localhost${port ? `:${port}` : ''}${path}`
    }
    return `https://${tenantInfo.slug}.${PLATFORM_DOMAIN}${path}`
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

  // When the "Sunday school registration" flag is on, ensure the two required
  // student-name fields exist in the builder — injected instantly so the admin
  // sees them without saving. The guard makes this a no-op once the fields are
  // present, so it cannot loop.
  const { value: isSchoolReg } = useField<boolean>({ path: 'schoolRegistration' })
  useEffect(() => {
    if (isSchoolReg && !hasRequiredRegistrationFields(schema)) {
      setValue(ensureStudentFields(schema, randomId))
    }
  }, [isSchoolReg, schema, setValue])

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

      // Adding a child field inside a repeatable-group's fields[].
      if (position.groupFieldId) {
        // Child fields may only be leaf inputs (one nesting level).
        if (field.type === 'page-break' || field.type === 'section' || field.type === 'repeatable-group') {
          setPopoverAt(null)
          return
        }
        const child = field as LeafField
        const nextSteps = schema.steps.map((step, si) => {
          if (si !== position.stepIndex) return step
          const fields = step.fields.map((f) => {
            if (f.id !== position.groupFieldId || f.type !== 'repeatable-group') return f
            const childFields = [...f.fields]
            if (position.afterFieldId === null) {
              childFields.unshift(child)
            } else {
              const idx = childFields.findIndex((c) => c.id === position.afterFieldId)
              childFields.splice(idx + 1, 0, child)
            }
            return { ...f, fields: childFields }
          })
          return { ...step, fields }
        })
        updateSchema({ ...schema, steps: nextSteps })
        setSelectedFieldId(child.id)
        setPopoverAt(null)
        return
      }

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
    (fieldId: string, groupFieldId?: string) => {
      const existingNames = collectNames(schema)

      if (groupFieldId) {
        const nextSteps = schema.steps.map((step) => ({
          ...step,
          fields: step.fields.map((f) => {
            if (f.id !== groupFieldId || f.type !== 'repeatable-group') return f
            const idx = f.fields.findIndex((c) => c.id === fieldId)
            if (idx === -1) return f
            const orig = f.fields[idx]
            const copy = { ...orig, id: randomId(), name: uniqueName(orig.name, existingNames) } as LeafField
            const childFields = [...f.fields]
            childFields.splice(idx + 1, 0, copy)
            return { ...f, fields: childFields }
          }),
        }))
        updateSchema({ ...schema, steps: nextSteps })
        return
      }

      const nextSteps = schema.steps.map((step) => {
        const idx = step.fields.findIndex((f) => f.id === fieldId)
        if (idx === -1) return step
        const orig = step.fields[idx]
        const newName =
          orig.type !== 'page-break' && 'name' in orig
            ? uniqueName(orig.name, existingNames)
            : uniqueName('copy', existingNames)
        if ('name' in orig) existingNames.add(newName)
        let copy: Field = { ...orig, id: randomId(), ...('name' in orig ? { name: newName } : {}) } as Field
        // Duplicating a group must give its children fresh ids + unique names.
        if (copy.type === 'repeatable-group') {
          copy = {
            ...copy,
            fields: copy.fields.map((c) => {
              const childName = uniqueName(c.name, existingNames)
              existingNames.add(childName)
              return { ...c, id: randomId(), name: childName }
            }),
          }
        }
        const fields = [...step.fields]
        fields.splice(idx + 1, 0, copy)
        return { ...step, fields }
      })
      updateSchema({ ...schema, steps: nextSteps })
    },
    [schema, updateSchema],
  )

  const deleteField = useCallback(
    (fieldId: string, groupFieldId?: string) => {
      const nextSteps = schema.steps.map((step) => ({
        ...step,
        fields: groupFieldId
          ? step.fields.map((f) =>
              f.id === groupFieldId && f.type === 'repeatable-group'
                ? { ...f, fields: f.fields.filter((c) => c.id !== fieldId) }
                : f,
            )
          : step.fields.filter((f) => f.id !== fieldId),
      }))
      updateSchema({ ...schema, steps: nextSteps })
      if (selectedFieldId === fieldId) setSelectedFieldId(null)
    },
    [schema, updateSchema, selectedFieldId],
  )

  const updateField = useCallback(
    (updated: Field, groupFieldId?: string) => {
      const nextSteps = schema.steps.map((step) => ({
        ...step,
        fields: step.fields.map((f) => {
          if (groupFieldId) {
            if (f.id === groupFieldId && f.type === 'repeatable-group') {
              return {
                ...f,
                fields: f.fields.map((c) => (c.id === updated.id ? (updated as LeafField) : c)),
              }
            }
            return f
          }
          return f.id === updated.id ? updated : f
        }),
      }))
      updateSchema({ ...schema, steps: nextSteps })
    },
    [schema, updateSchema],
  )

  // ------------------------------------------------------------------
  // DnD handlers (D3)
  // ------------------------------------------------------------------

  // Build a map from fieldId -> its location. `groupFieldId` is set for child
  // fields living inside a repeatable-group's fields[].
  interface FieldLoc {
    stepIndex: number
    groupFieldId?: string
  }
  function buildFieldStepMap(): Map<string, FieldLoc> {
    const map = new Map<string, FieldLoc>()
    schema.steps.forEach((step, si) => {
      step.fields.forEach((f) => {
        map.set(f.id, { stepIndex: si })
        if (f.type === 'repeatable-group') {
          f.fields.forEach((c) => map.set(c.id, { stepIndex: si, groupFieldId: f.id }))
        }
      })
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
    const src = fieldStepMap.get(active.id as string)
    const dst = fieldStepMap.get(over.id as string)

    if (!src || !dst) return

    // Child fields only reorder within their own group; never drag a child out
    // of its group, into another group, or a top-level field into a group.
    if ((src.groupFieldId ?? null) !== (dst.groupFieldId ?? null)) return

    // Reorder within a repeatable-group's child fields.
    if (src.groupFieldId) {
      const nextSteps = schema.steps.map((step, si) => {
        if (si !== src.stepIndex) return step
        return {
          ...step,
          fields: step.fields.map((f) => {
            if (f.id !== src.groupFieldId || f.type !== 'repeatable-group') return f
            const oldIdx = f.fields.findIndex((c) => c.id === active.id)
            const newIdx = f.fields.findIndex((c) => c.id === over.id)
            if (oldIdx === -1 || newIdx === -1) return f
            const childFields = [...f.fields]
            const [moved] = childFields.splice(oldIdx, 1)
            childFields.splice(newIdx, 0, moved)
            return { ...f, fields: childFields }
          }),
        }
      })
      updateSchema({ ...schema, steps: nextSteps })
      return
    }

    if (src.stepIndex === dst.stepIndex) {
      // Intra-step reorder
      const step = schema.steps[src.stepIndex]
      const oldIdx = step.fields.findIndex((f) => f.id === active.id)
      const newIdx = step.fields.findIndex((f) => f.id === over.id)
      if (oldIdx === -1 || newIdx === -1) return

      const newFields = [...step.fields]
      const [moved] = newFields.splice(oldIdx, 1)
      newFields.splice(newIdx, 0, moved)

      const nextSteps = schema.steps.map((s, i) =>
        i === src.stepIndex ? { ...s, fields: newFields } : s,
      )
      updateSchema({ ...schema, steps: nextSteps })
    } else {
      // Cross-step reorder
      const srcStep = schema.steps[src.stepIndex]
      const dstStep = schema.steps[dst.stepIndex]

      const srcFields = [...srcStep.fields]
      const srcIdx = srcFields.findIndex((f) => f.id === active.id)
      if (srcIdx === -1) return
      const [movedField] = srcFields.splice(srcIdx, 1)

      const dstFields = [...dstStep.fields]
      const dstIdx = dstFields.findIndex((f) => f.id === over.id)
      dstFields.splice(dstIdx >= 0 ? dstIdx : dstFields.length, 0, movedField)

      const nextSteps = schema.steps.map((s, i) => {
        if (i === src.stepIndex) return { ...s, fields: srcFields }
        if (i === dst.stepIndex) return { ...s, fields: dstFields }
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
  let selectedFieldGroupId: string | undefined
  for (const step of schema.steps) {
    const found = step.fields.find((f) => f.id === selectedFieldId)
    if (found) { selectedField = found; break }
    // Look inside repeatable-groups for a selected child field.
    for (const f of step.fields) {
      if (f.type === 'repeatable-group') {
        const child = f.fields.find((c) => c.id === selectedFieldId)
        if (child) { selectedField = child; selectedFieldGroupId = f.id; break }
      }
    }
    if (selectedField) break
  }

  // Active dragging field (for overlay)
  let activeDragField: Field | undefined
  if (activeId) {
    for (const step of schema.steps) {
      const found = step.fields.find((f) => f.id === activeId)
      if (found) { activeDragField = found; break }
      for (const f of step.fields) {
        if (f.type === 'repeatable-group') {
          const child = f.fields.find((c) => c.id === activeId)
          if (child) { activeDragField = child; break }
        }
      }
      if (activeDragField) break
    }
  }

  // ------------------------------------------------------------------
  // Render helpers
  // ------------------------------------------------------------------

  function AddPill({
    stepIndex,
    afterFieldId,
    groupFieldId,
  }: {
    stepIndex: number
    afterFieldId: string | null
    groupFieldId?: string
  }) {
    const key = `${stepIndex}-${groupFieldId ?? 'root'}-${afterFieldId ?? 'top'}`
    const isOpen =
      popoverAt?.stepIndex === stepIndex &&
      popoverAt?.afterFieldId === afterFieldId &&
      (popoverAt?.groupFieldId ?? undefined) === groupFieldId

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
            setPopoverAt(isOpen ? null : { stepIndex, afterFieldId, groupFieldId })
          }
        >
          <Plus size={12} />
          Add field
        </button>
        {isOpen && (
          <AddFieldPopover
            leafOnly={!!groupFieldId}
            onAdd={(typeId) => addField(typeId, { stepIndex, afterFieldId, groupFieldId })}
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
                    if (field.type === 'repeatable-group') {
                      const childIds = field.fields.map((c) => c.id)
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
                          <div className="fb-group-children">
                            <AddPill
                              key={`pill-${step.id}-${field.id}-top`}
                              stepIndex={si}
                              afterFieldId={null}
                              groupFieldId={field.id}
                            />
                            <SortableContext
                              items={childIds}
                              strategy={verticalListSortingStrategy}
                            >
                              {field.fields.map((child, ci) => (
                                <div key={child.id}>
                                  <SortableFieldCard
                                    field={child}
                                    selected={selectedFieldId === child.id}
                                    onSelect={() =>
                                      setSelectedFieldId(
                                        selectedFieldId === child.id ? null : child.id,
                                      )
                                    }
                                    onDuplicate={() => duplicateField(child.id, field.id)}
                                    onDelete={() => deleteField(child.id, field.id)}
                                  />
                                  <AddPill
                                    key={`pill-${step.id}-${field.id}-${ci}`}
                                    stepIndex={si}
                                    afterFieldId={child.id}
                                    groupFieldId={field.id}
                                  />
                                </div>
                              ))}
                            </SortableContext>
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
          onChange={(updated) => updateField(updated, selectedFieldGroupId)}
          onClose={() => setSelectedFieldId(null)}
        />
      )}
    </div>
  )
}
