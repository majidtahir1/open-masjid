'use client'
import React, { useEffect, useState, useCallback } from 'react'
import { api } from '../api'

const StepClasses: React.FC<{ onBack: () => void; onNext: () => void; onChanged: () => void }> = ({ onBack, onNext, onChanged }) => {
  const [termId, setTermId] = useState<string | number | null>(null)
  const [classes, setClasses] = useState<any[]>([])
  const [sessionsByClass, setSessions] = useState<Record<string, number>>({})
  const [name, setName] = useState('')
  const [gradeLevel, setGrade] = useState('')
  const [room, setRoom] = useState('')
  const [capacity, setCap] = useState('')
  const [busy, setBusy] = useState(false)

  const reload = useCallback(async (tid: string | number) => {
    const cl = (await api(`/school-classes?where[term][equals]=${tid}&limit=1000&depth=0`)).docs
    setClasses(cl)
    const counts: Record<string, number> = {}
    for (const c of cl) {
      const s = await api(`/class-sessions?where[class][equals]=${c.id}&limit=0&depth=0`)
      counts[String(c.id)] = s.totalDocs ?? (s.docs?.length ?? 0)
    }
    setSessions(counts)
  }, [])

  useEffect(() => {
    api('/terms?where[status][equals]=active&sort=-startDate&limit=1&depth=0').then(async (r) => {
      const t = r.docs[0]
      if (t) { setTermId(t.id); await reload(t.id) }
    }).catch(() => {})
  }, [reload])

  const add = async () => {
    if (!termId) return
    setBusy(true)
    try {
      const data: any = { name, term: termId, status: 'active' }
      if (gradeLevel) data.gradeLevel = gradeLevel
      if (room) data.room = room
      if (capacity) data.capacity = Number(capacity)
      await api('/school-classes', { method: 'POST', body: JSON.stringify(data) })
      setName(''); setGrade(''); setRoom(''); setCap('')
      await reload(termId)
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <h2>2. Classes</h2>
      <p>Add the classes in this term. Each class automatically gets a weekly session for every meeting day in the term.</p>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {classes.map((c) => (
          <li key={c.id} style={{ padding: '4px 0' }}>
            <strong>{c.name}</strong>{c.gradeLevel ? ` · ${c.gradeLevel}` : ''} — {sessionsByClass[String(c.id)] ?? 0} sessions
          </li>
        ))}
        {classes.length === 0 && <li style={{ color: 'var(--theme-elevation-500)' }}>No classes yet.</li>}
      </ul>
      <div style={{ display: 'grid', gap: 10, maxWidth: 420, marginTop: 12 }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Class name (e.g. Grade 3 Quran)" />
        <input value={gradeLevel} onChange={(e) => setGrade(e.target.value)} placeholder="Grade level (optional)" />
        <input value={room} onChange={(e) => setRoom(e.target.value)} placeholder="Room (optional)" />
        <input value={capacity} onChange={(e) => setCap(e.target.value)} placeholder="Capacity (optional)" type="number" />
        <button className="btn btn--style-secondary btn--size-medium" disabled={busy || !name} onClick={add}>Add class</button>
      </div>
      <div style={{ marginTop: 16, display: 'flex', gap: 12 }}>
        <button className="btn btn--style-secondary btn--size-medium" onClick={onBack}>← Back</button>
        <button className="btn btn--style-primary btn--size-medium" disabled={classes.length === 0} onClick={onNext}>Next: Teachers →</button>
      </div>
    </div>
  )
}

export default StepClasses
