import { MarketingShell } from '../../../_components/MarketingShell'
import { FeatureCTA, FeatureHero, FeatureSection } from '../../../_components/FeatureSection'

const TITLE = 'Forms & RSVPs — OpenMasjid'
const DESCRIPTION =
  'A visual form builder for RSVPs, class registrations, volunteer signups, and surveys — built into your admin. Capacity, payments, branding, no Jotform.'

export const metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/features/forms' },
  openGraph: { title: TITLE, description: DESCRIPTION, url: '/features/forms', type: 'website' },
  twitter: { title: TITLE, description: DESCRIPTION },
}

export default function FormsFeaturePage() {
  return (
    <MarketingShell current="/features/forms">
      <FeatureHero
        eyebrow="Forms & RSVPs"
        title="RSVPs, signups, surveys —"
        em="without a separate Jotform subscription."
        sub="A visual form builder, built into your admin. Twelve field types. Multi-step or single-question. Capacity limits. Payments via Stripe. Custom branding per form. CSV export. Submissions land in the same admin you already use."
      />

      <FeatureSection
        kicker="The builder"
        title="Drag, drop, label, save."
        body="A real visual canvas — not a JSON blob, not a wall of dropdowns. Add a field, label it, mark it required, drag it where you want. The properties drawer handles the details (validation, options, placeholder). Page breaks split a long form into steps automatically."
        side={
          <video
            className="om-feature-video"
            src="/marketing/forms-creation-demo.mp4"
            poster="/marketing/forms-creation-demo.png"
            autoPlay
            loop
            muted
            playsInline
            preload="metadata"
            aria-label="Creating a form from scratch in the OpenMasjid admin"
          />
        }
      />

      <FeatureSection
        alt
        kicker="Field types"
        title="Collect all types of data."
        body="Short text, email, phone, long text, number, date, dropdown, radio, multi-select, checkbox group, single consent checkbox, page break. Required toggles, validation, helper text. No 30-page taxonomy of widgets — just the ones you use."
        side={
          <div className="om-mockup-card">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
              <div>📝 Short text</div>
              <div>✉️ Email</div>
              <div>📞 Phone</div>
              <div>📋 Long text</div>
              <div># Number</div>
              <div>📅 Date</div>
              <div>▾ Dropdown</div>
              <div>○ Radio group</div>
              <div>☑ Multi-select</div>
              <div>☐ Checkbox group</div>
              <div>✓ Consent</div>
              <div>— Page break</div>
            </div>
          </div>
        }
      />

      <FeatureSection
        kicker="One question per page"
        title="A modern, focused experience."
        body="Toggle 'one question per page' and the form transforms into a focused, modern flow — one question on screen, Press Enter ↵ to continue, progress bar at the top. Forms feel quick and easy to fill, not laborious. Or keep everything on one page if your community prefers a single scroll. Per-form setting, not platform-wide."
        side={
          <video
            className="om-feature-video"
            src="/marketing/forms-builder-demo.mp4"
            poster="/marketing/forms-builder-demo.png"
            autoPlay
            loop
            muted
            playsInline
            preload="metadata"
            aria-label="Filling a form one question at a time in Typeform-style mode"
          />
        }
      />

      <FeatureSection
        alt
        kicker="Capacity"
        title="Cap it. Walk away."
        body="Set a capacity number. The form stays open until that many people have submitted, then it closes itself with a custom message — 'Iftar is full, thank you'. No more deleting the link from the masjid group chat at midnight. Race-safe at the database, so you never overshoot."
        side={
          <div className="om-mockup-card">
            <p className="om-mockup-label">Capacity</p>
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 36, color: 'var(--fg1)' }}>78</span>
              <span style={{ color: 'var(--fg3)', fontSize: 14 }}>/ 80</span>
            </div>
            <div
              style={{ marginTop: 10, height: 6, background: 'var(--om-border)', borderRadius: 999, overflow: 'hidden' }}
            >
              <div
                style={{ width: '97.5%', height: '100%', background: 'var(--om-brand)' }}
              />
            </div>
            <p className="om-mockup-foot" style={{ marginTop: 12 }}>
              Form closes automatically at 80
            </p>
          </div>
        }
      />

      <FeatureSection
        kicker="Payments"
        title="Stripe Checkout, when you need it."
        body="Flip 'Accept payment' on a form and visitors are redirected to Stripe to pay before the submission completes. Use a fixed price per submission (class registration), or 'suggested amounts + custom' (sponsored iftar, fundraiser dinner). Funds settle directly to the masjid's connected Stripe account — we never hold the money."
        side={
          <div className="om-mockup-card">
            <p className="om-mockup-label">Payment</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginTop: 10 }}>
              {['$25', '$50', '$100', '$250'].map((amt, i) => (
                <div
                  key={amt}
                  style={{
                    padding: '10px 0',
                    textAlign: 'center',
                    border: i === 1 ? '2px solid var(--om-brand)' : '1px solid var(--om-border)',
                    borderRadius: 8,
                    fontWeight: 600,
                    background: i === 1 ? 'rgba(20, 110, 105, 0.08)' : 'white',
                  }}
                >
                  {amt}
                </div>
              ))}
            </div>
            <p className="om-mockup-foot" style={{ marginTop: 12 }}>
              You'll be taken to Stripe to complete payment.
            </p>
          </div>
        }
      />

      <FeatureSection
        alt
        kicker="Branding"
        title="Looks like your masjid. Not like ours."
        body="Each form pulls from your tenant's brand color by default. Per-form, you can set a custom background color, a gradient, an intro message, and a confirmation message — all via a real color picker (no hex memorization). The public form lives on its own minimal layout — just your masjid logo at the top — so visitors aren't bouncing between header chrome and the form."
        side={
          <div
            className="om-mockup-card"
            style={{ background: 'linear-gradient(180deg, #1B3358, #0E1B2C)', color: 'white', padding: 22 }}
          >
            <p style={{ fontSize: 11, opacity: 0.7, letterSpacing: '0.16em', textTransform: 'uppercase', margin: 0 }}>
              Iftar 2026
            </p>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 22, margin: '8px 0 14px' }}>
              You're invited.
            </p>
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.92)',
                borderRadius: 10,
                padding: 12,
                color: 'var(--fg1)',
                fontSize: 12,
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Your name *</div>
              <div style={{ height: 26, background: '#f5f5f7', borderRadius: 6 }} />
            </div>
          </div>
        }
      />

      <FeatureSection
        kicker="Submissions"
        title="They land where everything else does."
        body="Every submission shows up in your admin's Submissions list. Filter by status (new / reviewed / archived), see the answers, mark reviewed when you're done. Export the whole list to CSV with one click — every column ordered the same way you built the form. No third-party dashboard to log into. No data leaving your masjid's database."
        side={
          <div className="om-mockup-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--om-border)', fontSize: 13, fontWeight: 600 }}>
              Submissions · Iftar RSVP · 78
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: 12 }}>
              {[
                { name: 'Aisha Y.', status: 'new', when: '2 min ago' },
                { name: 'Br. Tariq', status: 'new', when: '14 min ago' },
                { name: 'Fatima H.', status: 'reviewed', when: '1 hr ago' },
                { name: 'The Ahmed family', status: 'reviewed', when: 'Yesterday' },
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
                  <span>{row.name}</span>
                  <span style={{ color: 'var(--fg3)' }}>
                    {row.status} · {row.when}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        }
      />

      <FeatureCTA />
    </MarketingShell>
  )
}
