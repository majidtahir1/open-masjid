'use client'
import React, { useEffect, useState, useCallback } from 'react'
import { ArrowRight, ArrowLeft, UserPlus, UserCheck } from 'lucide-react'
import { api, toId } from '../api'

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
      body: JSON.stringify({ teachers: teacherId ? [toId(teacherId)] : [] }),
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
      setMsg(u ? `Invited ${email} and assigned them.` : `Invited ${email} — assign them from the list once they appear.`)
      setEmail(''); setFirst(''); setLast(''); setInviteFor(null)
    } catch (e) {
      setMsg((e as Error).message)
    }
  }

  const teacherName = (c: any) => {
    const t = Array.isArray(c.teachers) ? c.teachers[0] : null
    if (!t) return null
    return typeof t === 'object' ? ((t.email ?? `${t.firstName ?? ''} ${t.lastName ?? ''}`.trim()) || 'Assigned') : String(t)
  }

  return (
    <div className="ss-card">
      <p className="ss-eyebrow">Step 3 · optional</p>
      <h2 className="ss-card__title">Assign teachers</h2>
      <p className="ss-card__hint">
        Give each class a teacher, or skip this and assign them later. Inviting someone emails them a link
        to set their own password.
      </p>

      {classes.map((c) => {
        const assigned = teacherName(c)
        return (
          <div key={c.id} style={{ borderBottom: '1px solid var(--theme-elevation-100)', padding: '12px 0' }}>
            <div className="ss-row" style={{ padding: 0 }}>
              <span className="ss-row__name">{c.name}</span>
              {assigned
                ? <span className="ss-pill"><UserCheck size={13} /> {assigned}</span>
                : <span className="ss-pill ss-pill--muted">No teacher yet</span>}
            </div>
            <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <select className="ss-select" style={{ maxWidth: 240 }} value="" onChange={(e) => assign(c.id, e.target.value)}>
                <option value="">Pick an existing teacher…</option>
                {teachers.map((t) => <option key={t.id} value={t.id}>{t.email}</option>)}
              </select>
              <button className="ss-btn ss-btn--ghost ss-btn--small" onClick={() => setInviteFor(inviteFor === c.id ? null : c.id)}>
                <UserPlus size={15} /> Invite new
              </button>
            </div>
            {inviteFor === c.id && (
              <div className="ss-grid" style={{ maxWidth: 360, marginTop: 10 }}>
                <input className="ss-input" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
                <input className="ss-input" placeholder="First name" value={first} onChange={(e) => setFirst(e.target.value)} />
                <input className="ss-input" placeholder="Last name" value={last} onChange={(e) => setLast(e.target.value)} />
                <button className="ss-btn ss-btn--ghost ss-btn--small" disabled={!email} onClick={() => invite(c.id)}>Send invite &amp; assign</button>
              </div>
            )}
          </div>
        )
      })}
      {msg && <p className="ss-note">{msg}</p>}

      <div className="ss-foot">
        <button className="ss-btn ss-btn--ghost" onClick={onBack}><ArrowLeft size={17} /> Back</button>
        <button className="ss-btn" onClick={onNext}>Skip / Next: Students <ArrowRight size={17} /></button>
      </div>
    </div>
  )
}

export default StepTeachers
