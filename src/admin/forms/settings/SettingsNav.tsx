'use client'

import React from 'react'
import {
  Settings,
  Users,
  Bell,
  CreditCard,
  Mail,
  Webhook,
  Share2,
} from 'lucide-react'
import './settings.css'

export type SettingsSectionId =
  | 'basics'
  | 'submission-limits'
  | 'notifications'
  | 'payment'
  | 'confirmation'
  | 'webhooks'
  | 'embed-share'

interface NavItem {
  id: SettingsSectionId
  label: string
  icon: React.ReactNode
}

const NAV_ITEMS: NavItem[] = [
  { id: 'basics', label: 'Basics', icon: <Settings size={16} /> },
  { id: 'submission-limits', label: 'Submission limits', icon: <Users size={16} /> },
  { id: 'notifications', label: 'Notifications', icon: <Bell size={16} /> },
  { id: 'payment', label: 'Payment', icon: <CreditCard size={16} /> },
  { id: 'confirmation', label: 'Confirmation', icon: <Mail size={16} /> },
  { id: 'webhooks', label: 'Webhooks', icon: <Webhook size={16} /> },
  { id: 'embed-share', label: 'Embed & share', icon: <Share2 size={16} /> },
]

interface SettingsNavProps {
  currentSection: SettingsSectionId
  onSelect: (sectionId: SettingsSectionId) => void
}

export default function SettingsNav({ currentSection, onSelect }: SettingsNavProps) {
  return (
    <nav className="settings-nav" aria-label="Settings sections">
      {NAV_ITEMS.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`settings-nav__item${currentSection === item.id ? ' settings-nav__item--active' : ''}`}
          onClick={() => onSelect(item.id)}
          aria-current={currentSection === item.id ? 'page' : undefined}
        >
          <span className="settings-nav__icon">{item.icon}</span>
          {item.label}
        </button>
      ))}
    </nav>
  )
}
