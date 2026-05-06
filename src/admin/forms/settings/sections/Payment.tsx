'use client'

import React from 'react'
import { useField } from '@payloadcms/ui'
import { X } from 'lucide-react'

interface AmountEntry {
  amount: number
  id?: string
}

/** Convert cents (stored) to a display dollar string */
const centsToDollars = (cents: number | null | undefined): string => {
  if (cents == null) return ''
  return (cents / 100).toFixed(2)
}

/** Parse a dollar string to cents (integer). Returns null if invalid. */
const dollarsToCents = (dollars: string): number | null => {
  const parsed = parseFloat(dollars)
  if (isNaN(parsed) || parsed < 0) return null
  return Math.round(parsed * 100)
}

export default function Payment() {
  const { value: enabled, setValue: setEnabled } = useField<boolean>({
    path: 'payment.enabled',
  })
  const { value: mode, setValue: setMode } = useField<'fixed' | 'suggested'>({
    path: 'payment.mode',
  })
  const { value: priceCents, setValue: setPriceCents } = useField<number | null>({
    path: 'payment.priceCents',
  })
  const { value: suggestedRaw, setValue: setSuggestedRaw } = useField<AmountEntry[]>({
    path: 'payment.suggestedAmountsCents',
  })
  const { value: allowCustom, setValue: setAllowCustom } = useField<boolean>({
    path: 'payment.allowCustomAmount',
  })
  const { value: currency, setValue: setCurrency } = useField<string>({
    path: 'payment.currency',
  })
  const { value: description, setValue: setDescription } = useField<string>({
    path: 'payment.description',
  })

  const suggestedAmounts: AmountEntry[] = Array.isArray(suggestedRaw) ? suggestedRaw : []
  const currentMode = mode ?? 'suggested'

  const addSuggestedAmount = () => {
    setSuggestedRaw([...suggestedAmounts, { amount: 0 }])
  }

  const updateSuggestedAmount = (idx: number, dollarStr: string) => {
    const cents = dollarsToCents(dollarStr)
    const updated = suggestedAmounts.map((entry, i) =>
      i === idx ? { ...entry, amount: cents ?? 0 } : entry,
    )
    setSuggestedRaw(updated)
  }

  const removeSuggestedAmount = (idx: number) => {
    setSuggestedRaw(suggestedAmounts.filter((_, i) => i !== idx))
  }

  return (
    <div className="settings-card">
      <h3 className="settings-card__title">Payment</h3>

      {/* Master toggle */}
      <div className="settings-toggle-row">
        <div>
          <div className="settings-toggle-label">Accept payment with this form</div>
          <div className="settings-toggle-desc">
            Funds settle directly into your masjid&apos;s connected Stripe account.
          </div>
        </div>
        <label className="settings-toggle" aria-label="Enable payment">
          <input
            type="checkbox"
            checked={!!enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          <span className="settings-toggle__track" />
        </label>
      </div>

      {/* Payment options — revealed when enabled */}
      {enabled && (
        <div className="settings-revealed">
          <div className="settings-grid-2">
            {/* Mode */}
            <div className="settings-field">
              <label className="settings-field__label" htmlFor="payment-mode">
                Pricing mode
              </label>
              <select
                id="payment-mode"
                className="settings-field__select"
                value={currentMode}
                onChange={(e) => setMode(e.target.value as 'fixed' | 'suggested')}
              >
                <option value="fixed">Fixed price</option>
                <option value="suggested">Suggested amounts</option>
              </select>
            </div>

            {/* Currency */}
            <div className="settings-field">
              <label className="settings-field__label" htmlFor="payment-currency">
                Currency
              </label>
              <select
                id="payment-currency"
                className="settings-field__select"
                value={currency ?? 'usd'}
                onChange={(e) => setCurrency(e.target.value)}
              >
                <option value="usd">USD — US Dollar</option>
                <option value="cad">CAD — Canadian Dollar</option>
                <option value="gbp">GBP — British Pound</option>
              </select>
            </div>
          </div>

          {/* Fixed price input */}
          {currentMode === 'fixed' && (
            <div className="settings-field">
              <label className="settings-field__label" htmlFor="payment-price">
                Price
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    padding: '8px 10px',
                    background: 'var(--theme-elevation-50, #f9fafb)',
                    border: '1px solid var(--theme-elevation-200, #d1d5db)',
                    borderRadius: '6px 0 0 6px',
                    borderRight: 'none',
                    fontSize: 14,
                    color: 'var(--theme-elevation-600, #4b5563)',
                  }}
                >
                  $
                </span>
                <input
                  id="payment-price"
                  type="number"
                  min={0}
                  step="0.01"
                  className="settings-field__input"
                  style={{ borderRadius: '0 6px 6px 0', width: 120 }}
                  value={centsToDollars(priceCents)}
                  onChange={(e) => {
                    const cents = dollarsToCents(e.target.value)
                    setPriceCents(cents)
                  }}
                  placeholder="0.00"
                />
              </div>
              <span className="settings-field__helper">Amount in dollars (stored as cents).</span>
            </div>
          )}

          {/* Suggested amounts */}
          {currentMode === 'suggested' && (
            <div className="settings-field">
              <label className="settings-field__label">Suggested amounts</label>
              <div className="settings-amounts-list">
                {suggestedAmounts.map((entry, idx) => (
                  <div key={idx} className="settings-amount-row">
                    <span
                      style={{
                        padding: '8px 10px',
                        background: 'var(--theme-elevation-50, #f9fafb)',
                        border: '1px solid var(--theme-elevation-200, #d1d5db)',
                        borderRadius: '6px 0 0 6px',
                        borderRight: 'none',
                        fontSize: 14,
                        color: 'var(--theme-elevation-600, #4b5563)',
                      }}
                    >
                      $
                    </span>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      className="settings-field__input"
                      style={{ borderRadius: '0 6px 6px 0', width: 100 }}
                      value={centsToDollars(entry.amount)}
                      onChange={(e) => updateSuggestedAmount(idx, e.target.value)}
                      placeholder="0.00"
                    />
                    <button
                      type="button"
                      className="settings-btn settings-btn--secondary"
                      onClick={() => removeSuggestedAmount(idx)}
                      style={{ padding: '8px 10px' }}
                      aria-label="Remove amount"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="settings-btn settings-btn--secondary"
                style={{ marginTop: 8, alignSelf: 'flex-start' }}
                onClick={addSuggestedAmount}
              >
                + Add amount
              </button>

              {/* Allow custom amount toggle */}
              <div className="settings-toggle-row" style={{ marginTop: 12 }}>
                <div className="settings-toggle-label" style={{ fontSize: 13 }}>
                  Allow custom amount
                </div>
                <label className="settings-toggle" aria-label="Allow custom amount">
                  <input
                    type="checkbox"
                    checked={allowCustom !== false}
                    onChange={(e) => setAllowCustom(e.target.checked)}
                  />
                  <span className="settings-toggle__track" />
                </label>
              </div>
            </div>
          )}

          {/* Description */}
          <div className="settings-field">
            <label className="settings-field__label" htmlFor="payment-desc">
              Payment description
            </label>
            <input
              id="payment-desc"
              type="text"
              className="settings-field__input"
              value={description ?? ''}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Eid dinner ticket"
            />
            <span className="settings-field__helper">
              Shown on the Stripe checkout page.
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
