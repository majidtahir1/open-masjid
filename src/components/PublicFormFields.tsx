/**
 * PublicFormFields — renders a list of form fields by type.
 *
 * Supported types: short-text, email, phone, long-text, number, date,
 * dropdown, radio, multiselect, checkbox-group, consent.
 * (page-break is filtered upstream and returned as null here.)
 */
import type { Field } from '@/lib/form-schema'

interface Props {
  fields: Field[]
  values: Record<string, unknown>
  errors: Record<string, string>
  onChange: (name: string, value: unknown) => void
}

export function PublicFormFields({ fields, values, errors, onChange }: Props) {
  return (
    <div className="om-pf-fields">
      {fields.map((f) => {
        if (f.type === 'page-break') return null
        const err = errors[f.name]
        const v = values[f.name]
        return (
          <div
            key={f.id}
            className="om-pf-field"
            data-error={err !== undefined && err !== '' ? '' : undefined}
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
            {renderControl(f, v, (val) => onChange(f.name, val))}
            {err && (
              <p className="om-pf-field-error" role="alert">
                {err}
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}

function renderControl(f: Field, v: unknown, onChange: (v: unknown) => void) {
  switch (f.type) {
    case 'short-text':
    case 'phone':
      return (
        <input
          id={`f-${f.id}`}
          type="text"
          placeholder={'placeholder' in f ? (f.placeholder ?? '') : ''}
          value={String(v ?? '')}
          className={v ? 'is-filled' : ''}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={f.type === 'phone' ? 'tel' : 'off'}
        />
      )

    case 'email':
      return (
        <input
          id={`f-${f.id}`}
          type="email"
          placeholder={'placeholder' in f ? (f.placeholder ?? '') : ''}
          value={String(v ?? '')}
          className={v ? 'is-filled' : ''}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="email"
          inputMode="email"
        />
      )

    case 'long-text':
      return (
        <textarea
          id={`f-${f.id}`}
          placeholder={'placeholder' in f ? (f.placeholder ?? '') : ''}
          rows={5}
          value={String(v ?? '')}
          className={v ? 'is-filled' : ''}
          onChange={(e) => onChange(e.target.value)}
        />
      )

    case 'number':
      return (
        <input
          id={`f-${f.id}`}
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
        />
      )

    case 'date':
      return (
        <input
          id={`f-${f.id}`}
          type="date"
          value={String(v ?? '')}
          className={v ? 'is-filled' : ''}
          onChange={(e) => onChange(e.target.value)}
        />
      )

    case 'dropdown':
      return (
        <select
          id={`f-${f.id}`}
          value={String(v ?? '')}
          onChange={(e) => onChange(e.target.value)}
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
        <div className="om-pf-radio" role="radiogroup">
          {f.options.map((o) => (
            <label key={o.value} className="om-pf-radio-item">
              <input
                type="radio"
                name={f.name}
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
        <div className="om-pf-checks">
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

    case 'consent':
      return (
        <label className="om-pf-consent" htmlFor={`f-${f.id}`}>
          <input
            id={`f-${f.id}`}
            type="checkbox"
            checked={v === true}
            onChange={(e) => onChange(e.target.checked)}
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
