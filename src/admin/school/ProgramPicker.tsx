'use client'
import React, { useEffect, useState } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
import { api } from './api'
import { resolveProgramId } from '@/lib/program-context'

interface Program { id: string | number; name: string; status?: string; startDate?: string | null }

const ProgramPicker: React.FC = () => {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [programs, setPrograms] = useState<Program[]>([])

  useEffect(() => {
    api('/terms?limit=1000&depth=0&sort=-startDate').then((r) => setPrograms(r.docs ?? [])).catch(() => {})
  }, [])

  if (programs.length === 0) return null
  const requested = params.get('program')
  const selected = resolveProgramId(requested, programs)

  const go = (value: string) => {
    if (value === 'new') { router.push('/admin/sunday-school/setup?program=new'); return }
    const next = new URLSearchParams(Array.from(params.entries()))
    next.set('program', value)
    router.push(`${pathname}?${next.toString()}`)
  }

  return (
    <div className="ss-progpick">
      <label className="ss-progpick__label">Program</label>
      <div className="ss-progpick__wrap">
        <select className="ss-progpick__select" value={selected != null ? String(selected) : ''} onChange={(e) => go(e.target.value)}>
          {programs.map((p) => (
            <option key={p.id} value={String(p.id)}>{p.name}{p.status === 'archived' ? ' (archived)' : ''}</option>
          ))}
          <option value="new">+ New program…</option>
        </select>
        <ChevronDown size={15} className="ss-progpick__chev" />
      </div>
    </div>
  )
}

export default ProgramPicker
