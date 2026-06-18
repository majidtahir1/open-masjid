'use client'
import React, { useEffect, useState } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
import { api } from './api'
import { PROGRAM_COOKIE, resolveProgramId } from '@/lib/program-context'

function readCookie(name: string): string | null {
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return m ? decodeURIComponent(m[1]) : null
}

interface Program { id: string | number; name: string; status?: string; startDate?: string | null }

const ProgramPicker: React.FC = () => {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [programs, setPrograms] = useState<Program[]>([])
  const [canCreate, setCanCreate] = useState(false)

  useEffect(() => {
    api('/terms?limit=1000&depth=0&sort=-startDate').then((r) => setPrograms(r.docs ?? [])).catch(() => {})
  }, [])

  useEffect(() => {
    api('/users/me').then((r) => {
      const role = r?.user?.role
      setCanCreate(role === 'admin' || role === 'platformOwner')
    }).catch(() => {})
  }, [])

  if (programs.length === 0) return null
  // Fall back to the persisted cookie when the URL has no ?program, so the
  // picker shows the same program the server resolved on a fresh entry.
  const requested = params.get('program') ?? readCookie(PROGRAM_COOKIE)
  const selected = resolveProgramId(requested, programs)

  const go = (value: string) => {
    if (value === 'new') { router.push('/admin/sunday-school/setup?program=new'); return }
    // Persist the choice so other school pages default to it without a ?program.
    document.cookie = `${PROGRAM_COOKIE}=${encodeURIComponent(value)}; path=/admin; max-age=${60 * 60 * 24 * 180}; samesite=lax`
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
          {canCreate && (
            <option value="new">+ New program…</option>
          )}
        </select>
        <ChevronDown size={15} className="ss-progpick__chev" />
      </div>
    </div>
  )
}

export default ProgramPicker
