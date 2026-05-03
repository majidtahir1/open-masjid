import React from 'react'
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MilestonePanel } from '@/admin/onboarding/MilestonePanel'

describe('onboarding donations milestone — MilestonePanel', () => {
  describe('not connected state (status: null)', () => {
    const html = renderToStaticMarkup(
      <MilestonePanel slug="donations" status={null} onBack={() => {}} />,
    )

    it('renders primary "Connect Stripe" action linking to /api/stripe/connect/authorize', () => {
      expect(html).toContain('Connect Stripe')
      expect(html).toContain('href="/api/stripe/connect/authorize"')
    })

    it('renders secondary "Use external link instead" action linking to tenant settings', () => {
      expect(html).toContain('Use external link instead')
      expect(html).toContain('href="/admin/collections/tenants"')
    })

    it('renders tertiary "Skip for now" action', () => {
      expect(html).toContain('Skip for now')
    })

    it('uses brand primary CTA pattern (var(--brand)) for the connect action', () => {
      // Primary CTA shares the existing PrimaryLink styling — uses --brand background.
      expect(html).toContain('var(--brand)')
    })

    it('does not contain disallowed token violations', () => {
      expect(html).not.toMatch(/text-\[#|bg-\[#/)
      expect(html).not.toMatch(/rounded-lg|shadow-lg/)
      expect(html).not.toMatch(/border-gray-|bg-gray-/)
    })
  })

  describe('connected state (status: complete)', () => {
    const html = renderToStaticMarkup(
      <MilestonePanel slug="donations" status="complete" onBack={() => {}} />,
    )

    it('renders a compact connected affordance linking to /admin/donations/connect', () => {
      expect(html).toContain('href="/admin/donations/connect"')
    })

    it('does not render the not-connected three-action set', () => {
      expect(html).not.toContain('Skip for now')
      expect(html).not.toContain('Use external link instead')
    })
  })

  describe('non-donations slug regression', () => {
    it('still renders the default primary CTA for branding', () => {
      const html = renderToStaticMarkup(
        <MilestonePanel slug="branding" status={null} onBack={() => {}} />,
      )
      expect(html).toContain('Open branding settings')
      expect(html).not.toContain('Connect Stripe')
      expect(html).not.toContain('Skip for now')
    })
  })
})
