'use client'
import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { UserPlus, RefreshCw, Search, X } from 'lucide-react'
import { api, toId } from './api'
import SchoolTabs from './SchoolTabs'
import './sunday-school.css'

type Doc = { id: number | string; [k: string]: any }
const idStr = (v: unknown): string => String(typeof v === 'object' && v !== null && 'id' in v ? (v as any).id : v)

interface EnrollmentRow {
  enrollmentId: string | number
  studentId: string
  name: string
  classId: string
  className: string
  status: string
}

const STATUS_FILTERS: { key: 'active' | 'withdrawn' | 'all'; label: string }[] = [
  { key: 'active', label: 'Active' },
  { key: 'withdrawn', label: 'Withdrawn' },
  { key: 'all', label: 'All' },
]

const Enrollment: React.FC<{ programId: string | null }> = ({ programId }) => {
  const [tab, setTab] = useState<'placement' | 'students'>('placement')
  const [classes, setClasses] = useState<Doc[]>([])
  const [unplaced, setUnplaced] = useState<Doc[]>([])
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  // roster filters
  const [search, setSearch] = useState('')
  const [classFilter, setClassFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<'active' | 'withdrawn' | 'all'>('active')
  // bulk selection (by enrollment id)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const toggleRow = (id: string) => setSelected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const clearSel = () => setSelected(new Set())
  // add-student modal
  const [addOpen, setAddOpen] = useState(false)
  const [first, setFirst] = useState('')
  const [last, setLast] = useState('')
  const [age, setAge] = useState('')
  const [guardian, setGuardian] = useState('')
  const [newClass, setNewClass] = useState('')
  const [busy, setBusy] = useState(false)
  // expanded registration snapshots (queue)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const toggleExpanded = (sid: string) =>
    setExpanded((prev) => { const n = new Set(prev); if (n.has(sid)) n.delete(sid); else n.add(sid); return n })

  const reload = useCallback(async () => {
    if (!programId) { setClasses([]); setUnplaced([]); setEnrollments([]); return }
    setLoading(true); setError('')
    try {
      const cl: Doc[] = (await api(`/school-classes?where[term][equals]=${programId}&where[status][equals]=active&limit=1000&depth=0`)).docs
      setClasses(cl)
      const classIds = cl.map((c) => c.id)
      // All enrollments (active + withdrawn) so the roster can filter by status.
      const enr: Doc[] = classIds.length
        ? (await api(`/enrollments?where[class][in]=${classIds.join(',')}&limit=5000&depth=1`)).docs
        : []
      const placed = new Set<string>() // students with at least one ACTIVE enrollment
      const rows: EnrollmentRow[] = []
      for (const e of enr) {
        const sid = idStr(e.student)
        const cid = idStr(e.class)
        const stu = e.student
        const cls = e.class
        const name = typeof stu === 'object' ? (stu.fullName || `${stu.firstName ?? ''} ${stu.lastName ?? ''}`.trim() || `Student ${sid}`) : `Student ${sid}`
        const className = typeof cls === 'object' && cls?.name ? cls.name : (cl.find((c) => idStr(c.id) === cid)?.name ?? `Class ${cid}`)
        if (e.status === 'active') placed.add(sid)
        rows.push({ enrollmentId: e.id, studentId: sid, name, classId: cid, className, status: e.status ?? 'active' })
      }
      rows.sort((a, b) => a.name.localeCompare(b.name) || a.className.localeCompare(b.className))
      setEnrollments(rows)
      const students: Doc[] = (await api(`/students?where[status][equals]=active&where[registeredProgram][equals]=${programId}&limit=5000&depth=0`)).docs
      setUnplaced(students.filter((s) => !placed.has(idStr(s.id))).sort((a, b) =>
        String(a.fullName ?? a.firstName).localeCompare(String(b.fullName ?? b.firstName))))
    } catch (e) {
      setError((e as Error).message || 'Failed to load.')
    } finally {
      setLoading(false)
    }
  }, [programId])

  useEffect(() => { reload() }, [reload])

  const place = async (studentId: string | number, classId: string) => {
    if (!classId || busy) return
    setBusy(true); setError('')
    try {
      await api('/enrollments', { method: 'POST', body: JSON.stringify({ student: toId(studentId), class: toId(classId), status: 'active' }) })
      await reload()
    } catch (e) { setError((e as Error).message || 'Couldn’t place that student.') } finally { setBusy(false) }
  }

  // Run an action over each selected enrollment, then clear + reload.
  const runBulk = async (action: (id: string | number) => Promise<void>, label: string) => {
    if (busy || selected.size === 0) return
    setBusy(true); setError('')
    try {
      for (const id of selected) await action(id)
      clearSel()
      await reload()
    } catch (e) { setError((e as Error).message || `${label} failed.`) } finally { setBusy(false) }
  }
  const bulkWithdraw = () => {
    if (!confirm(`Withdraw ${selected.size} student(s) from their class?`)) return
    runBulk(async (id) => { await api(`/enrollments/${toId(id)}`, { method: 'PATCH', body: JSON.stringify({ status: 'withdrawn' }) }) }, 'Withdraw')
  }
  const bulkReEnroll = () =>
    runBulk(async (id) => { await api(`/enrollments/${toId(id)}`, { method: 'PATCH', body: JSON.stringify({ status: 'active' }) }) }, 'Re-enroll')
  // Move = re-point each enrollment's class (single PATCH; matches ClassDetailClient, avoids the
  // unique (tenant, student, class) index a withdraw+re-create would hit on re-entry).
  const bulkMove = (newClassId: string) => {
    if (!newClassId) return
    runBulk(async (id) => { await api(`/enrollments/${toId(id)}`, { method: 'PATCH', body: JSON.stringify({ class: toId(newClassId) }) }) }, 'Move')
  }

  const addNew = async () => {
    if (!newClass || !first || !last) return
    setBusy(true); setError('')
    try {
      const data: any = { firstName: first, lastName: last, status: 'active', ...(programId ? { registeredProgram: toId(programId) } : {}) }
      if (age) data.age = Number(age)
      if (guardian) data.guardians = [{ name: guardian, isPrimary: true }]
      const student = await api('/students', { method: 'POST', body: JSON.stringify(data) }).then((r) => r.doc)
      await api('/enrollments', { method: 'POST', body: JSON.stringify({ student: toId(student.id), class: toId(newClass), status: 'active' }) })
      setFirst(''); setLast(''); setAge(''); setGuardian(''); setNewClass('')
      setAddOpen(false)
      await reload()
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return enrollments.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false
      if (classFilter !== 'all' && r.classId !== classFilter) return false
      if (q && !r.name.toLowerCase().includes(q)) return false
      return true
    })
  }, [enrollments, search, classFilter, statusFilter])

  const enrolledCount = useMemo(() => enrollments.filter((r) => r.status === 'active').length, [enrollments])
  const visibleIds = useMemo(() => visible.map((r) => String(r.enrollmentId)), [visible])
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id))
  const toggleAll = () => setSelected((prev) => {
    const n = new Set(prev)
    if (allSelected) visibleIds.forEach((id) => n.delete(id))
    else visibleIds.forEach((id) => n.add(id))
    return n
  })

  const tabBtn = (key: 'placement' | 'students', label: string, badge?: number) => (
    <button className={`ss-btn ss-btn--small ${tab === key ? '' : 'ss-btn--ghost'}`} onClick={() => setTab(key)}>
      {label}{badge != null && badge > 0 ? ` (${badge})` : ''}
    </button>
  )

  return (
    <div className="ss-root">
      <SchoolTabs />
      <header className="ss-masthead">
        <p className="ss-eyebrow">Enrollment</p>
        <h1 className="ss-masthead__title">Students &amp; placement</h1>
      </header>

      <div className="ss-actions" style={{ margin: '14px 0 0', alignItems: 'center' }}>
        {tabBtn('placement', 'Waiting for Placement', unplaced.length)}
        {tabBtn('students', 'Enrolled Students', enrolledCount)}
        <button className="ss-btn ss-btn--ghost ss-btn--small" onClick={() => reload()} disabled={loading} style={{ marginLeft: 'auto' }}>
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      {error && <p className="ss-error">{error}</p>}
      {!programId && <p className="ss-emptyline">Pick a program to manage enrollment.</p>}

      {/* ---------- PLACEMENT TAB ---------- */}
      {programId && tab === 'placement' && (
        <div className="ss-card ss-panel" style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <p className="ss-eyebrow" style={{ margin: 0 }}>Needs placement</p>
            <button className="ss-btn ss-btn--ghost ss-btn--small" onClick={() => setAddOpen(true)} disabled={classes.length === 0}>
              <UserPlus size={15} /> Add student
            </button>
          </div>
          {unplaced.length === 0 ? (
            <p className="ss-emptyline">{loading ? 'Loading…' : 'Everyone registered is placed. 🎉'}</p>
          ) : (
            unplaced.map((s) => {
              const sid = idStr(s.id)
              const det = s.registrationDetails && Array.isArray(s.registrationDetails.fields) ? s.registrationDetails : null
              const open = expanded.has(sid)
              return (
                <div key={s.id}>
                  <div className="ss-row">
                    <span className="ss-row__name">
                      <a href={`/admin/programs/students/${sid}`} style={{ color: 'var(--theme-text)', textDecoration: 'underline', textDecorationColor: 'var(--theme-elevation-200)' }}>
                        {s.fullName ?? `${s.firstName} ${s.lastName}`}
                      </a>
                      {s.gradeLevel ? <span style={{ color: 'var(--theme-elevation-500)' }}> · grade {s.gradeLevel}</span> : null}
                      {s.age ? <span style={{ color: 'var(--theme-elevation-500)' }}> · age {s.age}</span> : null}
                    </span>
                    <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                      {det && (
                        <button className="ss-btn ss-btn--ghost ss-btn--small" onClick={() => toggleExpanded(sid)}>
                          {open ? 'Hide' : 'Registration'}
                        </button>
                      )}
                      <select className="ss-select" style={{ maxWidth: 180 }} defaultValue="" onChange={(e) => place(s.id, e.target.value)}>
                        <option value="">Place in…</option>
                        {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </span>
                  </div>
                  {open && det && (
                    <div style={{ margin: '0 0 12px', padding: '10px 14px', background: 'var(--theme-elevation-50)', borderRadius: 8, border: '1px solid var(--theme-elevation-100)' }}>
                      {det.formName && <p style={{ fontSize: 12, color: 'var(--theme-elevation-500)', margin: '0 0 8px' }}>From “{det.formName}”</p>}
                      {det.fields.map((f: { label: string; value: string }, i: number) => (
                        <div key={i} style={{ display: 'flex', gap: 12, fontSize: 13, padding: '2px 0' }}>
                          <span style={{ flex: '0 0 38%', color: 'var(--theme-elevation-600)' }}>{f.label}</span>
                          <span style={{ flex: 1, whiteSpace: 'pre-wrap' }}>{f.value}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      {/* ---------- STUDENTS TAB ---------- */}
      {programId && tab === 'students' && (
        <div className="ss-card ss-panel" style={{ marginTop: 16 }}>
          {/* filters */}
          <div className="ss-actions" style={{ margin: '0 0 12px', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            {STATUS_FILTERS.map((t) => (
              <button
                key={t.key}
                className={`ss-btn ss-btn--small ${statusFilter === t.key ? '' : 'ss-btn--ghost'}`}
                onClick={() => setStatusFilter(t.key)}
              >
                {t.label}
              </button>
            ))}
            <select className="ss-select" value={classFilter} onChange={(e) => setClassFilter(e.target.value)} style={{ maxWidth: 200 }}>
              <option value="all">All classes</option>
              {classes.map((c) => <option key={c.id} value={idStr(c.id)}>{c.name}</option>)}
            </select>
            <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
              <Search size={15} style={{ position: 'absolute', left: 10, color: 'var(--theme-elevation-400)' }} />
              <input className="ss-input" placeholder="Search student" value={search} onChange={(e) => setSearch(e.target.value)} style={{ paddingLeft: 30, maxWidth: 200 }} />
            </span>
          </div>

          {/* bulk action bar */}
          {selected.size > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '10px 12px', marginBottom: 12, borderRadius: 8, background: 'var(--theme-elevation-50)', border: '1px solid var(--theme-elevation-150)' }}>
              <strong style={{ fontSize: 13 }}>{selected.size} selected</strong>
              <select className="ss-select" style={{ maxWidth: 180 }} value="" disabled={busy} onChange={(e) => bulkMove(e.target.value)}>
                <option value="">Change class…</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button className="ss-btn ss-btn--ghost ss-btn--small" disabled={busy} onClick={bulkWithdraw}>Withdraw</button>
              <button className="ss-btn ss-btn--ghost ss-btn--small" disabled={busy} onClick={bulkReEnroll}>Re-enroll</button>
              <button className="ss-btn ss-btn--ghost ss-btn--small" disabled={busy} onClick={clearSel} style={{ marginLeft: 'auto' }}>Clear</button>
            </div>
          )}

          {visible.length === 0 ? (
            <p className="ss-emptyline">
              {loading ? 'Loading…' : enrollments.length === 0 ? 'No enrollments yet.' : 'No students match these filters.'}
            </p>
          ) : (
            <>
              <div className="ss-row" style={{ alignItems: 'center' }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flex: 1, color: 'var(--theme-elevation-600)', fontSize: 12 }}>
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} /> Select all ({visible.length})
                </label>
              </div>
              {visible.map((r) => {
                const rid = String(r.enrollmentId)
                return (
                  <div key={r.enrollmentId} className="ss-row" style={{ alignItems: 'center' }}>
                    <input type="checkbox" checked={selected.has(rid)} onChange={() => toggleRow(rid)} style={{ marginRight: 12 }} />
                    <span className="ss-row__name" style={{ flex: 1 }}>
                      <a href={`/admin/programs/students/${r.studentId}`} style={{ color: 'var(--theme-text)', textDecoration: 'underline', textDecorationColor: 'var(--theme-elevation-200)' }}>{r.name}</a>
                      <span style={{ display: 'block', fontSize: 12, color: 'var(--theme-elevation-500)', marginTop: 2 }}>{r.className}</span>
                    </span>
                    <span className={`ss-pill${r.status === 'withdrawn' ? ' ss-pill--muted' : ''}`}>{r.status}</span>
                  </div>
                )
              })}
              <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--theme-elevation-500)', marginTop: 8 }}>{visible.length} of {enrollments.length}</div>
            </>
          )}
        </div>
      )}

      {/* ---------- ADD STUDENT MODAL ---------- */}
      {addOpen && (
        <div
          onClick={() => setAddOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: 'var(--theme-elevation-0)', border: '1px solid var(--theme-elevation-150)', borderRadius: 10, padding: 24, width: 'min(520px, 94vw)', boxShadow: '0 24px 70px rgba(0,0,0,.35)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 18 }}>Add &amp; enroll a student</h3>
              <button className="ss-btn ss-btn--ghost ss-btn--small" onClick={() => setAddOpen(false)} aria-label="Close"><X size={16} /></button>
            </div>
            <div className="ss-grid">
              <input className="ss-input" placeholder="First name" value={first} onChange={(e) => setFirst(e.target.value)} />
              <input className="ss-input" placeholder="Last name" value={last} onChange={(e) => setLast(e.target.value)} />
              <input className="ss-input" placeholder="Age" type="number" value={age} onChange={(e) => setAge(e.target.value)} />
              <input className="ss-input" placeholder="Guardian name" value={guardian} onChange={(e) => setGuardian(e.target.value)} />
              <select className="ss-select" value={newClass} onChange={(e) => setNewClass(e.target.value)}>
                <option value="">Enroll in class…</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
              <button className="ss-btn ss-btn--ghost" onClick={() => setAddOpen(false)}>Cancel</button>
              <button className="ss-btn" disabled={busy || !first || !last || !newClass} onClick={addNew}>
                <UserPlus size={16} /> Add &amp; enroll
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Enrollment
