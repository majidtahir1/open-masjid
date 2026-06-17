'use client'
import React, { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Plus, ChevronRight, Archive } from 'lucide-react'
import { api, toId } from '../api'
import SchoolTabs from '../SchoolTabs'
import '../sunday-school.css'

interface Row {
  id: string | number
  name: string
  gradeLevel?: string
  teachers?: any[]
  enrolled: number
  sessions: number
  status: string
}

const ClassesClient: React.FC<{ termId: string | null; termName: string | null }> = ({
  termId,
  termName,
}) => {
  const [rows, setRows] = useState<Row[]>([])
  const [showArchived, setShowArchived] = useState(false)
  const [name, setName] = useState('')
  const [grade, setGrade] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!termId) {
      setRows([])
      setLoading(false)
      return
    }
    setLoading(true)
    const cl = (await api(`/school-classes?where[term][equals]=${termId}&limit=1000&depth=1&sort=name`)).docs
    const out: Row[] = []
    for (const c of cl) {
      const enr = await api(
        `/enrollments?where[class][equals]=${c.id}&where[status][equals]=active&limit=0&depth=0`,
      )
      const ses = await api(`/class-sessions?where[class][equals]=${c.id}&limit=0&depth=0`)
      out.push({
        id: c.id,
        name: c.name,
        gradeLevel: c.gradeLevel,
        teachers: c.teachers,
        enrolled: enr.totalDocs ?? 0,
        sessions: ses.totalDocs ?? 0,
        status: c.status ?? 'active',
      })
    }
    setRows(out)
    setLoading(false)
  }, [termId])

  useEffect(() => {
    reload().catch(() => setLoading(false))
  }, [reload])

  const add = async () => {
    if (!termId || !name) return
    setBusy(true)
    try {
      const data: any = { name, term: toId(termId), status: 'active' }
      if (grade) data.gradeLevel = grade
      await api('/school-classes', { method: 'POST', body: JSON.stringify(data) })
      setName('')
      setGrade('')
      await reload()
    } finally {
      setBusy(false)
    }
  }

  const teacherLabel = (c: Row) => {
    const t = Array.isArray(c.teachers) ? c.teachers[0] : null
    return t ? (typeof t === 'object' ? (t.email ?? 'Assigned') : 'Assigned') : null
  }

  const visible = rows.filter((r) => (showArchived ? true : r.status === 'active'))

  return (
    <div className="ss-root">
      <SchoolTabs />
      <div className="ss-att__bar">
        <div>
          <p className="ss-eyebrow">{termName ?? 'No active term'}</p>
          <h1 className="ss-display" style={{ fontSize: 26 }}>
            Classes
          </h1>
        </div>
        <label
          className="ss-row__name"
          style={{ flex: 'none', display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}
        >
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />{' '}
          Show archived
        </label>
      </div>

      {!termId && <p className="ss-emptyline">Create a term first in Setup.</p>}
      {termId && loading && <p className="ss-emptyline">Loading…</p>}

      {termId && !loading && (
        <>
          <div className="ss-card" style={{ padding: '8px 14px', marginBottom: 16 }}>
            {visible.length === 0 && <p className="ss-emptyline">No classes yet.</p>}
            {visible.map((c) => (
              <Link
                key={c.id}
                href={`/admin/sunday-school/classes/${c.id}`}
                className="ss-row"
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <span className="ss-row__name">
                  {c.name}
                  {c.gradeLevel ? ` · ${c.gradeLevel}` : ''}
                  {c.status === 'archived' && (
                    <span className="ss-pill ss-pill--muted" style={{ marginLeft: 8 }}>
                      <Archive size={12} /> archived
                    </span>
                  )}
                </span>
                <span className="ss-pill ss-pill--muted">{c.enrolled} students</span>
                <span className="ss-pill ss-pill--muted">{c.sessions} sessions</span>
                <span className="ss-pill">{teacherLabel(c) ?? 'No teacher'}</span>
                <ChevronRight size={16} style={{ color: 'var(--theme-elevation-400)' }} />
              </Link>
            ))}
          </div>

          <div className="ss-card ss-panel">
            <p className="ss-eyebrow">New class</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                className="ss-input"
                style={{ maxWidth: 260 }}
                placeholder="Class name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <input
                className="ss-input"
                style={{ maxWidth: 180 }}
                placeholder="Grade (optional)"
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
              />
              <button className="ss-btn" disabled={busy || !name} onClick={add}>
                <Plus size={16} /> Add class
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default ClassesClient
