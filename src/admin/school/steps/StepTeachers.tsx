'use client'
import React, { useEffect, useState, useCallback } from 'react'
import { api } from '../api'

const StepTeachers: React.FC<{ onBack: () => void; onNext: () => void }> = ({ onBack, onNext }) => {
  const [classes, setClasses] = useState<any[]>([])
  const [teachers, setTeachers] = useState<any[]>([])
  const [inviteFor, setInviteFor] = useState<string | number | null>(null)
  const [email, setEmail] = useState('')
  const [first, setFirst] = useState('')
  const [last, setLast] = useState('')
  const [msg, setMsg] = useState('')

  const reload = useCallback(async () => {
    const tr = await api('/terms?where[status][equals]=active&sort=-startDate&limit=1&depth=0')
    const term = tr.docs[0]
    if (!term) return
    setClasses((await api(`/school-classes?where[term][equals]=${term.id}&limit=1000&depth=1`)).docs)
    setTeachers((await api('/users?where[role][equals]=teacher&limit=1000&depth=0')).docs)
  }, [])

  useEffect(() => { reload().catch(() => {}) }, [reload])

  const assign = async (classId: string | number, teacherId: string) => {
    await api(`/school-classes/${classId}`, {
      method: 'PATCH',
      body: JSON.stringify({ teachers: teacherId ? [teacherId] : [] }),
    })
    await reload()
  }

  const invite = async (classId: string | number) => {
    setMsg('')
    try {
      const res = await fetch('/api/invite-user', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, firstName: first, lastName: last, role: 'teacher' }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Invite failed')
      const u = (await api(`/users?where[email][equals]=${encodeURIComponent(email)}&limit=1&depth=0`)).docs[0]
      if (u) await assign(classId, String(u.id))
      setMsg(`Invited ${email}.`); setEmail(''); setFirst(''); setLast(''); setInviteFor(null)
    } catch (e) {
      setMsg((e as Error).message)
    }
  }

  const teacherName = (c: any) => {
    const t = Array.isArray(c.teachers) ? c.teachers[0] : null
    if (!t) return null
    return typeof t === 'object' ? (t.email ?? (`${t.firstName ?? ''} ${t.lastName ?? ''}`.trim() || 'Assigned')) : String(t)
  }

  return (
    <div>
      <h2>3. Teachers <span style={{ fontWeight: 400, fontSize: 14 }}>(optional)</span></h2>
      <p>Assign a teacher to each class, or skip and do it later.</p>
      {classes.map((c) => (
        <div key={c.id} style={{ borderBottom: '1px solid var(--theme-elevation-150)', padding: '8px 0' }}>
          <strong>{c.name}</strong> — {teacherName(c) ?? <em>No teacher assigned</em>}
          <div style={{ marginTop: 6, display: 'flex', gap: 8, alignItems: 'center' }}>
            <select value="" onChange={(e) => assign(c.id, e.target.value)}>
              <option value="">— pick existing —</option>
              {teachers.map((t) => <option key={t.id} value={t.id}>{t.email}</option>)}
            </select>
            <button className="btn btn--size-small" onClick={() => setInviteFor(inviteFor === c.id ? null : c.id)}>Invite new</button>
          </div>
          {inviteFor === c.id && (
            <div style={{ display: 'grid', gap: 6, maxWidth: 360, marginTop: 8 }}>
              <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <input placeholder="First name" value={first} onChange={(e) => setFirst(e.target.value)} />
              <input placeholder="Last name" value={last} onChange={(e) => setLast(e.target.value)} />
              <button className="btn btn--style-secondary btn--size-small" disabled={!email} onClick={() => invite(c.id)}>Send invite & assign</button>
            </div>
          )}
        </div>
      ))}
      {msg && <p>{msg}</p>}
      <div style={{ marginTop: 16, display: 'flex', gap: 12 }}>
        <button className="btn btn--style-secondary btn--size-medium" onClick={onBack}>← Back</button>
        <button className="btn btn--style-primary btn--size-medium" onClick={onNext}>Skip / Next: Students →</button>
      </div>
    </div>
  )
}

export default StepTeachers
