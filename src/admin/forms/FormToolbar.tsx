'use client'

/**
 * FormToolbar — sticky top nav for the form editor.
 *
 * Artboard refs: sticky row visible across 2.x, 3.1, 4.1 in the design handoff.
 *
 * Left side:  form title + status pill + slug + submission count
 * Right side: Build / Settings / Submissions tabs + Preview + View live + Save
 *
 * Tab state is managed via URL query param `?tab=build|settings|submissions`.
 * We use Next.js `useSearchParams` + `useRouter` for navigation.
 */

import { useCallback, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useField, useDocumentInfo } from '@payloadcms/ui'
import { ExternalLink, Eye } from 'lucide-react'
import type { SettingsSectionId } from './settings/SettingsNav'
import SettingsPanel from './settings/SettingsPanel'
import './toolbar.css'

export type ToolbarTab = 'build' | 'settings' | 'submissions'

// ---------------------------------------------------------------------------
// Submissions placeholder
// ---------------------------------------------------------------------------

function SubmissionsPlaceholder() {
  return (
    <div className="ft-submissions-placeholder">
      <p className="ft-submissions-placeholder__text">
        Submissions appear here. Visit the{' '}
        <strong>Submissions</strong> collection list to filter to this form.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// FormToolbar
// ---------------------------------------------------------------------------

interface FormToolbarProps {
  /** The builder canvas child (rendered under the Build tab) */
  children: React.ReactNode
}

export default function FormToolbar({ children }: FormToolbarProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const rawTab = searchParams.get('tab') as ToolbarTab | null
  const activeTab: ToolbarTab =
    rawTab === 'settings' || rawTab === 'submissions' ? rawTab : 'build'

  // Settings sub-section state (managed here so Settings tab remounts cleanly)
  const [settingsSection, setSettingsSection] = useState<SettingsSectionId>('basics')

  // Pull form metadata from Payload field hooks
  const { value: title } = useField<string>({ path: 'title' })
  const { value: slug } = useField<string>({ path: 'slug' })
  const { value: status } = useField<string>({ path: 'status' })

  // useDocumentInfo for submission count (may not be available in all contexts)
  let submissionCount: number | undefined
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const docInfo = useDocumentInfo()
    // Payload doesn't expose submission count directly; use undefined for v1
    submissionCount = (docInfo as { totalCount?: number }).totalCount
  } catch {
    // useDocumentInfo not available in this context — ignore
  }

  const displayTitle = title || 'Untitled form'
  const displaySlug = slug || ''
  const publicUrl = displaySlug ? `/forms/${displaySlug}` : null

  const handleTabClick = useCallback(
    (tab: ToolbarTab) => {
      const params = new URLSearchParams(searchParams.toString())
      if (tab === 'build') {
        params.delete('tab')
      } else {
        params.set('tab', tab)
      }
      router.push(`?${params.toString()}`, { scroll: false })
    },
    [router, searchParams],
  )

  const TABS: Array<{ id: ToolbarTab; label: string }> = [
    { id: 'build', label: 'Build' },
    { id: 'settings', label: 'Settings' },
    { id: 'submissions', label: 'Submissions' },
  ]

  return (
    <div className="ft-root">
      {/* Sticky toolbar bar */}
      <div className="ft-bar">
        {/* Left: form metadata */}
        <div className="ft-meta">
          <span className="ft-meta__title">{displayTitle}</span>
          <div className="ft-meta__badges">
            {status && (
              <span
                className={`ft-status-pill ft-status-pill--${status}`}
              >
                {status}
              </span>
            )}
            {displaySlug && (
              <span className="ft-meta__slug">/{displaySlug}</span>
            )}
            {submissionCount !== undefined && (
              <span className="ft-meta__count">
                {submissionCount} submission{submissionCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        {/* Right: tabs + action buttons */}
        <div className="ft-right">
          {/* Tabs */}
          <div className="ft-tabs" role="tablist">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                className={`ft-tab${activeTab === tab.id ? ' ft-tab--active' : ''}`}
                onClick={() => handleTabClick(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Action buttons */}
          <div className="ft-actions">
            {/* Preview button */}
            {publicUrl && (
              <a
                href={publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ft-btn ft-btn--ghost"
                title="Preview form"
              >
                <Eye size={14} />
                Preview
              </a>
            )}

            {/* View live button */}
            {publicUrl && (
              <a
                href={publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ft-btn ft-btn--ghost"
                title="View live form"
              >
                <ExternalLink size={14} />
                View live
              </a>
            )}

            {/* Save — Payload's native save is in the document header above this component.
                We show a disabled button with an explanatory tooltip. */}
            <button
              type="button"
              className="ft-btn ft-btn--primary"
              disabled
              title="Use the document Save button in the header above"
            >
              Save
            </button>
          </div>
        </div>
      </div>

      {/* Tab panels */}
      <div className="ft-panel" role="tabpanel">
        {activeTab === 'build' && children}
        {activeTab === 'settings' && (
          <SettingsPanel
            section={settingsSection}
            onSectionChange={setSettingsSection}
          />
        )}
        {activeTab === 'submissions' && <SubmissionsPlaceholder />}
      </div>
    </div>
  )
}
