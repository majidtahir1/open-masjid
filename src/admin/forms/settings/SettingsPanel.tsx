'use client'

import React from 'react'
import SettingsNav, { type SettingsSectionId } from './SettingsNav'
import Basics from './sections/Basics'
import SubmissionLimits from './sections/SubmissionLimits'
import Notifications from './sections/Notifications'
import Payment from './sections/Payment'
import Confirmation from './sections/Confirmation'
import Appearance from './sections/Appearance'
import Webhooks from './sections/Webhooks'
import EmbedShare from './sections/EmbedShare'
import './settings.css'

interface SettingsPanelProps {
  section: SettingsSectionId
  onSectionChange: (sectionId: SettingsSectionId) => void
}

function SectionContent({ section }: { section: SettingsSectionId }) {
  switch (section) {
    case 'basics':
      return <Basics />
    case 'submission-limits':
      return <SubmissionLimits />
    case 'notifications':
      return <Notifications />
    case 'payment':
      return <Payment />
    case 'confirmation':
      return <Confirmation />
    case 'appearance':
      return <Appearance />
    case 'webhooks':
      return <Webhooks />
    case 'embed-share':
      return <EmbedShare />
    default:
      return <Basics />
  }
}

/**
 * SettingsPanel — composes the left-rail SettingsNav (220px) with the active
 * section's content cards on the right. Designed to be mounted under the
 * "Settings" tab of the form editor toolbar (Task D4).
 *
 * Reads and writes form fields via Payload's `useField()` hooks, so it must
 * be rendered inside a Payload document context (within an admin custom view).
 */
export default function SettingsPanel({ section, onSectionChange }: SettingsPanelProps) {
  return (
    <div>
      <h2 className="settings-heading">Settings</h2>
      <div className="settings-layout">
        <SettingsNav currentSection={section} onSelect={onSectionChange} />
        <div className="settings-content">
          <SectionContent section={section} />
        </div>
      </div>
    </div>
  )
}
