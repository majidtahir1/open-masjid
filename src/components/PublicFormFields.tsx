/**
 * PublicFormFields — renders a list of form fields by type.
 *
 * Supported types: short-text, email, phone, long-text, number, date,
 * dropdown, radio, multiselect, checkbox-group, consent, section,
 * repeatable-group.
 * (page-break is filtered upstream and returned as null here.)
 */
import type { Field } from '@/lib/form-schema'

export interface ProgramClassOption {
  id: string | number
  name: string
  tuitionCents: number | null
}

interface Props {
  fields: Field[]
  values: Record<string, unknown>
  errors: Record<string, string>
  onChange: (name: string, value: unknown) => void
  /** Active classes of the bound program — options for `class-select` fields. */
  programClasses?: ProgramClassOption[]
  /**
   * Change handler for a child field inside a repeatable-group item.
   * Required only when the rendered fields include a repeatable-group.
   */
  onGroupChange?: (groupName: string, index: number, childName: string, value: unknown) => void
  /** Add a new (empty) item to a repeatable-group. */
  onGroupAdd?: (groupName: string) => void
  /** Remove the item at `index` from a repeatable-group. */
  onGroupRemove?: (groupName: string, index: number) => void
  /** When true, each field receives aria-invalid + aria-describedby when in error state. */
  announceErrors?: boolean
}

export function PublicFormFields({
  fields,
  values,
  errors,
  onChange,
  onGroupChange,
  onGroupAdd,
  onGroupRemove,
  programClasses = [],
}: Props) {
  return (
    <div className="om-pf-fields">
      {fields.map((f) => {
        // page-break is purely a step boundary and never renders here.
        if (f.type === 'page-break') return null

        // section: a visual heading + optional help text; it has no input.
        if (f.type === 'section') {
          return (
            <div key={f.id} className="om-pf-section">
              {f.label && <h3 className="om-pf-section-title">{f.label}</h3>}
            </div>
          )
        }

        // repeatable-group: render each item as a card of the group's child
        // fields, with per-item Remove and a single Add-another button.
        if (f.type === 'repeatable-group') {
          const items = (Array.isArray(values[f.name]) ? (values[f.name] as Record<string, unknown>[]) : [{}])
          const itemLabel = f.itemLabel ?? 'Item'
          const min = f.min ?? 0
          const max = f.max
          const canRemove = items.length > min
          const canAdd = max === undefined || items.length < max
          return (
            <div key={f.id} className="om-pf-group">
              {f.label && <h3 className="om-pf-group-title">{f.label}</h3>}
              {items.map((item, index) => (
                <div key={index} className="om-pf-group-item">
                  <div className="om-pf-group-item-head">
                    <span className="om-pf-group-item-label">
                      {itemLabel} {index + 1}
                    </span>
                    {canRemove && (
                      <button
                        type="button"
                        className="om-pf-group-remove"
                        onClick={() => onGroupRemove?.(f.name, index)}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  {f.fields.map((child) => {
                    const childVal = item?.[child.name]
                    const childErr = errors[`${f.name}.${index}.${child.name}`]
                    const childHasError = childErr !== undefined && childErr !== ''
                    const childErrorId = `f-${f.id}-${index}-${child.id}-error`
                    return (
                      <div
                        key={child.id}
                        className="om-pf-field"
                        data-error={childHasError ? '' : undefined}
                      >
                        {child.type !== 'consent' && (
                          <label className="om-pf-label" htmlFor={`f-${f.id}-${index}-${child.id}`}>
                            {child.label}
                            {child.required ? <span className="om-pf-req">*</span> : null}
                          </label>
                        )}
                        {'helpText' in child && child.helpText && (
                          <p className="om-pf-help">{child.helpText}</p>
                        )}
                        {renderControl(
                          child,
                          childVal,
                          (val) => onGroupChange?.(f.name, index, child.name, val),
                          childHasError,
                          childErrorId,
                          `f-${f.id}-${index}-${child.id}`,
                          programClasses,
                        )}
                        {childHasError && (
                          <p
                            id={childErrorId}
                            className="om-pf-field-error"
                            role="alert"
                            aria-live="polite"
                          >
                            {childErr}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}
              {canAdd && (
                <button
                  type="button"
                  className="om-pf-group-add"
                  onClick={() => onGroupAdd?.(f.name)}
                >
                  + Add another {itemLabel.toLowerCase()}
                </button>
              )}
            </div>
          )
        }

        const err = errors[f.name]
        const hasError = err !== undefined && err !== ''
        const v = values[f.name]
        const errorId = `f-${f.id}-error`
        return (
          <div
            key={f.id}
            className="om-pf-field"
            data-error={hasError ? '' : undefined}
          >
            {f.type !== 'consent' && (
              <label className="om-pf-label" htmlFor={`f-${f.id}`}>
                {f.label}
                {f.required ? <span className="om-pf-req">*</span> : null}
              </label>
            )}
            {'helpText' in f && f.helpText && (
              <p className="om-pf-help">{f.helpText}</p>
            )}
            {renderControl(f, v, (val) => onChange(f.name, val), hasError, errorId, `f-${f.id}`, programClasses)}
            {hasError && (
              <p
                id={errorId}
                className="om-pf-field-error"
                role="alert"
                aria-live="polite"
              >
                {err}
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}

function formatClassLabel(name: string, tuitionCents: number | null): string {
  if (tuitionCents === null || tuitionCents === undefined) return name
  const dollars = tuitionCents / 100
  const amount = Number.isInteger(dollars) ? String(dollars) : dollars.toFixed(2)
  return `${name} — $${amount}/mo`
}

function renderControl(
  f: Field,
  v: unknown,
  onChange: (v: unknown) => void,
  hasError: boolean,
  errorId: string,
  inputId: string,
  programClasses: ProgramClassOption[] = [],
) {
  const ariaProps = hasError
    ? { 'aria-invalid': true as const, 'aria-describedby': errorId }
    : {}

  switch (f.type) {
    case 'short-text':
    case 'phone':
      return (
        <input
          id={inputId}
          type="text"
          placeholder={'placeholder' in f ? (f.placeholder ?? '') : ''}
          value={String(v ?? '')}
          className={v ? 'is-filled' : ''}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={f.type === 'phone' ? 'tel' : 'off'}
          {...ariaProps}
        />
      )

    case 'email':
      return (
        <input
          id={inputId}
          type="email"
          placeholder={'placeholder' in f ? (f.placeholder ?? '') : ''}
          value={String(v ?? '')}
          className={v ? 'is-filled' : ''}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="email"
          inputMode="email"
          {...ariaProps}
        />
      )

    case 'long-text':
      return (
        <textarea
          id={inputId}
          placeholder={'placeholder' in f ? (f.placeholder ?? '') : ''}
          rows={5}
          value={String(v ?? '')}
          className={v ? 'is-filled' : ''}
          onChange={(e) => onChange(e.target.value)}
          {...ariaProps}
        />
      )

    case 'number':
      return (
        <input
          id={inputId}
          type="number"
          min={'min' in f && f.min !== undefined ? f.min : undefined}
          max={'max' in f && f.max !== undefined ? f.max : undefined}
          placeholder={'placeholder' in f ? (f.placeholder ?? '') : ''}
          value={v === undefined || v === null ? '' : String(v)}
          className={v !== undefined && v !== null && v !== '' ? 'is-filled' : ''}
          onChange={(e) =>
            onChange(e.target.value === '' ? undefined : Number(e.target.value))
          }
          inputMode="numeric"
          {...ariaProps}
        />
      )

    case 'date':
      return (
        <input
          id={inputId}
          type="date"
          value={String(v ?? '')}
          className={v ? 'is-filled' : ''}
          onChange={(e) => onChange(e.target.value)}
          {...ariaProps}
        />
      )

    case 'dropdown':
      return (
        <select
          id={inputId}
          value={String(v ?? '')}
          onChange={(e) => onChange(e.target.value)}
          {...ariaProps}
        >
          <option value="">Choose…</option>
          {f.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )

    case 'radio':
      return (
        <div
          className="om-pf-radio"
          role="radiogroup"
          aria-invalid={hasError ? true : undefined}
          aria-describedby={hasError ? errorId : undefined}
        >
          {f.options.map((o) => (
            <label key={o.value} className="om-pf-radio-item">
              <input
                type="radio"
                name={inputId}
                value={o.value}
                checked={v === o.value}
                onChange={() => onChange(o.value)}
              />
              <span>{o.label}</span>
            </label>
          ))}
        </div>
      )

    case 'multiselect':
    case 'checkbox-group': {
      const arr = Array.isArray(v) ? (v as string[]) : []
      return (
        <div
          className="om-pf-checks"
          role="group"
          aria-invalid={hasError ? true : undefined}
          aria-describedby={hasError ? errorId : undefined}
        >
          {f.options.map((o) => (
            <label key={o.value} className="om-pf-check-item">
              <input
                type="checkbox"
                checked={arr.includes(o.value)}
                onChange={(e) =>
                  onChange(
                    e.target.checked
                      ? [...arr, o.value]
                      : arr.filter((x) => x !== o.value),
                  )
                }
              />
              <span>{o.label}</span>
            </label>
          ))}
        </div>
      )
    }

    case 'class-select':
      return (
        <select
          id={inputId}
          value={String(v ?? '')}
          onChange={(e) => onChange(e.target.value)}
          {...ariaProps}
        >
          <option value="">Choose…</option>
          {programClasses.map((c) => (
            <option key={String(c.id)} value={String(c.id)}>
              {formatClassLabel(c.name, c.tuitionCents)}
            </option>
          ))}
        </select>
      )

    case 'consent':
      return (
        <label className="om-pf-consent" htmlFor={inputId}>
          <input
            id={inputId}
            type="checkbox"
            checked={v === true}
            onChange={(e) => onChange(e.target.checked)}
            {...ariaProps}
          />
          <span>
            {f.label}
            {f.required ? <span className="om-pf-req">*</span> : null}
          </span>
        </label>
      )

    default:
      return null
  }
}