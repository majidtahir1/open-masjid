'use client'

/**
 * SubmissionsList — toolbar injected above Payload's default submissions table.
 *
 * Artboard ref: 4.1 subs-list
 *
 * Row 1: form selector (dropdown when no ?form param; form name + back link when filtered)
 * Row 2: status filter pills (All / New / Reviewed / Archived) + Export CSV button
 *
 * The ?form=<id> and ?status=<value> query params are written via Next.js router so
 * Payload's own list table picks them up through its built-in URL-driven where filter.
 *
 * Note: Payload's list view reads `where[field][operator]=value` from the URL.
 * We push `?where[form][equals]=<id>` and `?where[status][equals]=<value>` so the
 * default table automatically filters without any server-side custom code.
 */

import { useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, Download } from 'lucide-react'
import './submissions.css'

interface FormOption {
  id: string
  slug: string
  title: string
}

type StatusFilter = 'all' | 'new' | 'reviewed' | 'archived'

const STATUS_PILLS: Array<{ id: StatusFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'new', label: 'New' },
  { id: 'reviewed', label: 'Reviewed' },
  { id: 'archived', label: 'Archived' },
]

export default function SubmissionsList() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Parse current filter state from URL
  // Payload uses `where[form][equals]=<id>` style params
  const formIdParam = searchParams.get('where[form][equals]') ?? searchParams.get('form') ?? ''
  const statusParam =
    (searchParams.get('where[status][equals]') ?? searchParams.get('status') ?? 'all') as StatusFilter

  const activeStatus: StatusFilter =
    ['all', 'new', 'reviewed', 'archived'].includes(statusParam) ? statusParam : 'all'

  const [forms, setForms] = useState<FormOption[]>([])
  const [selectedFormName, setSelectedFormName] = useState<string>('')
  const [selectedFormSlug, setSelectedFormSlug] = useState<string>('')
  const [loading, setLoading] = useState(false)

  // Fetch forms list for the dropdown (only when no specific form is pre-selected)
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch('/api/forms?limit=100&depth=0', { credentials: 'include' })
      .then((r) => r.json())
      .then((data: { docs?: Array<{ id: string; slug: string; title: string }> }) => {
        if (cancelled) return
        const docs = data?.docs ?? []
        setForms(docs.map((f) => ({ id: String(f.id), slug: f.slug ?? '', title: f.title ?? 'Untitled' })))
        // If there's already a formId param, find the matching form name
        if (formIdParam) {
          const match = docs.find((f) => String(f.id) === formIdParam)
          if (match) {
            setSelectedFormName(match.title ?? 'Untitled')
            setSelectedFormSlug(match.slug ?? '')
          }
        }
      })
      .catch(() => {
        // swallow — the toolbar is purely cosmetic, the table still shows data
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [formIdParam])

  const buildUrl = useCallback(
    (formId: string, status: StatusFilter) => {
      const params = new URLSearchParams(searchParams.toString())

      // Remove old filter params
      params.delete('where[form][equals]')
      params.delete('where[status][equals]')
      params.delete('form')
      params.delete('status')
      params.delete('page') // reset pagination when filters change

      if (formId) {
        params.set('where[form][equals]', formId)
      }
      if (status !== 'all') {
        params.set('where[status][equals]', status)
      }

      const qs = params.toString()
      return qs ? `?${qs}` : '/admin/collections/form-submissions'
    },
    [searchParams],
  )

  const handleFormChange = useCallback(
    (formId: string) => {
      const match = forms.find((f) => f.id === formId)
      if (match) {
        setSelectedFormName(match.title)
        setSelectedFormSlug(match.slug)
      } else {
        setSelectedFormName('')
        setSelectedFormSlug('')
      }
      router.push(buildUrl(formId, activeStatus), { scroll: false })
    },
    [forms, activeStatus, buildUrl, router],
  )

  const handleStatusChange = useCallback(
    (status: StatusFilter) => {
      router.push(buildUrl(formIdParam, status), { scroll: false })
    },
    [formIdParam, buildUrl, router],
  )

  const handleBackToAll = useCallback(() => {
    router.push(buildUrl('', activeStatus), { scroll: false })
    setSelectedFormName('')
    setSelectedFormSlug('')
  }, [activeStatus, buildUrl, router])

  const exportHref = selectedFormSlug
    ? `/api/forms/${selectedFormSlug}/submissions.csv`
    : null

  const isExportDisabled = !exportHref

  return (
    <div className="subs-toolbar">
      {/* Row 1: form selector / form name + back link */}
      <div className="subs-form-row">
        {formIdParam ? (
          <>
            <span className="subs-form-name">{selectedFormName || 'Loading…'}</span>
            <button
              type="button"
              className="subs-back-link"
              onClick={handleBackToAll}
            >
              <ChevronLeft size={13} strokeWidth={1.75} />
              All submissions
            </button>
          </>
        ) : (
          <>
            <label className="subs-form-label" htmlFor="subs-form-select">
              Form:
            </label>
            <select
              id="subs-form-select"
              className="subs-form-select"
              value={formIdParam}
              onChange={(e) => handleFormChange(e.target.value)}
              disabled={loading}
            >
              <option value="">All forms</option>
              {forms.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.title}
                </option>
              ))}
            </select>
          </>
        )}
      </div>

      {/* Row 2: status filter pills + Export CSV */}
      <div className="subs-filter-row">
        <div className="subs-status-filters" role="group" aria-label="Filter by status">
          {STATUS_PILLS.map((pill) => (
            <button
              key={pill.id}
              type="button"
              className={[
                'subs-filter-pill',
                `subs-filter-pill--${pill.id}`,
                activeStatus === pill.id ? 'subs-filter-pill--active' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => handleStatusChange(pill.id)}
              aria-pressed={activeStatus === pill.id}
            >
              {pill.label}
            </button>
          ))}
        </div>

        {isExportDisabled ? (
          <span
            className="subs-export-btn"
            aria-disabled="true"
            title="Select a specific form to enable CSV export"
          >
            <Download size={13} strokeWidth={1.75} />
            Export CSV
          </span>
        ) : (
          <a
            href={exportHref!}
            className="subs-export-btn"
            download
            title={`Export submissions for this form as CSV`}
          >
            <Download size={13} strokeWidth={1.75} />
            Export CSV
          </a>
        )}
      </div>
    </div>
  )
}
