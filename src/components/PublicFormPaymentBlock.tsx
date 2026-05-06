'use client'
/**
 * PublicFormPaymentBlock — payment amount selection widget.
 *
 * Renders inside the public form on the last step when payment is enabled.
 * Artboards: 5.1 / 5.2 payment block.
 */
import { useState } from 'react'
import { Heart, ExternalLink } from 'lucide-react'

interface Props {
  mode: 'fixed' | 'suggested'
  priceCents?: number
  suggestedAmountsCents?: number[]
  allowCustomAmount?: boolean
  currency?: string
  description?: string
  onChange: (amountCents: number) => void
}

function formatAmount(cents: number): string {
  const dollars = cents / 100
  return Number.isInteger(dollars) ? `$${dollars}` : `$${dollars.toFixed(2)}`
}

export function PublicFormPaymentBlock({
  mode,
  priceCents,
  suggestedAmountsCents = [],
  allowCustomAmount = false,
  description,
  onChange,
}: Props) {
  const [selected, setSelected] = useState<number | null>(null)
  const [customValue, setCustomValue] = useState('')

  function selectTile(amt: number) {
    setSelected(amt)
    setCustomValue('')
    onChange(amt)
  }

  function handleCustomChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value
    setCustomValue(raw)
    setSelected(null)
    const parsed = parseFloat(raw)
    if (!isNaN(parsed) && parsed > 0) {
      onChange(Math.round(parsed * 100))
    }
  }

  return (
    <div className="om-pf-pay">
      {/* Header */}
      <div className="om-pf-pay-header">
        <Heart size={18} className="om-pf-pay-heart" aria-hidden="true" />
        <span className="om-pf-pay-heading">
          {description ?? 'Make a contribution'}
        </span>
      </div>

      {/* Fixed mode — single amount display */}
      {mode === 'fixed' && typeof priceCents === 'number' && (
        <p className="om-pf-pay-fixed">
          Amount: <strong>{formatAmount(priceCents)}</strong>
        </p>
      )}

      {/* Suggested mode — tile grid */}
      {mode === 'suggested' && suggestedAmountsCents.length > 0 && (
        <div className="om-pf-pay-grid" role="group" aria-label="Select a donation amount">
          {suggestedAmountsCents.map((amt) => (
            <button
              key={amt}
              type="button"
              className={`om-pf-pay-tile${selected === amt ? ' is-selected' : ''}`}
              onClick={() => selectTile(amt)}
              aria-pressed={selected === amt}
            >
              {formatAmount(amt)}
            </button>
          ))}
        </div>
      )}

      {/* Custom amount input */}
      {mode === 'suggested' && allowCustomAmount && (
        <label className="om-pf-pay-custom">
          Other amount
          <input
            type="number"
            min="1"
            step="1"
            placeholder="Enter amount in dollars"
            value={customValue}
            onChange={handleCustomChange}
          />
        </label>
      )}

      {/* Stripe note */}
      <p className="om-pf-pay-note">
        <ExternalLink size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} aria-hidden="true" />
        You&apos;ll be taken to <strong>Stripe</strong> to complete payment.{' '}
        Form data is held until payment succeeds.
      </p>
    </div>
  )
}
