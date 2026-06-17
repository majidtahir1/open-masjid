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
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (createMode || !programId) return
    api(`/terms/${programId}?depth=0`).then((t) => {
      if (t) {
        setTerm(t); setName(t.name ?? ''); setStart(day(t.startDate))
        setEnd(day(t.endDate)); setDays(Array.isArray(t.meetingDays) && t.meetingDays.length ? t.meetingDays : ['sunday'])
        setHolidays((t.holidays ?? []).map((h: any) => day(h.date)).filter(Boolean))
      }
    }).catch(() => {})
  }, [programId, createMode])

  const toggleHoliday = (iso: string) =>
    setHolidays((prev) => (prev.includes(iso) ? prev.filter((d) => d !== iso) : [...prev, iso]))

  const save = async () => {
    setBusy(true); setError('')
    try {
      const data = {
        name, startDate, endDate, meetingDays, status: 'active',
        holidays: holidays.map((d) => ({ date: d })),
      }
      const saved = term
        ? await api(`/terms/${term.id}`, { method: 'PATCH', body: JSON.stringify(data) }).then((r) => r.doc)
        : await api('/terms', { method: 'POST', body: JSON.stringify(data) }).then((r) => r.doc)
      setTerm(saved)
      if (saved?.id != null) onProgram?.(saved.id)
      onChanged()
    } catch (e) {
      setError((e as Error).message)
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

      {error && <p className="ss-error">{error}</p>}

      <div className="ss-foot">
        <button className="ss-btn ss-btn--ghost" disabled={busy || !name || !startDate || !endDate || meetingDays.length === 0} onClick={save}>
          {term ? 'Save program' : 'Create program'}
        </button>
        <button className="ss-btn" disabled={!term} onClick={onNext}>
          Next: Classes <ArrowRight size={17} />
        </button>
      </div>
    </div>
  )
}

export default StepTerm
