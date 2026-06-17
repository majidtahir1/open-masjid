'use client'
import React, { useEffect, useState } from 'react'
import { api } from '../api'

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

const StepTerm: React.FC<{ onNext: () => void; onChanged: () => void }> = ({ onNext, onChanged }) => {
  const [term, setTerm] = useState<any>(null)
  const [name, setName] = useState('')
  const [startDate, setStart] = useState('')
  const [endDate, setEnd] = useState('')
  const [meetingDay, setDay] = useState('sunday')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api('/terms?where[status][equals]=active&sort=-startDate&limit=1&depth=0').then((r) => {
      const t = r.docs[0]
      if (t) {
        setTerm(t); setName(t.name ?? ''); setStart(String(t.startDate ?? '').slice(0, 10))
        setEnd(String(t.endDate ?? '').slice(0, 10)); setDay(t.meetingDay ?? 'sunday')
      }
    }).catch(() => {})
  }, [])

  const save = async () => {
    setBusy(true); setError('')
    try {
      const data = { name, startDate, endDate, meetingDay, status: 'active' }
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

  return (
    <div>
      <h2>1. Term</h2>
      <p>Name, dates, and weekly meeting day. Sessions are generated automatically for every class in this term.</p>
      <div style={{ display: 'grid', gap: 10, maxWidth: 420 }}>
        <label>Name <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Fall 2026" /></label>
        <label>Start <input type="date" value={startDate} onChange={(e) => setStart(e.target.value)} /></label>
        <label>End <input type="date" value={endDate} onChange={(e) => setEnd(e.target.value)} /></label>
        <label>Meeting day{' '}
          <select value={meetingDay} onChange={(e) => setDay(e.target.value)}>
            {WEEKDAYS.map((d) => <option key={d} value={d}>{d[0].toUpperCase() + d.slice(1)}</option>)}
          </select>
        </label>
      </div>
      {error && <p style={{ color: 'var(--theme-error-500)' }}>{error}</p>}
      <div style={{ marginTop: 16, display: 'flex', gap: 12 }}>
        <button className="btn btn--style-secondary btn--size-medium" disabled={busy || !name || !startDate || !endDate} onClick={save}>
          {term ? 'Save term' : 'Create term'}
        </button>
        <button className="btn btn--style-primary btn--size-medium" disabled={!term} onClick={onNext}>Next: Classes →</button>
      </div>
    </div>
  )
}

export default StepTerm
