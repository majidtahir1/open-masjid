'use client'
import React, { useEffect, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { api } from '../api'
import SessionTimeline from '../SessionTimeline'
import { weeklyDates } from '@/hooks/generateClassSessions'

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const day = (d: unknown) => String(d ?? '').slice(0, 10)

const StepTerm: React.FC<{ onNext: () => void; onChanged: () => void }> = ({ onNext, onChanged }) => {
  const [term, setTerm] = useState<any>(null)
  const [name, setName] = useState('')
  const [startDate, setStart] = useState('')
  const [endDate, setEnd] = useState('')
  const [meetingDay, setDay] = useState('sunday')
  const [holidays, setHolidays] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api('/terms?where[status][equals]=active&sort=-startDate&limit=1&depth=0').then((r) => {
      const t = r.docs[0]
      if (t) {
        setTerm(t); setName(t.name ?? ''); setStart(day(t.startDate))
        setEnd(day(t.endDate)); setDay(t.meetingDay ?? 'sunday')
        setHolidays((t.holidays ?? []).map((h: any) => day(h.date)).filter(Boolean))
      }
    }).catch(() => {})
  }, [])

  const toggleHoliday = (iso: string) =>
    setHolidays((prev) => (prev.includes(iso) ? prev.filter((d) => d !== iso) : [...prev, iso]))

  const save = async () => {
    setBusy(true); setError('')
    try {
      const data = {
        name, startDate, endDate, meetingDay, status: 'active',
        holidays: holidays.map((d) => ({ date: d })),
      }
      const saved = term
        ? await api(`/terms/${term.id}`, { method: 'PATCH', body: JSON.stringify(data) }).then((r) => r.doc)
        : await api('/terms', { method: 'POST', body: JSON.stringify(data) }).then((r) => r.doc)
      setTerm(saved)
      onChanged()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const total = startDate && endDate ? weeklyDates(startDate, endDate, meetingDay).length : 0
  const meeting = Math.max(total - holidays.length, 0)

  // Are the days off shown different from what's saved on the term?
  const savedHolidays = (term?.holidays ?? []).map((h: any) => day(h.date)).filter(Boolean)
  const key = (xs: string[]) => [...xs].sort().join(',')
  const holidaysDirty = key(holidays) !== key(savedHolidays)

  return (
    <div className="ss-card">
      <p className="ss-eyebrow">Step 1</p>
      <h2 className="ss-card__title">Name your term</h2>
      <p className="ss-card__hint">
        Set the dates and the day you meet each week. Every class you add gets a session for each of
        these days — created for you, no scheduling by hand.
      </p>

      <div className="ss-grid">
        <label className="ss-field"><span>Term name</span>
          <input className="ss-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Fall 2026" />
        </label>
        <label className="ss-field"><span>First day</span>
          <input className="ss-input" type="date" value={startDate} onChange={(e) => setStart(e.target.value)} />
        </label>
        <label className="ss-field"><span>Last day</span>
          <input className="ss-input" type="date" value={endDate} onChange={(e) => setEnd(e.target.value)} />
        </label>
        <label className="ss-field"><span>Meets every</span>
          <select className="ss-select" value={meetingDay} onChange={(e) => setDay(e.target.value)}>
            {WEEKDAYS.map((d) => <option key={d} value={d}>{d[0].toUpperCase() + d.slice(1)}</option>)}
          </select>
        </label>
      </div>

      {startDate && endDate && (
        <div style={{ marginTop: 18 }}>
          <p className="ss-eyebrow" style={{ marginBottom: 2 }}>
            {meeting} sessions per class · click a week to mark a day off
          </p>
          <SessionTimeline
            startDate={startDate}
            endDate={endDate}
            meetingDay={meetingDay}
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
        <button className="ss-btn ss-btn--ghost" disabled={busy || !name || !startDate || !endDate} onClick={save}>
          {term ? 'Save term' : 'Create term'}
        </button>
        <button className="ss-btn" disabled={!term} onClick={onNext}>
          Next: Classes <ArrowRight size={17} />
        </button>
      </div>
    </div>
  )
}

export default StepTerm
