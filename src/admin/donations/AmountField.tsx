'use client'

import { useField, FieldLabel } from '@payloadcms/ui'

/**
 * Detail-view field for `donations.amount`. The column stores cents — render
 * it as a human-readable currency string. Read-only by virtue of having no
 * input element.
 */
export default function AmountField({ path = 'amount' }: { path?: string }) {
  const { value } = useField<number>({ path })
  const { value: currencyValue } = useField<string>({ path: 'currency' })
  const cents = typeof value === 'number' ? value : Number(value ?? 0)
  const currency = (typeof currencyValue === 'string' ? currencyValue : 'usd').toUpperCase()
  const formatted = Number.isFinite(cents)
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100)
    : '—'
  return (
    <div className="field-type number read-only">
      <FieldLabel label="Amount" path={path} />
      <div
        style={{
          padding: '10px 12px',
          border: '1px solid var(--theme-elevation-150)',
          borderRadius: 4,
          background: 'var(--theme-elevation-50)',
          color: 'var(--theme-elevation-800)',
          fontFamily: 'inherit',
        }}
      >
        {formatted}
      </div>
    </div>
  )
}
