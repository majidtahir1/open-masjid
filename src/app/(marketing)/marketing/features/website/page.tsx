import Link from 'next/link'
import { MarketingShell } from '../../../_components/MarketingShell'
import { BrowserFrame, TenantPreview } from '../../../_components/TenantPreview'
import { FeatureCTA, FeatureHero, FeatureSection } from '../../../_components/FeatureSection'
import { AnsariChat, ChatDone, ChatIn, ChatOut } from '../../../_components/AnsariChat'
import { ArrowRight, Check } from '../../../_components/Icons'

const TITLE = 'Masjid websites — OpenMasjid'
const DESCRIPTION =
  "A fast, beautiful website built for your masjid — prayer times, events, and donations front and center. Your branding, your domain. Managed by Ansari, no code, no WordPress."

export const metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/features/website' },
  openGraph: { title: TITLE, description: DESCRIPTION, url: '/features/website', type: 'website' },
  twitter: { title: TITLE, description: DESCRIPTION },
}

export default function WebsiteFeaturePage() {
  return (
    <MarketingShell current="/features/website">
      <FeatureHero
        eyebrow="Your Website"
        title="The front door for your whole community."
        em="Beautiful, fast, unmistakably yours."
        sub="Every OpenMasjid comes with a real public website — prayer times, events, donations, and announcements your community actually visits. No theme to wrestle, no plugins to patch, no designer to hire."
      />

      {/* See it live — demo callout */}
      <section className="om-section" style={{ background: 'var(--om-bg-cream)' }}>
        <div className="om-container">
          <div className="om-section-header center">
            <p className="om-eyebrow">See it live</p>
            <h2 className="om-h2">This is a real OpenMasjid site.</h2>
            <p className="om-lede" style={{ maxWidth: 560, margin: '16px auto 0' }}>
              Click around the demo — prayer times, events, donations, the works. No signup, no card.
            </p>
          </div>

          <div style={{ maxWidth: 880, margin: '0 auto' }}>
            <BrowserFrame url="demo.openmasjid.app">
              <TenantPreview variant="default" />
            </BrowserFrame>
          </div>

          <div style={{ textAlign: 'center', marginTop: 32 }}>
            <a
              className="om-btn om-btn-primary om-btn-lg"
              href="https://demo.openmasjid.app"
              target="_blank"
              rel="noopener"
            >
              Explore the live demo <ArrowRight />
            </a>
          </div>
        </div>
      </section>

      <FeatureSection
        kicker="Built for masajid"
        title="A masjid site, not a generic template."
        body="Prayer times with iqamah, multiple jummah slots, Hijri dates, and Arabic typography are first-class — rendered beautifully on every screen, not bolted on with a plugin. Adding an event takes two minutes, not twenty."
        side={
          <BrowserFrame url="masjid.openmasjid.app">
            <TenantPreview variant="compact" />
          </BrowserFrame>
        }
      />

      <FeatureSection
        alt
        kicker="Fast & accessible"
        title="Loads instantly. Works on every phone."
        body="Statically rendered and edge-cached, so it's quick even on a weak masjid Wi-Fi connection. Mobile-first, screen-reader friendly, and high-contrast by default — the people in your community on older phones get the same clean experience as everyone else."
        side={
          <div className="om-mockup-card">
            <p className="om-mockup-label">Performance</p>
            <div className="om-list" style={{ margin: '8px 0 0' }}>
              <p className="om-mockup-foot" style={{ color: 'var(--icp-success)' }}>
                <Check width={14} height={14} /> 100 / 100 accessibility
              </p>
              <p className="om-mockup-foot" style={{ color: 'var(--icp-success)' }}>
                <Check width={14} height={14} /> Sub-second first paint
              </p>
              <p className="om-mockup-foot" style={{ color: 'var(--icp-success)' }}>
                <Check width={14} height={14} /> Mobile-first, no layout shift
              </p>
            </div>
          </div>
        }
      />

      <FeatureSection
        kicker="Your identity"
        title="Your branding. Your domain."
        body={
          <p className="om-body" style={{ fontSize: 16 }}>
            Three colors, your logo, your font — the whole site reskins itself, no designer required. Bring your own
            domain and we provision SSL automatically, or start free on a{' '}
            <code>.openmasjid.app</code> subdomain.{' '}
            <Link className="om-link-arrow" href="/features/branding">See branding &amp; themes <ArrowRight /></Link>
          </p>
        }
        side={
          <div className="om-mockup-card">
            <p className="om-mockup-label">Custom domain</p>
            <input type="text" defaultValue="masjidalnoor.org" className="om-mockup-input" readOnly />
            <p className="om-mockup-foot" style={{ marginTop: 12, color: 'var(--icp-success)' }}>
              <Check width={14} height={14} /> SSL active · auto-renewing · www → apex
            </p>
          </div>
        }
      />

      <FeatureSection
        alt
        kicker="Run by Ansari"
        title="Update it by sending a message."
        body="You never touch HTML. Tell Ansari “post tonight's halaqa” or “add Friday's fundraiser” and the public site updates in seconds — and so do the lobby displays. The website is what your community sees; Ansari is how your volunteers run it."
        side={
          <div className="oa-cap-chat">
            <AnsariChat input={false}>
              <ChatOut>Post tonight's halaqa: 8pm, brothers' side, Sh. Yusuf.</ChatOut>
              <ChatIn>Adding it to the homepage and the events page. Live on the lobby displays too?</ChatIn>
              <ChatOut>yes</ChatOut>
              <ChatDone>Live on your site and 3 displays.</ChatDone>
            </AnsariChat>
          </div>
        }
      />

      <FeatureCTA />
    </MarketingShell>
  )
}
