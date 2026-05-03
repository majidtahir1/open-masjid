'use client'

import { useState } from 'react'
import { Heart } from 'lucide-react'

export interface DonateFund {
  id: string | number
  name: string
  description?: string | null
  zakatEligible?: boolean
  suggestedAmounts?: { amount: number }[]
}

export default function DonateForm({ funds }: { funds: DonateFund[] }) {
  const [fundId, setFundId] = useState<string | number>(funds[0]?.id ?? '')
  const fund = funds.find((f) => String(f.id) === String(fundId))
  const [amount, setAmount] = useState<number>(fund?.suggestedAmounts?.[0]?.amount ?? 50)
  const [custom, setCustom] = useState('')
  const [frequency, setFrequency] = useState<'one_time' | 'monthly'>('one_time')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dollars = custom ? Number(custom) : amount

  async function submit() {
    setError(null)
    setPending(true)
    try {
      const cents = Math.round(dollars * 100)
      const res = await fetch('/api/donations/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fundId, amountCents: cents, frequency }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'failed')
      window.location.href = data.url
    } catch (e) {
      setError((e as Error).message)
      setPending(false)
    }
  }

  return (
    <div className="mx-auto max-w-[520px] rounded-[var(--r-md)] border border-border bg-white p-8 shadow-sh-sm">
      <div className="mb-3 font-body text-fs-xs font-semibold uppercase tracking-caps text-fg3">
        Choose a fund
      </div>
      <div className="mb-6 grid gap-2">
        {funds.map((f) => (
          <button
            key={String(f.id)}
            type="button"
            onClick={() => setFundId(f.id)}
            className={`flex items-center justify-between rounded-[var(--r-md)] border px-4 py-3 text-left font-body text-fs-base transition-colors ${
              String(fundId) === String(f.id)
                ? 'border-brand bg-brand-soft text-fg1'
                : 'border-border bg-white text-fg2 hover:border-border-teal'
            }`}
          >
            <span className="font-semibold">{f.name}</span>
            {f.zakatEligible && (
              <span className="rounded-pill bg-accent-soft px-3 py-1 font-body text-fs-xs uppercase tracking-caps text-fg1">
                Zakat
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="mb-3 font-body text-fs-xs font-semibold uppercase tracking-caps text-fg3">
        Choose an amount
      </div>
      <div className="mb-3 grid grid-cols-3 gap-2">
        {(fund?.suggestedAmounts ?? [{ amount: 25 }, { amount: 50 }, { amount: 100 }]).map((a) => (
          <button
            key={a.amount}
            type="button"
            onClick={() => {
              setAmount(a.amount)
              setCustom('')
            }}
            className={`rounded-[var(--r-md)] border px-4 py-3 font-body text-fs-base font-semibold transition-colors ${
              !custom && amount === a.amount
                ? 'border-brand bg-brand-soft text-fg1'
                : 'border-border bg-bg-alt text-fg2 hover:border-border-teal'
            }`}
          >
            ${a.amount}
          </button>
        ))}
      </div>
      <input
        type="number"
        inputMode="decimal"
        min={1}
        placeholder="Other amount"
        value={custom}
        onChange={(e) => setCustom(e.target.value)}
        className="mb-6 w-full rounded-[var(--r-md)] border border-border bg-white px-4 py-3 font-body text-fs-base text-fg1 placeholder:text-fg3 focus:border-brand focus:outline-none"
      />

      <div className="mb-3 font-body text-fs-xs font-semibold uppercase tracking-caps text-fg3">
        Frequency
      </div>
      <div className="mb-6 grid grid-cols-2 gap-2">
        {(['one_time', 'monthly'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFrequency(f)}
            className={`rounded-[var(--r-md)] border px-4 py-3 font-body text-fs-base font-semibold transition-colors ${
              frequency === f
                ? 'border-brand bg-brand-soft text-fg1'
                : 'border-border bg-bg-alt text-fg2 hover:border-border-teal'
            }`}
          >
            {f === 'one_time' ? 'One-time' : 'Monthly'}
          </button>
        ))}
      </div>

      {error && <p className="mb-3 font-body text-fs-sm text-danger">{error}</p>}

      <button
        type="button"
        disabled={pending || dollars < 1}
        onClick={submit}
        className="inline-flex w-full items-center justify-center gap-2 rounded-[var(--r-md)] bg-brand px-6 py-[14px] font-body text-fs-base font-semibold text-white shadow-sh-sm transition-all duration-base ease-out hover:-translate-y-px hover:bg-brand-hover hover:shadow-sh-md disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
      >
        <Heart size={18} strokeWidth={1.75} />
        {pending ? 'Redirecting…' : `Give $${(dollars || 0).toFixed(0)} ${frequency === 'monthly' ? '/month' : ''}`}
      </button>
    </div>
  )
}
