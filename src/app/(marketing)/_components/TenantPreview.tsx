import type { CSSProperties, ReactNode } from 'react'
import { Lock } from './Icons'

export function BrowserFrame({
  url = 'alnoor.openmasjid.app',
  children,
}: {
  url?: string
  children: ReactNode
}) {
  return (
    <div className="om-browser">
      <div className="om-browser-bar">
        <div className="om-browser-dots"><span /><span /><span /></div>
        <div className="om-browser-url">
          <Lock width={11} height={11} />
          <span>{url}</span>
        </div>
        <div style={{ width: 52 }} />
      </div>
      <div className="om-browser-body">{children}</div>
    </div>
  )
}

type Brand = { primary: string; accent: string; name: string; city: string }

export function TenantPreview({
  variant = 'default',
  brand = { primary: '#0F1E4A', accent: '#1E7E8E', name: 'Masjid Al-Noor', city: 'Plano, TX' },
}: {
  variant?: 'default' | 'compact'
  brand?: Brand
}) {
  const tBrand = brand.primary
  const tAccent = brand.accent
  const style = { ['--t-brand']: tBrand, ['--t-accent']: tAccent } as CSSProperties

  return (
    <div className="om-tenant" style={style}>
      <div className="om-tenant-strip">
        <span className="om-tenant-strip-tag">19 Shawwal · Today</span>
        <div className="om-tenant-strip-times">
          <span>Fajr <b>5:18</b></span>
          <span>Dhuhr <b>1:30</b></span>
          <span>Asr <b>5:42</b></span>
          <span>Maghrib <b>7:55</b></span>
          <span>Isha <b>9:25</b></span>
        </div>
      </div>

      <div className="om-tenant-header">
        <div className="om-tenant-brand">
          <span className="om-tenant-mark" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 40 40">
              <path d="M7 33 V19 C7 12.4 12.8 7 20 7 C27.2 7 33 12.4 33 19 V33 H7 Z" fill={tBrand} />
              <path d="M14.5 33 V20.5 C14.5 17.4 16.9 15 20 15 C23.1 15 25.5 17.4 25.5 20.5 V33 H14.5 Z" fill="white" />
            </svg>
          </span>
          <div>
            <p className="om-tenant-name">{brand.name}</p>
            <p className="om-tenant-city">{brand.city}</p>
          </div>
        </div>
        <nav className="om-tenant-nav">
          <span>Prayer</span>
          <span>Events</span>
          <span>Programs</span>
          <span>About</span>
          <span className="om-tenant-cta">Donate</span>
        </nav>
      </div>

      <div className="om-tenant-hero">
        <div>
          <p className="om-tenant-eyebrow">Welcome to {brand.name.split(' ')[1] || brand.name}</p>
          <h2 className="om-tenant-h1">A community built on knowledge, <em>tarbiya</em>, and prayer.</h2>
          <p className="om-tenant-sub">Daily salah, weekend school, youth programs, and a home for every Muslim in {brand.city.split(',')[0]}.</p>
          <div className="om-tenant-hero-cta">
            <span className="om-tenant-btn primary">Plan a visit</span>
            <span className="om-tenant-btn ghost">Today's khutba →</span>
          </div>
        </div>
        <div className="om-tenant-hero-card">
          <p className="om-tenant-card-tag">Next Jummah · Friday</p>
          <p className="om-tenant-card-time">12:45 <span>pm</span></p>
          <p className="om-tenant-card-meta">Khutba 1 of 3 · Br. Yusuf</p>
          <div className="om-tenant-card-slots">
            <span>1:30 pm</span>
            <span>2:15 pm</span>
          </div>
        </div>
      </div>

      {variant !== 'compact' && (
        <div className="om-tenant-events">
          <p className="om-tenant-events-heading">Upcoming at {brand.name.split(' ')[1] || brand.name}</p>
          <div className="om-tenant-events-grid">
            <div className="om-tenant-event">
              <div
                className="om-tenant-event-flyer"
                style={{ background: `linear-gradient(135deg, ${tBrand}, ${tAccent})` }}
              >
                <span className="om-tenant-event-date"><b>04</b><span>MAY</span></span>
                <span className="om-tenant-event-flyer-mark">✦</span>
              </div>
              <p className="om-tenant-event-title">Sisters' halaqa: Surah Al-Mulk</p>
              <p className="om-tenant-event-meta">Sat · 10:30 am · Sisters' hall</p>
            </div>
            <div className="om-tenant-event">
              <div className="om-tenant-event-flyer alt">
                <span className="om-tenant-event-date"><b>11</b><span>MAY</span></span>
                <span className="om-tenant-event-flyer-mark">✦</span>
              </div>
              <p className="om-tenant-event-title">Youth night + pizza</p>
              <p className="om-tenant-event-meta">Sat · 7:00 pm · Gym</p>
            </div>
            <div className="om-tenant-event">
              <div className="om-tenant-event-flyer gold">
                <span className="om-tenant-event-date"><b>17</b><span>MAY</span></span>
                <span className="om-tenant-event-flyer-mark">✦</span>
              </div>
              <p className="om-tenant-event-title">Quran academy open house</p>
              <p className="om-tenant-event-meta">Fri · After Maghrib</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
