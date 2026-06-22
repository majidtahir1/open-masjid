'use client'
import React, { useEffect, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { api } from '../api'
import SessionTimeline from '../SessionTimeline'
import { programDates } from '@/hooks/generateClassSessions'

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const day = (d: unknown) => String(d ?? '').slice(0, 10)

const StepTerm: React.FC<{ programId: string | null; createMode: boolean; onNext: () => void; onChanged: () => void; onProgram?: (id: string | number) => void }> = ({ programId, createMode, onNext, onChanged, onProgram }) => {
  const [term, setTerm] = useState<any>(null)
  const [name, setName] = useState('')
  const [startDate, setStart] = useState('')
  const [endDate, setEnd] = useState('')
  const [meetingDays, setDays] = useState<string[]>(['sunday'])
  const [holidays, setHolidays] = useState<string[]>([])
  const [paymentModel, setPaymentModel] = useState<'free' | 'one-time' | 'monthly'>('free')
  const [pricingModel, setPricingModel] = useState<'per-program' | 'per-class'>('per-program')
  const [tuition, setTuition] = useState('') // dollars, as typed
  const [discounts, setDiscounts] = useState<{ rank: number; percentOff: number }[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (createMode || !programId) return
    api(`/terms/${programId}?depth=0`).then((t) => {
      if (t) {
        setTerm(t); setName(t.name ?? ''); setStart(day(t.startDate))
        setEnd(day(t.endDate)); setDays(Array.isArray(t.meetingDays) && t.meetingDays.length ? t.meetingDays : ['sunday'])
        setHolidays((t.holidays ?? []).map((h: any) => day(h.date)).filter(Boolean))
        setPricingModel(t.pricingModel === 'per-class' ? 'per-class' : 'per-program')
        setTuition(typeof t.tuitionCents === 'number' ? String(t.tuitionCents / 100) : '')
        setPaymentModel(t.paymentModel === 'monthly' || t.paymentModel === 'one-time' ? t.paymentModel : 'free')
        setDiscounts(Array.isArray(t.multiChildDiscount)
          ? t.multiChildDiscount.map((d: any) => ({ rank: Number(d.rank), percentOff: Number(d.percentOff) }))
          : [])
      }
    }).catch(() => {})
  }, [programId, createMode])

  const toggleHoliday = (iso: string) =>
    setHolidays((prev) => (prev.includes(iso) ? prev.filter((d) => d !== iso) : [...prev, iso]))

  const ordinal = (n: number) => {
    const s = ['th', 'st', 'nd', 'rd'], v = n % 100
    return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`
  }
  const addDiscount = () =>
    setDiscounts((prev) => [...prev, { rank: prev.length ? Math.max(...prev.map((d) => d.rank)) + 1 : 2, percentOff: 0 }])
  const removeDiscount = (i: number) => setDiscounts((prev) => prev.filter((_, idx) => idx !== i))
  const updateDiscount = (i: number, val: string) => {
    const p = Math.max(0, Math.min(100, Number(val) || 0))
    setDiscounts((prev) => prev.map((d, idx) => (idx === i ? { ...d, percentOff: p } : d)))
  }

  const save = async (): Promise<boolean> => {
    setBusy(true); setError('')
    try {
      const parsedTuition = parseFloat(tuition)
      // Per-program: store the typed dollars as cents. Per-class (or free):
      // clear the program-level price (each class carries its own tuition).
      const tuitionCents =
        paymentModel !== 'free' && pricingModel === 'per-program' && Number.isFinite(parsedTuition)
          ? Math.round(parsedTuition * 100)
          : null
      const data = {
        name, startDate, endDate, meetingDays, status: 'active',
        holidays: holidays.map((d) => ({ date: d })),
        pricingModel, tuitionCents, paymentModel,
        multiChildDiscount: paymentModel === 'free' ? [] : discounts,
      }
      const saved = term
        ? await api(`/terms/${term.id}`, { method: 'PATCH', body: JSON.stringify(data) }).then((r) => r.doc)
        : await api('/terms', { method: 'POST', body: JSON.stringify(data) }).then((r) => r.doc)
      setTerm(saved)
      if (saved?.id != null) onProgram?.(saved.id)
      onChanged()
      return true
    } catch (e) {
      setError((e as Error).message)
      return false
    } finally {
      setBusy(false)
    }
  }

  const total = startDate && endDate ? programDates(startDate, endDate, meetingDays).length : 0
  const meeting = Math.max(total - holidays.length, 0)

  // Are the days off shown different from what's saved on the term?
  const savedHolidays = (term?.holidays ?? []).map((h: any) => day(h.date)).filter(Boolean)
  const key = (xs: string[]) => [...xs].sort().join(',')
  const holidaysDirty = key(holidays) !== key(savedHolidays)

  return (
    <div className="ss-card">
      <p className="ss-eyebrow">Step 1</p>
      <h2 className="ss-card__title">Name your program</h2>
      <p className="ss-card__hint">
        Set the dates and the day you meet each week. Every class you add gets a session for each of
        these days — created for you, no scheduling by hand.
      </p>

      <div className="ss-grid">
        <label className="ss-field"><span>Program name</span>
          <input className="ss-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Fall 2026" />
        </label>
        <label className="ss-field"><span>First day</span>
          <input className="ss-input" type="date" value={startDate} onChange={(e) => setStart(e.target.value)} />
        </label>
        <label className="ss-field"><span>Last day</span>
          <input className="ss-input" type="date" value={endDate} onChange={(e) => setEnd(e.target.value)} />
        </label>
        <div className="ss-field"><span>Meets on</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {WEEKDAYS.map((d) => {
              const on = meetingDays.includes(d)
              return (
                <button
                  key={d}
                  type="button"
                  className={`ss-status__btn is-present${on ? ' ss-status__btn--on' : ''}`}
                  style={{ borderRadius: 8, textTransform: 'capitalize' }}
                  aria-pressed={on}
                  onClick={() => setDays((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d])}
                >
                  {d.slice(0, 3)}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {startDate && endDate && (
        <div style={{ marginTop: 18 }}>
          <p className="ss-eyebrow" style={{ marginBottom: 2 }}>
            {meeting} sessions per class · click a week to mark a day off
          </p>
          <SessionTimeline
            startDate={startDate}
            endDate={endDate}
            meetingDays={meetingDays}
            holidays={holidays}
            onToggle={toggleHoliday}
            variant="inline"
          />
          <p className="ss-card__hint" style={{ margin: '8px 0 0' }}>
            {holidays.length === 0
              ? 'No days off. Click a week above to skip it (holidays, breaks).'
              : holidaysDirty
                ? `${holidays.length} day${holidays.length === 1 ? '' : 's'} off — save to apply.`
                : `${holidays.length} day${holidays.length === 1 ? '' : 's'} off, applied.`}
          </p>
        </div>
      )}

      <div className="ss-field" style={{ marginTop: 18 }}>
        <span>How families pay</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {([['free', 'Free'], ['one-time', 'One-time'], ['monthly', 'Monthly']] as const).map(([val, label]) => {
            const on = paymentModel === val
            return (
              <button
                key={val}
                type="button"
                className={`ss-status__btn is-present${on ? ' ss-status__btn--on' : ''}`}
                style={{ borderRadius: 8 }}
                aria-pressed={on}
                onClick={() => setPaymentModel(val)}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {paymentModel !== 'free' && (
        <>
          <div className="ss-field" style={{ marginTop: 12 }}>
            <span>Pricing</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {([['per-program', 'One price for the program'], ['per-class', 'Price per class']] as const).map(([val, label]) => {
                const on = pricingModel === val
                return (
                  <button
                    key={val}
                    type="button"
                    className={`ss-status__btn is-present${on ? ' ss-status__btn--on' : ''}`}
                    style={{ borderRadius: 8 }}
                    aria-pressed={on}
                    onClick={() => setPricingModel(val)}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>

          {pricingModel === 'per-program' ? (
            <label className="ss-field" style={{ marginTop: 10, maxWidth: 260 }}>
              <span>{paymentModel === 'monthly' ? 'Monthly tuition (per student)' : 'Amount (per student)'}</span>
              <div style={{ position: 'relative' }}>
                <span aria-hidden style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--theme-elevation-500)', fontWeight: 600 }}>$</span>
                <input
                  className="ss-input"
                  type="number"
                  min={0}
                  step="1"
                  inputMode="decimal"
                  value={tuition}
                  onChange={(e) => setTuition(e.target.value)}
                  placeholder="20"
                  style={{ paddingLeft: 24 }}
                />
              </div>
            </label>
          ) : (
            <p className="ss-card__hint" style={{ marginTop: 8 }}>
              You&apos;ll set each class&apos;s price in the next step (Classes).
            </p>
          )}

          <div className="ss-field" style={{ marginTop: 12 }}>
            <span>Sibling discounts (optional)</span>
            {discounts.length === 0 && (
              <p className="ss-card__hint" style={{ margin: '0 0 6px' }}>No discount — every child pays full price.</p>
            )}
            {discounts.map((d, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ minWidth: 78, color: 'var(--theme-elevation-600)' }}>{ordinal(d.rank)} child</span>
                <div style={{ position: 'relative' }}>
                  <input
                    className="ss-input"
                    type="number"
                    min={0}
                    max={100}
                    value={String(d.percentOff)}
                    onChange={(e) => updateDiscount(i, e.target.value)}
                    aria-label={`Discount for ${ordinal(d.rank)} child`}
                    style={{ width: 88, paddingRight: 26 }}
                  />
                  <span aria-hidden style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--theme-elevation-500)' }}>%</span>
                </div>
                <span style={{ color: 'var(--theme-elevation-500)', fontSize: 13 }}>off</span>
                <button type="button" className="ss-btn ss-btn--ghost" style={{ padding: '4px 10px' }} onClick={() => removeDiscount(i)}>Remove</button>
              </div>
            ))}
            <button type="button" className="ss-btn ss-btn--ghost" style={{ marginTop: 4 }} onClick={addDiscount}>
              + Add sibling discount
            </button>
          </div>
        </>
      )}

      {error && <p className="ss-error">{error}</p>}

      <div className="ss-foot">
        <button className="ss-btn ss-btn--ghost" disabled={busy || !name || !startDate || !endDate || meetingDays.length === 0} onClick={save}>
          {term ? 'Save program' : 'Create program'}
        </button>
        <button
          className="ss-btn"
          disabled={busy || !name || !startDate || !endDate || meetingDays.length === 0}
          onClick={async () => { if (await save()) onNext() }}
        >
          Next: Classes <ArrowRight size={17} />
        </button>
      </div>
    </div>
  )
}

export default StepTerm
