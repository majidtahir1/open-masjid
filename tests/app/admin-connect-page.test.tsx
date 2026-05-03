import React from 'react'
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import ConnectClient from '@/app/(payload)/admin/donations/connect/ConnectClient'

describe('admin donations connect — ConnectClient', () => {
  describe('not connected state', () => {
    it('renders the connect CTA linking to /api/stripe/connect/authorize', () => {
      const html = renderToStaticMarkup(
        <ConnectClient
          tenantName="Test Masjid"
          stripeAccountId={null}
          chargesEnabled={false}
          payoutsEnabled={false}
          status={null}
        />,
      )
      expect(html).toContain('Accept donations on your site')
      expect(html).toContain('href="/api/stripe/connect/authorize"')
      expect(html).toContain('bg-brand')
      // No disconnect button in this state
      expect(html).not.toContain('Disconnect')
    })

    it('renders an error banner when status param is present and not success', () => {
      const html = renderToStaticMarkup(
        <ConnectClient
          tenantName="Test Masjid"
          stripeAccountId={null}
          chargesEnabled={false}
          payoutsEnabled={false}
          status="invalid_state"
        />,
      )
      expect(html).toContain('bg-accent-soft')
      expect(html.toLowerCase()).toContain('expired')
    })
  })

  describe('connected state', () => {
    it('renders Disconnect button, masked acct id, and dashboard link', () => {
      const html = renderToStaticMarkup(
        <ConnectClient
          tenantName="Test Masjid"
          stripeAccountId="acct_1ABCDEFGHIJK1234"
          chargesEnabled={true}
          payoutsEnabled={false}
          status={null}
        />,
      )
      expect(html).toContain('Disconnect')
      // Masked account id ends in last 4
      expect(html).toContain('1234')
      expect(html).toContain('acct_')
      expect(html).toContain('https://dashboard.stripe.com/acct_1ABCDEFGHIJK1234/payments')
      // Two pills present
      expect(html).toContain('Charges enabled')
      expect(html).toContain('Payouts')
      // Green pill for charges (enabled), amber pill for payouts (disabled)
      expect(html).toContain('bg-success-soft')
      expect(html).toContain('bg-accent-soft')
    })
  })
})
