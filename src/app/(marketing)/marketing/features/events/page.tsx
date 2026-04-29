import { MarketingShell } from '../../../_components/MarketingShell'
import { FeatureCTA, FeatureHero, FeatureSection } from '../../../_components/FeatureSection'

export const metadata = {
  title: 'Events, Flyers, Pages & Announcements — OpenMasjid',
  description: 'Events with three display modes, custom pages for programs and committees, and homepage announcements — all editable by your volunteers.',
}

export default function EventsPage() {
  return (
    <MarketingShell current="/features/events">
      <FeatureHero
        eyebrow="Events & Flyers"
        title="Flyers without the designer."
        em="Events without the plugin."
        sub="Three display modes — uploaded flyer, auto-generated branded flyer, or text-only — for the days when your designer is at fajr and the event starts in two hours."
      />

      <FeatureSection
        kicker="Mode 1 — Uploaded"
        title="Upload your own flyer."
        body="PNG, JPG, PDF. We render it cleanly on every device and generate the social cards automatically."
        side={
          <div className="om-flyer-stack">
            <div
              className="om-flyer-card"
              style={{ transform: 'rotate(-3deg)', background: 'linear-gradient(135deg, #0F1E4A, #28A0B4)', color: 'white' }}
            >
              <p style={{ fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', margin: 0, opacity: 0.7 }}>
                April 17
              </p>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 24, margin: '8px 0', lineHeight: 1.1 }}>
                Ramadan iftar — sponsored by the youth committee
              </p>
              <p style={{ fontSize: 12, margin: 0, opacity: 0.85 }}>After Maghrib · Main hall</p>
            </div>
          </div>
        }
      />

      <FeatureSection
        alt
        kicker="Mode 2 — Auto-generated"
        title="Or auto-generate one in your branding."
        body="Fill in title, date, location, speaker. We render a flyer in your masjid's colors and typography. Cream, navy, or gold variants. No Canva license required."
        side={
          <div className="om-flyer-grid">
            <div className="om-flyer-card" style={{ background: '#F0EFE8' }}>
              <p style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', margin: 0, color: 'var(--icp-gold-700)' }}>cream</p>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 18, margin: '6px 0', color: 'var(--fg1)' }}>Quran Halaqa</p>
              <p style={{ fontSize: 11, margin: 0, color: 'var(--fg3)' }}>Mondays after Isha</p>
            </div>
            <div className="om-flyer-card" style={{ background: '#0F1E4A', color: 'white' }}>
              <p style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', margin: 0, color: 'var(--icp-teal-300)' }}>navy</p>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 18, margin: '6px 0' }}>Sisters' Halaqa</p>
              <p style={{ fontSize: 11, margin: 0, opacity: 0.7 }}>Sat · 10:30 am</p>
            </div>
            <div className="om-flyer-card" style={{ background: 'linear-gradient(135deg, #D9A84E, #9A7428)', color: 'white' }}>
              <p style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', margin: 0, opacity: 0.7 }}>gold</p>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 18, margin: '6px 0' }}>Eid Prayer</p>
              <p style={{ fontSize: 11, margin: 0, opacity: 0.85 }}>Eid al-Fitr · 8 am</p>
            </div>
          </div>
        }
      />

      <FeatureSection
        kicker="Recurring without RRULEs"
        title="'Mondays after Isha' is a real, supported value."
        body="So is 'First Saturday of every month.' Most masjid events are patterns, not single dates. We let you write them the way you'd say them out loud."
        side={
          <div className="om-mockup-card">
            <p className="om-mockup-label">Recurrence</p>
            <input type="text" defaultValue="Mondays after Isha" className="om-mockup-input" />
            <p className="om-mockup-foot" style={{ marginTop: 12 }}>Next 5 occurrences:</p>
            <ul className="om-mockup-list">
              <li>Mon, May 4 · 9:55 pm</li>
              <li>Mon, May 11 · 9:58 pm</li>
              <li>Mon, May 18 · 10:01 pm</li>
              <li>Mon, May 25 · 10:04 pm</li>
              <li>Mon, Jun 1 · 10:07 pm</li>
            </ul>
          </div>
        }
      />

      <FeatureSection
        alt
        kicker="Audience filters"
        title="Tag for sisters, brothers, youth, families."
        body="Visitors filter by audience; you don't have to maintain three calendars. One source of truth, many views."
        side={
          <div className="om-mockup-card">
            <div className="om-tag-row">
              {['All', 'Sisters', 'Brothers', 'Youth', 'Families', 'Kids'].map((t, i) => (
                <span key={t} className={`om-tag-pill ${i === 0 ? 'is-active' : ''}`}>{t}</span>
              ))}
            </div>
            <p className="om-mockup-foot" style={{ marginTop: 16 }}>Showing <b>14 events</b> in May 2026</p>
          </div>
        }
      />

      <FeatureSection
        kicker="Custom pages"
        title="Build the pages your masjid actually needs."
        body="About, Quran academy, weekend school, funeral services, board, donate, contact — every masjid has a different list. Spin up new pages in minutes with the same section blocks the homepage uses. No CMS to learn. No theme to fight."
        side={
          <div className="om-mockup-card">
            <p className="om-mockup-label">Pages</p>
            <ul className="om-mockup-list" style={{ marginTop: 8 }}>
              <li>About the masjid</li>
              <li>Quran Academy</li>
              <li>Weekend school</li>
              <li>Funeral services</li>
              <li>Board & leadership</li>
              <li>Visit us</li>
            </ul>
            <p className="om-mockup-foot" style={{ marginTop: 12 }}>
              Drag to reorder · auto-added to nav · slugs from titles
            </p>
          </div>
        }
      />

      <FeatureSection
        alt
        kicker="Announcements"
        title="A banner the whole community sees — without redeploying."
        body="Eid prayer time changed? Parking lot closed for repaving? Janazah after Dhuhr? Post an announcement and it shows up site-wide — homepage banner, top of every page, push to subscribers. Schedule a start and end time so it disappears on its own."
        side={
          <div className="om-mockup-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ background: 'var(--om-brand)', color: 'white', padding: '12px 16px', fontSize: 13, fontWeight: 600 }}>
              📢 Janazah for Br. Ahmad after Dhuhr today, in the main hall.
            </div>
            <div style={{ padding: 16 }}>
              <p className="om-mockup-label">Active</p>
              <p className="om-mockup-foot" style={{ marginTop: 4 }}>
                Visible: Tue 12:30 pm → Wed 12:00 pm · all pages
              </p>
              <hr style={{ border: 0, borderTop: '1px solid var(--om-border)', margin: '14px 0' }} />
              <p className="om-mockup-label">Scheduled</p>
              <p className="om-mockup-foot" style={{ marginTop: 4 }}>
                Eid Prayer 8:00 am — goes live Sun 6:00 am
              </p>
            </div>
          </div>
        }
      />

      <FeatureCTA />
    </MarketingShell>
  )
}
