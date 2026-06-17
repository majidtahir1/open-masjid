'use client'
import React, { useEffect, useState, useCallback } from 'react'
import { api } from './api'

type Doc = { id: number | string; [k: string]: any }
const STATUSES = ['present', 'absent', 'late', 'excused'] as const
type Status = (typeof STATUSES)[number]

const TakeAttendance: React.FC = () => {
  const [classes, setClasses] = useState<Doc[]>([])
  const [classId, setClassId] = useState<string>('')
  const [session, setSession] = useState<Doc | null>(null)
  const [roster, setRoster] = useState<Doc[]>([])
  const [marks, setMarks] = useState<Record<string, { id?: string | number; status: Status }>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api('/school-classes?limit=200&depth=0')
      .then((r) => setClasses(r.docs))
      .catch(() => setError('Failed to load classes.'))
  }, [])

  const loadClass = useCallback(async (id: string) => {
    setClassId(id)
    setSession(null)
    setRoster([])
    setMarks({})
    setError(null)
    if (!id) return
    try {
      const sess = await api(
        `/class-sessions?where[class][equals]=${id}&where[status][not_equals]=cancelled&sort=date&limit=200&depth=0`,
      )
      const today = new Date().toISOString().slice(0, 10)
      // Find the next upcoming session (on or after today); if none, fall back
      // to the most recent past session (last element of the ascending sort).
      const upcoming =
        sess.docs.find((s: Doc) => String(s.date).slice(0, 10) >= today) ??
        (sess.docs.length > 0 ? sess.docs[sess.docs.length - 1] : null)
      setSession(upcoming)

      const enr = await api(
        `/enrollments?where[class][equals]=${id}&where[status][equals]=active&limit=500&depth=1`,
      )
      const students: Doc[] = enr.docs.map((e: Doc) => e.student).filter(Boolean)
      setRoster(students)

      if (upcoming) {
        const att = await api(
          `/attendance-records?where[session][equals]=${upcoming.id}&limit=500&depth=0`,
        )
        const m: Record<string, { id: string | number; status: Status }> = {}
        for (const a of att.docs) {
          const sid = typeof a.student === 'object' ? a.student.id : a.student
          m[String(sid)] = { id: a.id, status: a.status }
        }
        setMarks(m)
      }
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load class data.')
    }
  }, [])

  const mark = async (studentId: string | number, status: Status) => {
    if (!session) return
    setBusy(true)
    setError(null)
    const key = String(studentId)
    const existing = marks[key]
    try {
      let saved: Doc
      if (existing?.id) {
        saved = await api(`/attendance-records/${existing.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ status }),
        }).then((r) => r.doc)
      } else {
        saved = await api('/attendance-records', {
          method: 'POST',
          body: JSON.stringify({ session: session.id, student: studentId, status }),
        }).then((r) => r.doc)
      }
      setMarks((prev) => ({ ...prev, [key]: { id: saved.id, status } }))
    } catch (e: any) {
      setError(e?.message ?? 'Failed to save attendance.')
    } finally {
      setBusy(false)
    }
  }

  const counts = STATUSES.reduce(
    (acc, s) => ({
      ...acc,
      [s]: roster.filter((st) => marks[String(st.id)]?.status === s).length,
    }),
    {} as Record<Status, number>,
  )
  const unmarked =
    roster.length - Object.values(counts).reduce((a, b) => a + b, 0)

  return (
    <div>
      <label>
        Class:{' '}
        <select value={classId} onChange={(e) => loadClass(e.target.value)}>
          <option value="">— select —</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      {error && (
        <p style={{ color: 'var(--theme-error-500, #ef4444)', marginTop: 8 }}>{error}</p>
      )}

      {session && (
        <p style={{ marginTop: 12 }}>
          Session: <strong>{String(session.date).slice(0, 10)}</strong> · present{' '}
          {counts.present} · absent {counts.absent} · late {counts.late} · excused{' '}
          {counts.excused} · <strong>{unmarked} unmarked</strong>
        </p>
      )}
      {classId && !session && <p>No sessions scheduled for this class.</p>}

      <ul style={{ listStyle: 'none', padding: 0, marginTop: 16 }}>
        {roster.map((st) => {
          const cur = marks[String(st.id)]?.status
          return (
            <li
              key={st.id}
              style={{
                display: 'flex',
                gap: 8,
                alignItems: 'center',
                padding: '6px 0',
                borderBottom: '1px solid var(--theme-elevation-100, #e5e7eb)',
              }}
            >
              <span style={{ flex: 1 }}>
                {st.fullName ?? `${st.firstName ?? ''} ${st.lastName ?? ''}`.trim()}
              </span>
              {STATUSES.map((s) => (
                <button
                  key={s}
                  disabled={busy || !session}
                  onClick={() => mark(st.id, s)}
                  style={{
                    fontWeight: cur === s ? 700 : 400,
                    opacity: cur === s ? 1 : 0.55,
                    cursor: busy || !session ? 'not-allowed' : 'pointer',
                    padding: '4px 10px',
                    border: cur === s ? '2px solid currentColor' : '1px solid currentColor',
                    borderRadius: 4,
                    background: 'transparent',
                  }}
                >
                  {s}
                </button>
              ))}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export default TakeAttendance
