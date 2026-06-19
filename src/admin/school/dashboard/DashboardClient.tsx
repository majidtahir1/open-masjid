'use client'
import React from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Users, GraduationCap, Percent, CalendarCheck, AlertTriangle, ClipboardCheck, Wand2, UserCheck, Tablet } from 'lucide-react'
import SchoolTabs from '../SchoolTabs'
import SessionTimeline from '../SessionTimeline'
import Donut from '../charts/Donut'
import Bars from '../charts/Bars'
import AreaTrend from '../charts/AreaTrend'
import type { Kpis, TrendPoint, ClassRate, ClassCount, Status } from '@/lib/school-reports'
import '../sunday-school.css'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const shortDate = (iso: string) => { const [, m, d] = iso.split('-').map(Number); return `${MONTHS[(m ?? 1) - 1]} ${d}` }

export interface DashboardData {
  term: { name: string; startDate?: string | null; endDate?: string | null; meetingDays: string[]; holidays: string[] } | null
  kpis: Kpis
  trend: TrendPoint[]
  rateByClass: ClassRate[]
  statusBreakdown: Record<Status, number>
  enrollmentByClass: ClassCount[]
  attention: { teacherlessClasses: number; unplacedStudents: number }
}

const Card: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="ss-card ss-panel">
    <p className="ss-eyebrow">{title}</p>
    {children}
  </div>
)

const DashboardClient: React.FC<{ data: DashboardData }> = ({ data }) => {
  const { term, kpis } = data
  const params = useSearchParams()
  const program = params.get('program')
  const progQ = program ? `?program=${program}` : ''
  if (!term) {
    return (
      <div className="ss-root">
        <SchoolTabs />
        <section className="ss-empty">
          <p className="ss-eyebrow">Programs</p>
          <h1 className="ss-empty__title">No program yet</h1>
          <p className="ss-empty__body">Set up a program to unlock the dashboard.</p>
          <Link className="ss-btn" href="/admin/programs/setup?step=1">Start setup</Link>
        </section>
      </div>
    )
  }
  return (
    <div className="ss-root">
      <SchoolTabs />
      <header className="ss-masthead">
        <p className="ss-eyebrow">Current program</p>
        <h1 className="ss-masthead__title">{term.name}</h1>
        <SessionTimeline startDate={term.startDate} endDate={term.endDate} meetingDays={term.meetingDays} holidays={term.holidays} variant="masthead" />
        <div className="ss-rhythm-legend">
          <span className="ss-rhythm-legend__item">
            <i className="ss-rhythm-legend__dot" />
            Class day
          </span>
          <span className="ss-rhythm-legend__item">
            <i className="ss-rhythm-legend__dot ss-rhythm-legend__dot--off" />
            <span style={{ textDecoration: 'line-through' }}>Day off</span>
          </span>
        </div>
      </header>

      <div className="ss-actions" style={{ margin: '16px 0 0' }}>
        <Link className="ss-btn" href={`/admin/take-attendance${progQ}`}><ClipboardCheck size={18} /> Take attendance</Link>
        <Link className="ss-btn ss-btn--ghost" href={`/admin/programs/whos-here${progQ}`}><UserCheck size={18} /> Who&apos;s here</Link>
        <a className="ss-btn ss-btn--ghost" href="/checkin" target="_blank" rel="noreferrer"><Tablet size={18} /> Check-in kiosk</a>
        <Link className="ss-btn ss-btn--ghost" href={`/admin/programs/setup${progQ}`}><Wand2 size={18} /> Edit program</Link>
      </div>

      <div className="ss-stats">
        <div className="ss-stat"><span className="ss-stat__icon"><Users size={19} /></span><div className="ss-stat__num">{kpis.students}</div><div className="ss-stat__label">students</div></div>
        <div className="ss-stat"><span className="ss-stat__icon"><GraduationCap size={19} /></span><div className="ss-stat__num">{kpis.activeClasses}</div><div className="ss-stat__label">active classes</div></div>
        <div className="ss-stat ss-stat--good"><span className="ss-stat__icon"><Percent size={19} /></span><div className="ss-stat__num">{Math.round(kpis.avgAttendanceRate * 100)}%</div><div className="ss-stat__label">avg attendance</div></div>
        <div className="ss-stat"><span className="ss-stat__icon"><CalendarCheck size={19} /></span><div className="ss-stat__num">{kpis.sessionsHeld}</div><div className="ss-stat__label">sessions held · {kpis.sessionsUpcoming} upcoming</div></div>
      </div>

      {(data.attention.teacherlessClasses > 0 || data.attention.unplacedStudents > 0) && (
        <div className="ss-attention">
          <AlertTriangle size={16} />
          <span>
            {data.attention.teacherlessClasses > 0 && <Link href="/admin/programs/classes">{data.attention.teacherlessClasses} class(es) without a teacher</Link>}
            {data.attention.teacherlessClasses > 0 && data.attention.unplacedStudents > 0 && ' · '}
            {data.attention.unplacedStudents > 0 && <Link href={`/admin/programs/enrollment${progQ}`}>{data.attention.unplacedStudents} student(s) to place</Link>}
          </span>
        </div>
      )}

      <div className="ss-grid2">
        <Card title="Attendance trend">
          <AreaTrend data={data.trend.map((t) => ({ label: shortDate(t.date), value: t.presentRate }))} />
        </Card>
        <Card title="Status breakdown">
          <Donut segments={[
            { label: 'Present', value: data.statusBreakdown.present, color: 'var(--ss-teal-500)' },
            { label: 'Late', value: data.statusBreakdown.late, color: 'var(--ss-gold-500)' },
            { label: 'Excused', value: data.statusBreakdown.excused, color: 'var(--theme-elevation-400)' },
            { label: 'Absent', value: data.statusBreakdown.absent, color: 'var(--theme-error-500, #d4584c)' },
          ]} />
        </Card>
        <Card title="Attendance rate by class">
          <Bars mode="ratio" rows={data.rateByClass.map((r) => ({ label: r.name, value: r.rate }))} />
        </Card>
        <Card title="Enrollment by class">
          <Bars rows={data.enrollmentByClass.map((r) => ({ label: r.name, value: r.count }))} color="var(--ss-navy-700)" />
        </Card>
      </div>
    </div>
  )
}

export default DashboardClient
