'use client'
import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { RefreshCw, Search } from 'lucide-react'
import { api } from './api'
import SchoolTabs from './SchoolTabs'
import './sunday-school.css'
import { relIdStr as idOf } from '@/lib/relationship-id'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Doc = { id: number | string; [k: string]: any }
type Status = 'in' | 'out' | 'none'

interface Row {
  studentId: string
  name: string
  classNames: string[]
  classIds: string[]
  status: Status
  inAt: string | null
  outAt: string | null
}

/** Local calendar date (YYYY-MM-DD) — matches how sessions are dated, unlike a UTC slice. */
const localYmd = (d = new Date()): string =>
  new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)

const fmtClock = (iso: string | null): string => {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}
const fmtDayLabel = (ymd: string): string => {
  const d = new Date(`${ymd}T00:00:00`)
  const label = Number.isNaN(d.getTime())
    ? ymd
    : d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
  return ymd === localYmd() ? `${label} · today` : label
}

const STATUS_TABS: { key: 'all' | Status; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'in', label: 'Checked in' },
  { key: 'out', label: 'Checked out' },
  { key: 'none', label: 'Not arrived' },
]

const WhosHere: React.FC<{ programId: string | null }> = ({ programId }) => {
  const [date, setDate] = useState<string>(localYmd())
  const [rows, setRows] = useState<Row[]>([])
  const [classes, setClasses] = useState<Doc[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'all' | Status>('all')
  const [classFilter, setClassFilter] = useState<string>('all')
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    if (!programId) { setRows([]); setClasses([]); return }
    setLoading(true)
    setError(null)
    try {
      const clsRes = await api(`/school-classes?where[term][equals]=${programId}&where[status][equals]=active&limit=500&depth=0`)
      const cls: Doc[] = clsRes.docs ?? []
      setClasses(cls)
      const classIds = cls.map((c) => idOf(c.id))
      if (!classIds.length) { setRows([]); setLoading(false); return }

      const ids = classIds.join(',')
      const gte = encodeURIComponent(`${date}T00:00:00.000Z`)
      const lte = encodeURIComponent(`${date}T23:59:59.999Z`)
      const sessRes = await api(
        `/class-sessions?where[class][in]=${ids}&where[date][greater_than_equal]=${gte}&where[date][less_than_equal]=${lte}&where[status][not_equals]=cancelled&limit=1000&depth=0`,
      )
      const sessions: Doc[] = sessRes.docs ?? []
      const sessionByClass = new Map<string, string>()
      for (const s of sessions) if (!sessionByClass.has(idOf(s.class))) sessionByClass.set(idOf(s.class), idOf(s.id))
      const sessionIds = Array.from(sessionByClass.values())

      const enrRes = await api(`/enrollments?where[class][in]=${ids}&where[status][equals]=active&limit=5000&depth=1`)
      const enrollments: Doc[] = enrRes.docs ?? []

      const records: Doc[] = sessionIds.length
        ? (await api(`/attendance-records?where[session][in]=${sessionIds.join(',')}&limit=10000&depth=0`)).docs ?? []
        : []
      const recByStudent = new Map<string, { inAt: string | null; outAt: string | null }>()
      for (const r of records) {
        const sid = idOf(r.student)
        const cur = recByStudent.get(sid) ?? { inAt: null, outAt: null }
        if (r.checkInAt && (!cur.inAt || r.checkInAt < cur.inAt)) cur.inAt = r.checkInAt
        if (r.checkOutAt && (!cur.outAt || r.checkOutAt > cur.outAt)) cur.outAt = r.checkOutAt
        recByStudent.set(sid, cur)
      }

      // Build one row per enrolled student who has a class meeting this date.
      const byStudent = new Map<string, Row>()
      for (const e of enrollments) {
        const cid = idOf(e.class)
        if (!sessionByClass.has(cid)) continue // class doesn't meet this date
        const stu = e.student
        if (!stu || typeof stu !== 'object') continue
        const sid = idOf(stu.id)
        const cname = typeof e.class === 'object' ? e.class?.name : null
        const existing = byStudent.get(sid)
        if (existing) {
          if (cname && !existing.classNames.includes(cname)) existing.classNames.push(cname)
          if (!existing.classIds.includes(cid)) existing.classIds.push(cid)
        } else {
          const rec = recByStudent.get(sid) ?? { inAt: null, outAt: null }
          const status: Status = rec.outAt ? 'out' : rec.inAt ? 'in' : 'none'
          byStudent.set(sid, {
            studentId: sid,
            name: stu.fullName || [stu.firstName, stu.lastName].filter(Boolean).join(' ') || `Student ${sid}`,
            classNames: cname ? [cname] : [],
            classIds: [cid],
            status,
            inAt: rec.inAt,
            outAt: rec.outAt,
          })
        }
      }
      setRows(Array.from(byStudent.values()).sort((a, b) => a.name.localeCompare(b.name)))
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load.')
    } finally {
      setLoading(false)
    }
  }, [programId, date])

  useEffect(() => { load() }, [load])

  const counts = useMemo(() => ({
    total: rows.length,
    in: rows.filter((r) => r.status === 'in').length,
    out: rows.filter((r) => r.status === 'out').length,
    none: rows.filter((r) => r.status === 'none').length,
  }), [rows])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false
      if (classFilter !== 'all' && !r.classIds.includes(classFilter)) return false
      if (q && !r.name.toLowerCase().includes(q)) return false
      return true
    })
  }, [rows, statusFilter, classFilter, search])

  const pill = (status: Status) =>
    status === 'in'
      ? { text: 'Checked in', cls: 'ss-pill' }
      : status === 'out'
      ? { text: 'Checked out', cls: 'ss-pill ss-pill--muted' }
      : { text: 'Not arrived', cls: 'ss-pill ss-pill--muted' }

  return (
    <div className="ss-root">
      <SchoolTabs />
      <header className="ss-masthead">
        <p className="ss-eyebrow">Who&apos;s here</p>
        <h1 className="ss-masthead__title">{fmtDayLabel(date)}</h1>
      </header>

      <div className="ss-actions" style={{ margin: '14px 0 0', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
        <label className="ss-field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, margin: 0 }}>
          <span style={{ fontSize: 13, color: 'var(--theme-elevation-600)' }}>Date</span>
          <input className="ss-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: 'auto' }} />
        </label>
        <button className="ss-btn ss-btn--ghost ss-btn--small" onClick={() => load()} disabled={loading}>
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      {/* Live counts */}
      <div className="ss-stats" style={{ marginTop: 14 }}>
        <div className="ss-stat"><div className="ss-stat__num">{counts.total}</div><div className="ss-stat__label">on the roster</div></div>
        <div className="ss-stat ss-stat--good"><div className="ss-stat__num">{counts.in}</div><div className="ss-stat__label">checked in</div></div>
        <div className="ss-stat"><div className="ss-stat__num">{counts.out}</div><div className="ss-stat__label">checked out</div></div>
        <div className="ss-stat"><div className="ss-stat__num">{counts.none}</div><div className="ss-stat__label">not arrived</div></div>
      </div>

      {/* Filters */}
      <div className="ss-actions" style={{ margin: '16px 0 0', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            className={`ss-btn ss-btn--small ${statusFilter === tab.key ? '' : 'ss-btn--ghost'}`}
            onClick={() => setStatusFilter(tab.key)}
          >
            {tab.label}
          </button>
        ))}
        <select className="ss-input" value={classFilter} onChange={(e) => setClassFilter(e.target.value)} style={{ width: 'auto' }}>
          <option value="all">All classes</option>
          {classes.map((c) => (
            <option key={idOf(c.id)} value={idOf(c.id)}>{c.name}</option>
          ))}
        </select>
        <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
          <Search size={15} style={{ position: 'absolute', left: 10, color: 'var(--theme-elevation-400)' }} />
          <input className="ss-input" placeholder="Search name" value={search} onChange={(e) => setSearch(e.target.value)} style={{ paddingLeft: 30, width: 200 }} />
        </span>
      </div>

      {/* Roster */}
      <div className="ss-card ss-panel" style={{ marginTop: 16 }}>
        {!programId ? (
          <p className="ss-emptyline">Pick a program to see who&apos;s here.</p>
        ) : loading ? (
          <p className="ss-emptyline">Loading…</p>
        ) : error ? (
          <p className="ss-error">{error}</p>
        ) : visible.length === 0 ? (
          <p className="ss-emptyline">{rows.length === 0 ? 'No classes meet on this date.' : 'No students match these filters.'}</p>
        ) : (
          visible.map((r) => {
            const p = pill(r.status)
            return (
              <div key={r.studentId} className="ss-row">
                <span className="ss-row__name" style={{ flex: 1 }}>
                  <a href={`/admin/programs/students/${r.studentId}`} style={{ color: 'inherit', textDecoration: 'none' }}>{r.name}</a>
                  {r.classNames.length > 0 && (
                    <span style={{ display: 'block', fontSize: 12, color: 'var(--theme-elevation-500)', marginTop: 2 }}>{r.classNames.join(', ')}</span>
                  )}
                </span>
                <span style={{ width: 90, textAlign: 'right', fontSize: 13, color: r.inAt ? 'var(--theme-text)' : 'var(--theme-elevation-400)' }}>{fmtClock(r.inAt)}</span>
                <span style={{ width: 90, textAlign: 'right', fontSize: 13, color: r.outAt ? 'var(--theme-text)' : 'var(--theme-elevation-400)' }}>{fmtClock(r.outAt)}</span>
                <span className={p.cls} style={{ width: 110, textAlign: 'center' }}>{p.text}</span>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

export default WhosHere
