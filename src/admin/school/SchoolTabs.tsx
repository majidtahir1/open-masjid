'use client'
import React from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { LayoutDashboard, GraduationCap, Users, ClipboardList, Wand2, UserCheck } from 'lucide-react'
import ProgramPicker from './ProgramPicker'

// `soon: true` marks a tab whose route isn't built yet — rendered disabled so
// there are no dead links. Drop the flag when the route exists.
type Tab = { href: string; label: string; icon: React.ComponentType<{ size?: number }>; exact?: boolean; soon?: boolean }
const TABS: Tab[] = [
  { href: '/admin/sunday-school', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/admin/sunday-school/classes', label: 'Classes', icon: GraduationCap },
  { href: '/admin/sunday-school/students', label: 'Students', icon: Users },
  { href: '/admin/sunday-school/attendance', label: 'Attendance', icon: ClipboardList },
  { href: '/admin/sunday-school/whos-here', label: "Who's here", icon: UserCheck },
  { href: '/admin/sunday-school/setup', label: 'Setup', icon: Wand2 },
]

const SchoolTabs: React.FC = () => {
  const path = usePathname()
  const params = useSearchParams()
  const program = params.get('program')
  return (
    <>
      <ProgramPicker />
      <nav className="ss-tabs" aria-label="Programs sections">
        {TABS.map((t) => {
          const active = t.exact ? path === t.href : path.startsWith(t.href)
          const Icon = t.icon
          if (t.soon) {
            return (
              <span key={t.href} className="ss-tab ss-tab--soon" aria-disabled="true" title="Coming soon">
                <Icon size={16} /> {t.label} <span className="ss-tab__soon">soon</span>
              </span>
            )
          }
          return (
            <Link key={t.href} href={program ? `${t.href}?program=${program}` : t.href} className={`ss-tab${active ? ' ss-tab--active' : ''}`} aria-current={active ? 'page' : undefined}>
              <Icon size={16} /> {t.label}
            </Link>
          )
        })}
      </nav>
    </>
  )
}

export default SchoolTabs
