import type { CSSProperties } from 'react'
import { MarketingShell } from '../../../_components/MarketingShell'
import { BrowserFrame } from '../../../_components/TenantPreview'
import { FeatureCTA, FeatureHero, FeatureSection } from '../../../_components/FeatureSection'

export const metadata = {
  title: 'Prayer Times — OpenMasjid',
  description: 'Auto-calculated adhan times, iqamah rules, per-day overrides, multiple jummah slots, and Hijri dates — built around how masajid actually run.',
}

const PRAYER_ROWS: [string, string, string][] = [
  ['Fajr', '5:18', '5:35'],
  ['Dhuhr', '1:30', '1:45'],
  ['Asr', '5:42', '5:55'],
  ['Maghrib', '7:55', '7:58'],
  ['Isha', '9:25', '9:40'],
]

export default function PrayerTimesPage() {
  return (
    <MarketingShell current="/features/prayer-times">
      <FeatureHero
        eyebrow="Prayer Times"
        title="Prayer times your jamaa can"
        em="actually trust."
        sub="Adhan times calculated from your location, iqamah rules that handle the boring math, and per-day overrides for when life happens. Built around how masajid actually run."
      />

      <FeatureSection
        kicker="How it works"
        title="Set it once. We do the math every day."
        body={
          <ul className="om-list">
            <li><b>Adhan, calculated</b> — pick your method (ISNA, MWL, Karachi, Egyptian, Umm al-Qura) and Asr madhab. We compute the times from your masjid's lat/lng and timezone.</li>
            <li><b>Iqamah rules</b> — set rules like "Fajr iqamah = 30 min after adhan" or "Maghrib iqamah = adhan + 5, rounded to nearest 5." Apply for the whole year in one click.</li>
            <li><b>Per-day overrides</b> — Eid, Ramadan, weather. Edit any day inline in the admin. Your rules keep running for every other day.</li>
          </ul>
        }
        side={
          <div className="om-mockup-card">
            <p className="om-mockup-label">Admin · Prayer Times</p>
            <div className="om-prayer-table">
              <div className="om-prayer-row is-head">
                <span>Prayer</span><span>Adhan</span><span>Iqamah</span>
              </div>
              {PRAYER_ROWS.map(([n, a, i], idx) => (
                <div key={n} className="om-prayer-row">
                  <span>{n}</span>
                  <span className="muted">{a}</span>
                  <span>
                    <b>{i}</b>
                    {idx === 1 && (
                      <span className="om-pill om-pill-gold" style={{ marginLeft: 8, fontSize: 10 }}>override</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
            <p className="om-mockup-foot">ISNA · Plano, TX · Auto-generated for the year</p>
          </div>
        }
      />

      <FeatureSection
        alt
        kicker="Designed for jummah"
        title="Multiple slots, first-class."
        body="Not 'an event at 12 pm.' A jummah field that supports as many slots as you need ('12:45, 1:30, 2:15') and shows them on the homepage strip without code."
        side={
          <div className="om-mockup-card" style={{ background: 'var(--om-brand)', color: 'white', border: 'none' }}>
            <p className="om-mockup-label" style={{ color: 'var(--icp-teal-300)' }}>Friday — three khutbas</p>
            <div className="om-jummah-slots">
              {(['12:45', '1:30', '2:15'] as const).map((t, i) => (
                <div key={t} className="om-jummah-slot">
                  <span className="om-jummah-slot-tag">Khutba {i + 1}</span>
                  <span className="om-jummah-slot-time">{t}<small>pm</small></span>
                  <span className="om-jummah-slot-meta">Br. {['Yusuf', 'Imran', 'Bilal'][i]}</span>
                </div>
              ))}
            </div>
          </div>
        }
      />

      <FeatureSection
        kicker="Hijri dates, done right"
        title="Pulled automatically. Rendered properly."
        body="Hijri dates are pulled automatically and rendered in Amiri — a classical Naskh designed for Quran. Override per day for moonsighting differences."
        side={
          <div className="om-mockup-card" style={{ textAlign: 'center' }}>
            <p className="om-arabic-date" lang="ar" dir="rtl">١٩ شوال ١٤٤٧</p>
            <p className="om-mockup-divider">·</p>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', margin: 0, color: 'var(--fg1)' }}>
              19 Shawwal 1447
            </p>
            <p className="om-mockup-foot" style={{ marginTop: 16 }}>Friday · April 28, 2026</p>
          </div>
        }
      />

      <FeatureSection
        alt
        kicker="Sticky prayer strip"
        title="Today's times, visible everywhere."
        body="Today's prayer times stay visible at the top of every page on every device. Your jamaa stops opening five tabs."
        side={
          <BrowserFrame url="alnoor.openmasjid.app">
            <div className="om-tenant" style={{ ['--t-brand']: '#0F1E4A', ['--t-accent']: '#1E7E8E' } as CSSProperties}>
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
              <div style={{ padding: 60, textAlign: 'center', color: 'var(--fg3)', fontSize: 14 }}>
                · any page on the site ·
              </div>
            </div>
          </BrowserFrame>
        }
      />

      <FeatureCTA />
    </MarketingShell>
  )
}
