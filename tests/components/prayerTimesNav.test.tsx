import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import Header from '@/components/Header'
import Footer from '@/components/Footer'

const footerTenant = {
  name: 'Test Masjid',
  contactInfo: null,
  socialLinks: null,
  footerTagline: null,
  logoUrl: null,
}

describe('Header prayer times nav', () => {
  it('includes the Prayer Times link when the tenant has an active schedule', () => {
    const html = renderToStaticMarkup(<Header hasPrayerSchedule />)
    expect(html).toContain('href="/prayer-times"')
  })

  it('omits the Prayer Times link when the tenant has no active schedule', () => {
    const html = renderToStaticMarkup(<Header hasPrayerSchedule={false} />)
    expect(html).not.toContain('href="/prayer-times"')
    expect(html).toContain('href="/events"')
  })

  it('defaults to showing the Prayer Times link', () => {
    const html = renderToStaticMarkup(<Header />)
    expect(html).toContain('href="/prayer-times"')
  })
})

describe('Footer prayer times quick link', () => {
  it('includes the Prayer Times link when the tenant has an active schedule', () => {
    const html = renderToStaticMarkup(<Footer tenant={footerTenant} hasPrayerSchedule />)
    expect(html).toContain('href="/prayer-times"')
  })

  it('omits the Prayer Times link when the tenant has no active schedule', () => {
    const html = renderToStaticMarkup(
      <Footer tenant={footerTenant} hasPrayerSchedule={false} />,
    )
    expect(html).not.toContain('href="/prayer-times"')
    expect(html).toContain('href="/donate"')
  })
})
