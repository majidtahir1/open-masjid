import { MarketingShell } from '../../../_components/MarketingShell'
import { FeatureCTA, FeatureHero, FeatureSection } from '../../../_components/FeatureSection'

const TITLE = 'Kiosk Displays — OpenMasjid'
const DESCRIPTION =
  'Lobby and prayer-hall display monitors that show prayer times, announcements, sponsor slides, and a weekly schedule. Pair any TV in 30 seconds. No proprietary hardware.'

export const metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/features/kiosk' },
  openGraph: { title: TITLE, description: DESCRIPTION, url: '/features/kiosk', type: 'website' },
  twitter: { title: TITLE, description: DESCRIPTION },
}

export default function KioskFeaturePage() {
  return (
    <MarketingShell current="/features/kiosk">
      <FeatureHero
        eyebrow="Kiosk Displays"
        title="Every TV in the masjid,"
        em="running OpenMasjid seamlessly."
        sub="Prayer times, announcements, sponsor slides, and the weekly schedule — on every lobby and prayer-hall screen. Pair a TV in 30 seconds with a 6-character code. Edit a slide, save, and every kiosk updates in under 5 seconds. No proprietary hardware. No standalone CMS to learn."
      />

      <FeatureSection
        kicker="Pairing"
        title="Type a code. That's it."
        body="Open your dedicated kiosk URL on any TV — Fire Stick, Raspberry Pi, Chromebox, an old laptop, anything with a browser. The screen shows a 6-character code. Type it into your admin, save, done. The TV is now bound to your masjid. No QR scanners, no factory reset rituals, no per-device licenses. Reset pairing from admin if you ever move the display."
        side={
          <div className="om-mockup-card" style={{ background: '#000', color: '#fff', padding: 40, textAlign: 'center' }}>
            <p style={{ opacity: 0.5, fontSize: 13, letterSpacing: '0.16em', textTransform: 'uppercase', margin: 0 }}>
              Enter this code in your admin
            </p>
            <p
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 64,
                letterSpacing: '0.1em',
                margin: '14px 0 0',
              }}
            >
              K7M-3PQ
            </p>
          </div>
        }
      />

      <FeatureSection
        alt
        kicker="Save = broadcast"
        title="Edit a slide. It's on the screen."
        body="No publish button, no separate kiosk app, no asking volunteers to refresh anything. Every kiosk content type (carousel, sponsor, weekly events, QR codes, prayer schedule) bumps a broadcast timestamp on save. Connected displays pick up the change on their next 5-second poll. The longest you'll wait is the time it takes to walk back to the prayer hall."
        side={
          <div className="om-mockup-card">
            <p className="om-mockup-label">Just now</p>
            <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0 0', fontSize: 13 }}>
              <li style={{ padding: '8px 0', borderBottom: '1px solid var(--om-border)' }}>
                <strong>Lobby Display</strong>
                <span style={{ color: 'var(--fg3)', float: 'right' }}>updated 2s ago</span>
              </li>
              <li style={{ padding: '8px 0', borderBottom: '1px solid var(--om-border)' }}>
                <strong>Hall North</strong>
                <span style={{ color: 'var(--fg3)', float: 'right' }}>updated 2s ago</span>
              </li>
              <li style={{ padding: '8px 0' }}>
                <strong>Sisters' Section</strong>
                <span style={{ color: 'var(--fg3)', float: 'right' }}>updated 3s ago</span>
              </li>
            </ul>
          </div>
        }
      />

      <FeatureSection
        kicker="Slide types"
        title="The five things every masjid puts on a TV."
        body="A prayer-times slide that auto-leads every rotation. Carousel slides for announcements with optional Islamic-pattern backgrounds (13 themes built in). Sponsor slides with four layout templates and brand-color theming. A weekly events grid (Quran class Mondays, sisters' halaqa Tuesdays). A reusable QR-code library — generate once, attach to any slide, scan from a phone."
        side={
          <div className="om-mockup-card">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
              <div>Prayer times</div>
              <div>Carousel slides</div>
              <div>Sponsor slides</div>
              <div>Weekly events</div>
              <div>QR code library</div>
              <div>13 themes</div>
            </div>
          </div>
        }
      />

      <FeatureSection
        alt
        kicker="Per-kiosk targeting"
        title="Different screens, different content."
        body="By default every kiosk in your tenant shows the same playlist. Need the women's section to skip the men's-only class announcement, or the lobby to show a donation QR but the prayer hall not? Flip 'override playlist' on a specific kiosk, pick the slides it should show, save. The override is per-device, not global — most masajid never touch it, but it's there when you need it."
        side={
          <div className="om-mockup-card">
            <p className="om-mockup-label">Lobby Display</p>
            <div
              style={{
                marginTop: 10,
                padding: 10,
                background: 'rgba(20, 110, 105, 0.08)',
                border: '1px solid var(--om-brand)',
                borderRadius: 8,
                fontSize: 13,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Override Slide Playlist</span>
                <span style={{ fontWeight: 600, color: 'var(--om-brand)' }}>ON</span>
              </div>
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0 0', fontSize: 12, color: 'var(--fg2)' }}>
              <li style={{ padding: '4px 0' }}>✓ Welcome to the Masjid</li>
              <li style={{ padding: '4px 0' }}>✓ Local Halal Market</li>
              <li style={{ padding: '4px 0', opacity: 0.4 }}>✗ Brothers' Halaqa Tonight</li>
            </ul>
          </div>
        }
      />

      <FeatureSection
        kicker="No new hardware to buy"
        title="If it has a browser, it works."
        body="A $30 Fire Stick. A Raspberry Pi you already own. An old laptop with the screen taped to a frame. A smart TV's built-in browser. Plug in, point to one URL, type a code. The display runs full-bleed 1920×1080 by default, scales gracefully to 1440p and 4K. No app to side-load. No firmware compatibility list. No vendor lock-in — if you ever leave OpenMasjid, the kiosks just stop pointing here, no bricked devices."
        side={
          <div className="om-mockup-card">
            <p className="om-mockup-label">Tested on</p>
            <ul style={{ listStyle: 'none', padding: 0, margin: '10px 0 0', fontSize: 13 }}>
              <li style={{ padding: '4px 0' }}>Smart TV browsers</li>
              <li style={{ padding: '4px 0' }}>Amazon Fire Stick (Silk)</li>
              <li style={{ padding: '4px 0' }}>Raspberry Pi (Chromium)</li>
              <li style={{ padding: '4px 0' }}>Any spare laptop</li>
              <li style={{ padding: '4px 0' }}>iPad on a wall mount</li>
            </ul>
          </div>
        }
      />

      <FeatureSection
        alt
        kicker="Offline & status"
        title="Stays up when the wifi blinks."
        body="If the network drops, the kiosk keeps showing the last-known slides — never a blank screen, never a connection-error dialog. A small dot in the corner flags the offline state for staff. When connectivity returns, it picks up where it left off. Every kiosk reports back every few seconds; admin sees ONLINE / OFFLINE per device, so you know which screen needs a power-cycle without walking the building."
        side={
          <div className="om-mockup-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--om-border)', fontSize: 13, fontWeight: 600 }}>
              Kiosks · 4
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: 12 }}>
              {[
                { name: 'Lobby Display', loc: 'Lobby', status: 'ONLINE' },
                { name: 'Hall North', loc: 'Main Hall', status: 'ONLINE' },
                { name: 'Sisters Section', loc: 'East Wing', status: 'ONLINE' },
                { name: 'Foyer (old)', loc: 'Entrance', status: 'OFFLINE' },
              ].map((row) => (
                <li
                  key={row.name}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '10px 16px',
                    borderBottom: '1px solid var(--om-border)',
                  }}
                >
                  <span>
                    <strong>{row.name}</strong>
                    <span style={{ color: 'var(--fg3)', marginLeft: 8 }}>{row.loc}</span>
                  </span>
                  <span
                    style={{
                      color: row.status === 'ONLINE' ? 'var(--om-brand)' : 'var(--fg3)',
                      fontWeight: 600,
                    }}
                  >
                    ● {row.status}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        }
      />

      <FeatureSection
        kicker="Roles"
        title="Give the kiosk volunteer a kiosk login."
        body="A new 'Kiosk Manager' role can manage everything kiosk — slides, sponsors, the weekly schedule, QR codes, kiosks — and nothing else. They can't change site branding, edit pages, or see donations. Hand the login to whoever runs the lobby TV without giving them the keys to the whole site."
        side={
          <div className="om-mockup-card">
            <p className="om-mockup-label">Role</p>
            <p style={{ marginTop: 8, fontSize: 16, fontWeight: 600 }}>Kiosk Manager</p>
            <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0 0', fontSize: 13 }}>
              <li style={{ padding: '4px 0', color: 'var(--om-brand)' }}>✓ Manage kiosk slides &amp; devices</li>
              <li style={{ padding: '4px 0', color: 'var(--om-brand)' }}>✓ View prayer schedule</li>
              <li style={{ padding: '4px 0', color: 'var(--fg3)' }}>✗ Edit site pages</li>
              <li style={{ padding: '4px 0', color: 'var(--fg3)' }}>✗ See donations</li>
              <li style={{ padding: '4px 0', color: 'var(--fg3)' }}>✗ Manage users</li>
            </ul>
          </div>
        }
      />

      <FeatureCTA />
    </MarketingShell>
  )
}
