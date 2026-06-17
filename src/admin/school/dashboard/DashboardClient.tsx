'use client'
import React from 'react'
import Link from 'next/link'
import { Users, GraduationCap, Percent, CalendarCheck, AlertTriangle } from 'lucide-react'
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
  if (!term) {
    return (
      <div className="ss-root">
        <SchoolTabs />
        <section className="ss-empty">
          <p className="ss-eyebrow">Sunday school</p>
          <h1 className="ss-empty__title">No active term yet</h1>
          <p className="ss-empty__body">Set up a term to unlock the dashboard.</p>
          <Link className="ss-btn" href="/admin/sunday-school/setup?step=1">Start setup</Link>
        </section>
      </div>
    )
  }
  return (
    <div className="ss-root">
      <SchoolTabs />
      <header className="ss-masthead">
        <p className="ss-eyebrow">Current term</p>
        <h1 className="ss-masthead__title">{term.name}</h1>
        <SessionTimeline startDate={term.startDate} endDate={term.endDate} meetingDays={term.meetingDays} holidays={term.holidays} variant="masthead" />
      </header>

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
            {data.attention.teacherlessClasses > 0 && <Link href="/admin/sunday-school/classes">{data.attention.teacherlessClasses} class(es) without a teacher</Link>}
            {data.attention.teacherlessClasses > 0 && data.attention.unplacedStudents > 0 && ' · '}
            {data.attention.unplacedStudents > 0 && <Link href="/admin/sunday-school/setup?step=4">{data.attention.unplacedStudents} student(s) to place</Link>}
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
