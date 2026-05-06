'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Props { formId: string | number }

interface Sub {
  id: string | number
  submittedAt: string
  submitterEmail: string | null
  status: string
  paymentStatus: string
}

export default function SubmissionsTab({ formId }: Props) {
  const [docs, setDocs] = useState<Sub[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    fetch(`/api/form-submissions?where[form][equals]=${formId}&limit=10&sort=-submittedAt`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`status ${r.status}`))))
      .then((res) => { if (!cancelled) setDocs(res?.docs ?? []) })
      .catch((e: Error) => { if (!cancelled) setError(e.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [formId])

  if (loading) return <div className="fev-tab-empty">Loading submissions…</div>
  if (error) return <div className="fev-tab-empty">Could not load submissions: {error}</div>
  if (docs.length === 0)
    return (
      <div className="fev-tab-empty">
        <p>No submissions yet.</p>
        <p style={{ fontSize: 13, color: '#6b7280' }}>
          Once people fill out the form, recent submissions will appear here.
        </p>
      </div>
    )
  return (
    <div className="fev-subs">
      <table className="fev-subs-table">
        <thead><tr><th>Submitted</th><th>Email</th><th>Status</th><th>Payment</th></tr></thead>
        <tbody>
          {docs.map((d) => (
            <tr key={d.id}>
              <td>{new Date(d.submittedAt).toLocaleString()}</td>
              <td>{d.submitterEmail ?? '—'}</td>
              <td>{d.status}</td>
              <td>{d.paymentStatus === 'na' ? '—' : d.paymentStatus}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Link
        href={`/admin/collections/form-submissions?where[form][equals]=${formId}`}
        className="fev-subs-all"
      >
        View all submissions →
      </Link>
    </div>
  )
}
