'use client'
import React, { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, CheckCheck, ClipboardCheck } from 'lucide-react'
import { api, toId } from './api'
import ProgramPicker from './ProgramPicker'
import './sunday-school.css'

type Doc = { id: number | string; [k: string]: any }
const STATUSES = ['present', 'absent', 'late', 'excused'] as const
type Status = (typeof STATUSES)[number]

/** Readable session label, e.g. "Sat, Sep 6, 2026" (marks today's session). */
const fmtSession = (s: Doc): string => {
  const iso = String(s.date).slice(0, 10)
  const d = new Date(`${iso}T00:00:00`)
  const label = Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
  return iso === new Date().toISOString().slice(0, 10) ? `${label} · today` : label
}

const TakeAttendance: React.FC<{ programId: string | null }> = ({ programId }) => {
  const [classes, setClasses] = useState<Doc[]>([])
  const [classId, setClassId] = useState<string>('')
  const [sessions, setSessions] = useState<Doc[]>([])
  const [session, setSession] = useState<Doc | null>(null)
  const [roster, setRoster] = useState<Doc[]>([])
  const [marks, setMarks] = useState<Record<string, { id?: string | number; status: Status }>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Switching programs invalidates the current class/session selection.
    setClassId('')
    setSessions([])
    setSession(null)
    setRoster([])
    setMarks({})
    const q = programId ? `&where[term][equals]=${programId}` : ''
    api(`/school-classes?limit=200&depth=0${q}`)
      .then((r) => setClasses(r.docs))
      .catch(() => setError('Failed to load classes.'))
  }, [programId])

  // Load (or switch to) a specific session and pull its saved marks. The roster
  // is class-based, so switching sessions only refreshes the marks.
  const loadSession = useCallback(async (sess: Doc | null) => {
    setSession(sess)
    setMarks({})
    if (!sess) return
    try {
      const att = await api(
        `/attendance-records?where[session][equals]=${sess.id}&limit=500&depth=0`,
      )
      const m: Record<string, { id: string | number; status: Status }> = {}
      for (const a of att.docs) {
        const sid = typeof a.student === 'object' ? a.student.id : a.student
        m[String(sid)] = { id: a.id, status: a.status }
      }
      setMarks(m)
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load attendance.')
    }
  }, [])

  const loadClass = useCallback(
    async (id: string) => {
      setClassId(id)
      setSessions([])
      setSession(null)
      setRoster([])
      setMarks({})
      setError(null)
      if (!id) return
      try {
        const sess = await api(
          `/class-sessions?where[class][equals]=${id}&where[status][not_equals]=cancelled&sort=date&limit=200&depth=0`,
        )
        setSessions(sess.docs)
        // Default to the next session today-or-later; otherwise the most recent
        // past session. The user can switch to any session via the date picker.
        const today = new Date().toISOString().slice(0, 10)
        const upcoming =
          sess.docs.find((s: Doc) => String(s.date).slice(0, 10) >= today) ??
          (sess.docs.length > 0 ? sess.docs[sess.docs.length - 1] : null)

        const enr = await api(
          `/enrollments?where[class][equals]=${id}&where[status][equals]=active&limit=500&depth=1`,
        )
        const students: Doc[] = enr.docs.map((e: Doc) => e.student).filter(Boolean)
        setRoster(students)

        await loadSession(upcoming)
      } catch (e: any) {
        setError(e?.message ?? 'Failed to load class data.')
      }
    },
    [loadSession],
  )

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
          body: JSON.stringify({ session: toId(session.id), student: toId(studentId), status }),
        }).then((r) => r.doc)
      }
      setMarks((prev) => ({ ...prev, [key]: { id: saved.id, status } }))
    } catch (e: any) {
      setError(e?.message ?? 'Failed to save attendance.')
    } finally {
      setBusy(false)
    }
  }

  const markRestPresent = async () => {
    for (const st of roster) {
      if (!marks[String(st.id)]) await mark(st.id, 'present')
    }
  }

  const counts = STATUSES.reduce(
    (acc, s) => ({ ...acc, [s]: roster.filter((st) => marks[String(st.id)]?.status === s).length }),
    {} as Record<Status, number>,
  )
  const unmarked = roster.length - Object.values(counts).reduce((a, b) => a + b, 0)

  return (
    <div className="ss-root">
      <p className="ss-eyebrow">Programs</p>
      <h1 className="ss-display" style={{ fontSize: 28, marginBottom: 18 }}>Take attendance</h1>

      <div style={{ marginBottom: 14 }}>
        <ProgramPicker />
      </div>

      <div className="ss-att__bar">
        <div className="ss-att__pick">
          <ClipboardCheck size={18} style={{ color: 'var(--ss-teal-600)' }} />
          <select className="ss-select" style={{ maxWidth: 280 }} value={classId} onChange={(e) => loadClass(e.target.value)}>
            <option value="">Choose a class…</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {sessions.length > 0 && (
            <select
              className="ss-select"
              style={{ maxWidth: 220 }}
              aria-label="Session date"
              value={session ? String(session.id) : ''}
              onChange={(e) => {
                const s = sessions.find((x) => String(x.id) === e.target.value) ?? null
                void loadSession(s)
              }}
            >
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {fmtSession(s)}
                </option>
              ))}
            </select>
          )}
        </div>

        {session && roster.length > 0 && (
          <div className="ss-att__counts">
            <span className="ss-chip"><b>{counts.present}</b> present</span>
            <span className="ss-chip"><b>{counts.absent}</b> absent</span>
            <span className="ss-chip"><b>{counts.late}</b> late</span>
            <span className="ss-chip"><b>{counts.excused}</b> excused</span>
            {unmarked > 0 && <span className="ss-chip ss-chip--unmarked"><b>{unmarked}</b> unmarked</span>}
          </div>
        )}
      </div>

      {error && <p className="ss-error">{error}</p>}
      {classId && !session && <p className="ss-emptyline">No sessions scheduled for this class yet.</p>}
      {session && roster.length === 0 && <p className="ss-emptyline">No students enrolled in this class yet.</p>}

      {session && roster.length > 0 && (
        <>
          {unmarked > 0 && (
            <button className="ss-btn ss-btn--ghost ss-btn--small" style={{ marginBottom: 6 }} disabled={busy} onClick={markRestPresent}>
              <CheckCheck size={15} /> Mark remaining {unmarked} present
            </button>
          )}
          <div className="ss-card" style={{ padding: '8px 14px', animation: 'none' }}>
            {roster.map((st) => {
              const cur = marks[String(st.id)]?.status
              return (
                <div key={st.id} className="ss-row">
                  <span className="ss-row__name">{st.fullName ?? `${st.firstName ?? ''} ${st.lastName ?? ''}`.trim()}</span>
                  <span className="ss-status">
                    {STATUSES.map((s) => (
                      <button
                        key={s}
                        className={`ss-status__btn is-${s}${cur === s ? ' ss-status__btn--on' : ''}`}
                        disabled={busy}
                        aria-pressed={cur === s}
                        onClick={() => mark(st.id, s)}
                      >
                        {s}
                      </button>
                    ))}
                  </span>
                </div>
              )
            })}
          </div>
        </>
      )}

      <div className="ss-foot">
        <Link className="ss-btn ss-btn--ghost" href="/admin/sunday-school"><ArrowLeft size={17} /> Dashboard</Link>
      </div>
    </div>
  )
}

export default TakeAttendance
