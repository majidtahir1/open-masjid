'use client'
import React, { useEffect, useState, useCallback } from 'react'
import { ArrowRight, ArrowLeft, Plus, CalendarDays } from 'lucide-react'
import { api, toId } from '../api'

const StepClasses: React.FC<{ programId: string | null; onBack: () => void; onNext: () => void; onChanged: () => void }> = ({ programId, onBack, onNext, onChanged }) => {
  const [classes, setClasses] = useState<any[]>([])
  const [sessionsByClass, setSessions] = useState<Record<string, number>>({})
  const [name, setName] = useState('')
  const [gradeLevel, setGrade] = useState('')
  const [room, setRoom] = useState('')
  const [capacity, setCap] = useState('')
  const [busy, setBusy] = useState(false)

  const reload = useCallback(async (tid: string) => {
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
    if (!programId) return
    reload(programId).catch(() => {})
  }, [programId, reload])

  const add = async () => {
    if (!programId) return
    setBusy(true)
    try {
      const data: any = { name, term: toId(programId), status: 'active' }
      if (gradeLevel) data.gradeLevel = gradeLevel
      if (room) data.room = room
      if (capacity) data.capacity = Number(capacity)
      await api('/school-classes', { method: 'POST', body: JSON.stringify(data) })
      setName(''); setGrade(''); setRoom(''); setCap('')
      await reload(programId)
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="ss-card">
      <p className="ss-eyebrow">Step 2</p>
      <h2 className="ss-card__title">Add your classes</h2>
      <p className="ss-card__hint">
        Each class meets weekly. As soon as you add one, its sessions are filled in across the term.
      </p>

      <div style={{ marginBottom: 18 }}>
        {classes.length === 0 && <p className="ss-emptyline">No classes yet — add your first one below.</p>}
        {classes.map((c) => (
          <div key={c.id} className="ss-row">
            <span className="ss-row__name">
              {c.name}{c.gradeLevel ? ` · ${c.gradeLevel}` : ''}
            </span>
            <span className="ss-pill"><CalendarDays size={13} /> {sessionsByClass[String(c.id)] ?? 0} sessions</span>
          </div>
        ))}
      </div>

      <div className="ss-grid">
        <input className="ss-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Class name (e.g. Grade 3 Quran)" />
        <input className="ss-input" value={gradeLevel} onChange={(e) => setGrade(e.target.value)} placeholder="Grade level (optional)" />
        <input className="ss-input" value={room} onChange={(e) => setRoom(e.target.value)} placeholder="Room (optional)" />
        <input className="ss-input" value={capacity} onChange={(e) => setCap(e.target.value)} placeholder="Capacity (optional)" type="number" />
        <button className="ss-btn ss-btn--ghost" disabled={busy || !name} onClick={add}>
          <Plus size={16} /> Add class
        </button>
      </div>

      <div className="ss-foot">
        <button className="ss-btn ss-btn--ghost" onClick={onBack}><ArrowLeft size={17} /> Back</button>
        <button className="ss-btn" disabled={classes.length === 0} onClick={onNext}>
          Next: Teachers <ArrowRight size={17} />
        </button>
      </div>
    </div>
  )
}

export default StepClasses
