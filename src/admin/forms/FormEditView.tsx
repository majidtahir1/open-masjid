'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm, useDocumentInfo, useField } from '@payloadcms/ui'
import { ExternalLink, Eye } from 'lucide-react'
import { FormBuilderFieldClient } from './FormBuilderField.client'
import SettingsPanel from './settings/SettingsPanel'
import type { SettingsSectionId } from './settings/SettingsNav'
import SubmissionsTab from './SubmissionsTab'
import './form-edit-view.css'

type Tab = 'build' | 'settings' | 'submissions'

/**
 * Build a public-form URL that works regardless of which admin host the user
 * is on. Relative `/forms/<slug>` works on tenant subdomains. On the bare
 * platform host (`localhost:3000/admin` or `admin.openmasjid.app/admin`) we
 * inject the tenant subdomain.
 */
function buildPublicUrl(formSlug: string, tenantSlug: string | null): string {
  const path = `/forms/${formSlug}`
  if (typeof window === 'undefined') return path
  const host = window.location.host
  const firstLabel = host.split(':')[0].split('.')[0].toLowerCase()
  const isBareLocal = firstLabel === 'localhost' || firstLabel === '127' || firstLabel === '0'
  const isAdminHost = firstLabel === 'admin'
  if ((isBareLocal || isAdminHost) && tenantSlug) {
    return `${window.location.protocol}//${tenantSlug}.${host}${path}`
  }
  return path
}

export default function FormEditView() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const rawTab = searchParams.get('tab') as Tab | null
  const activeTab: Tab = rawTab === 'settings' || rawTab === 'submissions' ? rawTab : 'build'

  const [settingsSection, setSettingsSection] = useState<SettingsSectionId>('basics')

  // Field hooks — must be called at top level
  const { value: title } = useField<string>({ path: 'title' })
  const { value: slug } = useField<string>({ path: 'slug' })
  const { value: status } = useField<string>({ path: 'status' })
  const { value: tenantField } = useField<string | { id: string | number } | null>({ path: 'tenant' })

  const tenantId =
    tenantField && typeof tenantField === 'object' && 'id' in tenantField
      ? tenantField.id
      : (tenantField as string | number | null)

  // Hooks must be called unconditionally at top level (Rules of Hooks).
  // Inside Payload's edit-view context these are always available.
  const docInfo = useDocumentInfo() as { id?: string | number | null }
  const formId: string | number | null = docInfo?.id ?? null

  const formCtx = useForm() as {
    submit?: () => Promise<void> | void
    isProcessing?: boolean
  }
  const submitFn: (() => Promise<void> | void) | null =
    typeof formCtx?.submit === 'function' ? formCtx.submit.bind(formCtx) : null
  const isProcessing = formCtx?.isProcessing ?? false

  // Fetch tenant slug to build absolute public URL when on bare localhost
  const [tenantSlug, setTenantSlug] = useState<string | null>(null)
  useEffect(() => {
    if (!tenantId) return
    let cancelled = false
    fetch(`/api/tenants/${tenantId}?depth=0`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled && d?.slug) setTenantSlug(d.slug) })
      .catch(() => { /* fall back to relative URL */ })
    return () => { cancelled = true }
  }, [tenantId])

  const handleTabClick = useCallback(
    (tab: Tab) => {
      const params = new URLSearchParams(searchParams.toString())
      if (tab === 'build') params.delete('tab')
      else params.set('tab', tab)
      router.push(`?${params.toString()}`, { scroll: false })
    },
    [router, searchParams],
  )

  const displayTitle = title || 'Untitled form'
  const displaySlug = slug || ''
  const publicUrl = displaySlug ? buildPublicUrl(displaySlug, tenantSlug) : null

  const TABS: Array<{ id: Tab; label: string }> = [
    { id: 'build', label: 'Build' },
    { id: 'settings', label: 'Settings' },
    { id: 'submissions', label: 'Submissions' },
  ]

  return (
    <div className="fev-root">
      {/* Page-level header bar */}
      <div className="fev-bar">
        {/* Left: form metadata */}
        <div className="fev-meta">
          <span className="fev-meta__title">{displayTitle}</span>
          {status && (
            <span className={`fev-status fev-status--${status}`}>{status}</span>
          )}
          {displaySlug && (
            <span className="fev-meta__slug">/{displaySlug}</span>
          )}
        </div>

        {/* Right: tabs + action buttons */}
        <div className="fev-actions">
          <div className="fev-tabs" role="tablist">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                className={`fev-tab${activeTab === tab.id ? ' fev-tab--active' : ''}`}
                onClick={() => handleTabClick(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {publicUrl && (
            <a
              href={publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="fev-btn fev-btn--ghost"
              title="Preview form"
            >
              <Eye size={14} />
              Preview
            </a>
          )}

          {publicUrl && (
            <a
              href={publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="fev-btn fev-btn--ghost"
              title="View live form"
            >
              <ExternalLink size={14} />
              View live
            </a>
          )}

          {submitFn ? (
            <button
              type="button"
              className="fev-btn fev-btn--primary"
              onClick={() => submitFn!()}
              disabled={isProcessing}
            >
              {isProcessing ? 'Saving…' : 'Save'}
            </button>
          ) : (
            <button
              type="button"
              className="fev-btn fev-btn--primary"
              disabled
              title="Use the document Save button in the header above"
            >
              Save
            </button>
          )}
        </div>
      </div>

      {/* Tab panels */}
      <div className="fev-panel" role="tabpanel">
        {activeTab === 'build' && <FormBuilderFieldClient />}
        {activeTab === 'settings' && (
          <SettingsPanel section={settingsSection} onSectionChange={setSettingsSection} />
        )}
        {activeTab === 'submissions' && formId !== null && (
          <SubmissionsTab formId={formId} />
        )}
        {activeTab === 'submissions' && formId === null && (
          <div className="fev-tab-empty">
            <p>Save the form first to view submissions.</p>
          </div>
        )}
      </div>
    </div>
  )
}
