import Link from 'next/link'
import { MarketingShell } from '../_components/MarketingShell'
import OpenMasjidJsonLd from '../_components/OpenMasjidJsonLd'
import {
  AnsariChat,
  ChatCard,
  ChatDone,
  ChatIn,
  ChatOut,
  ChatTime,
  ChatTyping,
  Confirm,
  DiffRow,
} from '../_components/AnsariChat'
import {
  ArrowRight,
  Bell,
  Calendar,
  Check,
  ClipboardList,
  Code,
  Github,
  Globe,
  Heart,
  Monitor,
  MoonStar,
  Palette,
  Shield,
  Sparkles,
  Sunrise,
} from '../_components/Icons'

const HOME_TITLE = 'OpenMasjid — A modern website platform built for masajid'
const HOME_DESCRIPTION =
  "Run your masjid through conversation. Ansari, the AI assistant, handles prayer times, events, donations, and announcements — without the WordPress headaches. Free to self-host. $49/mo hosted."

export const metadata = {
  title: HOME_TITLE,
  description: HOME_DESCRIPTION,
  alternates: { canonical: '/' },
  openGraph: {
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    url: '/',
    type: 'website',
  },
  twitter: {
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
  },
}

const FEATURES = [
  { Icon: Globe, title: 'Your website', body: "A fast, beautiful public site your community actually visits — prayer times, events, and donations front and center. Your branding, your custom domain.", to: '/features/website' },
  { Icon: Sunrise, title: 'Prayer times', body: 'Set up the whole year in minutes. Multiple jummah slots, iqamah overrides, Hijri dates.', to: '/features/prayer-times' },
  { Icon: Calendar, title: 'Events & flyers', body: "Upload a flyer or auto-generate one in your masjid's branding. Recurring patterns ('Mondays after Isha') supported.", to: '/features/events' },
  { Icon: Heart, title: 'Donations', body: 'Native Stripe integration with Sadaqah / Zakat / Building Fund tabs. Or link out to your existing processor.', to: '/features/donations' },
  { Icon: ClipboardList, title: 'Forms & RSVPs', body: 'Build RSVPs, registrations, volunteer signups, and surveys in your admin. Capacity, payments, custom branding — no Jotform subscription.', to: '/features/forms' },
  { Icon: Monitor, title: 'Kiosk displays', body: 'Every TV in the masjid running off your admin. Pair a Fire Stick in 30 seconds. Edit a slide, save, every screen updates in under 5 seconds.', to: '/features/kiosk' },
  { Icon: Palette, title: 'Branding', body: 'Logo, three colors, a font. We derive the full palette automatically. 5-minute setup.', to: '/features/branding' },
  { Icon: Shield, title: 'Security', body: "No plugin marketplace, no theme ecosystem, no third-party scripts you didn't approve.", to: '/features/security' },
  { Icon: Code, title: 'Open-source', body: 'Self-host or migrate to your own server any time. Your data, full stop.', to: '/self-host' },
]

const STEPS = [
  { n: '01', title: 'Claim your subdomain', body: 'yourmasjid.openmasjid.app — live in 5 minutes.' },
  { n: '02', title: 'Skin it', body: 'Upload your logo, pick three colors, choose a font. Live preview, no designer needed.' },
  { n: '03', title: 'Add your content', body: 'Prayer times, events, donations — all in one place. Add what you need, skip what you don’t.' },
  { n: '04', title: 'Connect your domain', body: 'Point yourmasjid.org at us when you ready. We handle TLS automatically.' },
]

const WATCHES = [
  'Your prayer schedule is about to run out',
  'An iqamah time is drifting too close to the adhan',
  'An RSVP is filling up, or a notice is about to expire',
  'Daylight saving or Ramadan is coming up',
  'A display in the lobby stops checking in',
]

export default function MarketingHome() {
  return (
    <MarketingShell current="/">
      <OpenMasjidJsonLd />
      {/* Hero */}
      <section className="om-hero">
        <div className="om-container om-hero-grid">
          <div className="om-hero-text">
            <span className="om-pill">
              <Sparkles width={14} height={14} />
              Meet Ansari · your AI assistant
            </span>
            <h1 className="om-h1">
              Run your masjid through
              <br /><em className="om-hero-em">conversation.</em>
            </h1>
            <p className="om-lede">
              OpenMasjid is the world&apos;s first AI-native platform for running a masjid. It comes with Ansari,
              your masjid&apos;s personal assistant. Ansari can update your prayer times, set up events, and tell you
              how your programs and fundraising are really doing. Just ask.
            </p>
            <div className="om-hero-ctas">
              <Link className="om-btn om-btn-primary om-btn-lg" href="/get-started">
                Get Started
                <ArrowRight />
              </Link>
              <Link className="om-btn om-btn-secondary om-btn-lg" href="/features/ansari">
                See Ansari in action
                <ArrowRight />
              </Link>
            </div>
            <p className="om-hero-trust">
              <Check width={14} height={14} /> 14-day trial, no card
            </p>
          </div>

          <div className="om-hero-preview">
            <AnsariChat>
              <ChatTime>This Friday · 10:42 AM</ChatTime>
              <ChatOut>Add a 2:15 jummah slot this Friday</ChatOut>
              <ChatTyping />
              <ChatIn>Here&apos;s the change before I apply it:</ChatIn>
              <ChatCard label="Prayer times · review">
                <div className="oa-diff">
                  <DiffRow k="2nd Jummah" newVal="2:15 PM khutbah" />
                  <DiffRow k="Effective" newVal="This Friday →" />
                </div>
                <Confirm yes="Yes, apply" no="Edit" />
              </ChatCard>
              <ChatOut>yes</ChatOut>
              <ChatDone>Live on your site and the lobby displays.</ChatDone>
            </AnsariChat>
            <div className="om-hero-floater om-hero-floater--ribbon">
              <span className="om-ribbon-dot" />
              Replies in seconds
            </div>
          </div>
        </div>
        <div className="om-hero-glow" aria-hidden="true" />
      </section>

      {/* Digital administrator — proactive monitoring + daily briefing */}
      <section className="oa-proactive">
        <div className="oa-proactive-glow" aria-hidden="true" />
        <div className="om-container oa-proactive-grid">
          <div className="oa-proactive-text">
            <p className="oa-kicker on-dark">
              <Bell width={14} height={14} /> Your digital masjid administrator
            </p>
            <h2 className="om-h2">Wake up knowing what&apos;s happening at your masjid.</h2>
            <p className="om-lede">
              Volunteers are busy and things slip. OpenMasjid watches your masjid around the clock, keeping an eye on
              your prayer schedule, forms, events, displays, and the calendar. The moment something needs attention, it
              reaches out with a one-tap fix ready to go.
            </p>
            <ul className="oa-watch-list">
              {WATCHES.map((w) => (
                <li key={w}><Check width={17} height={17} /> {w}</li>
              ))}
            </ul>
          </div>

          <div>
            <AnsariChat input={false}>
              <ChatTime>Sunday · 7:30 AM</ChatTime>
              <ChatIn>
                <b>Good morning.</b> Here&apos;s where the masjid stands this week:
              </ChatIn>
              <ChatCard label="Weekly briefing" Icon={Calendar}>
                <div className="oa-diff">
                  <DiffRow k="Family Night" newVal="43 / 75 RSVPs · pace below average" />
                  <DiffRow k="Prayer times" newVal="expire in 8 days" />
                  <DiffRow k="Memberships" newVal="2 renew this week" />
                  <DiffRow k="Donations" newVal="up 11% vs last month" />
                  <DiffRow k="Displays" newVal="all 3 online" />
                </div>
              </ChatCard>
            </AnsariChat>
          </div>
        </div>
      </section>

      {/* Problem */}
      <section className="om-section" style={{ background: 'var(--om-bg-cream)' }}>
        <div className="om-narrow">
          <div className="om-section-header center">
            <p className="om-eyebrow">The status quo</p>
            <h2 className="om-h2">Your masjid shouldn't need an IT department.</h2>
          </div>

          <div className="om-problem-prose">
            <p>
              Most masajid are stuck between three bad options. <b>WordPress</b> that gets hacked through some
              plugin nobody asked to install. <b>Squarespace</b> that has no idea what jummah is. Or a{' '}
              <b>"mosque CMS" from 2012</b> that locks your data inside a system you can't leave.
            </p>
            <p>
              So the website limps along. Prayer times go stale. The events plugin breaks during Ramadan. And every
              fix runs through one volunteer who's burned out.
            </p>
            <p className="om-problem-pull">
              You shouldn't have to choose between a site that's secure, a site that's affordable, and a site that
              looks like a real masjid built it.
            </p>
          </div>

          <div className="om-problem-grid">
            <div className="om-problem-card">
              <p className="om-problem-card-tag">WordPress</p>
              <p className="om-problem-card-pain">Plugin malware. Constant updates. Burned-out volunteer.</p>
              <p className="om-problem-card-cost">$80–$300/mo stitched stack</p>
            </div>
            <div className="om-problem-card">
              <p className="om-problem-card-tag">Squarespace</p>
              <p className="om-problem-card-pain">Beautiful, but no jummah, no Hijri, no donations.</p>
              <p className="om-problem-card-cost">$23–$65/mo + add-ons</p>
            </div>
            <div className="om-problem-card">
              <p className="om-problem-card-tag">Legacy mosque CMS</p>
              <p className="om-problem-card-pain">Built in 2012. Your data inside their system.</p>
              <p className="om-problem-card-cost">Lock-in by default</p>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="om-section">
        <div className="om-container">
          <div className="om-section-header center">
            <p className="om-eyebrow">Why OpenMasjid</p>
            <h2 className="om-h2">Three things every masjid deserves.</h2>
          </div>

          <div className="om-benefit-grid">
            <article className="om-card om-card-hover om-benefit-card">
              <span className="om-benefit-icon"><MoonStar /></span>
              <h3 className="om-h3" style={{ fontSize: '1.4rem' }}>Built for masajid, not retrofitted for them</h3>
              <p className="om-body">
                Prayer times, jummah slots, Hijri dates, Arabic typography — first-class, not bolted on with a plugin.
                Adding an event takes two minutes, not twenty.
              </p>
              <Link className="om-link-arrow" href="/features/prayer-times">See prayer features <ArrowRight /></Link>
            </article>

            <article className="om-card om-card-hover om-benefit-card">
              <span className="om-benefit-icon"><Shield /></span>
              <h3 className="om-h3" style={{ fontSize: '1.4rem' }}>A smaller attack surface</h3>
              <p className="om-body">
                No plugin marketplace, no theme ecosystem, no third-party scripts you didn't approve.
                Fewer moving parts means fewer ways for things to go wrong.
              </p>
              <Link className="om-link-arrow" href="/features/security">How we secure it <ArrowRight /></Link>
            </article>

            <article className="om-card om-card-hover om-benefit-card">
              <span className="om-benefit-icon"><Code /></span>
              <h3 className="om-h3" style={{ fontSize: '1.4rem' }}>Yours, forever</h3>
              <p className="om-body">
                Open-source. Self-host the same code we host, on your own server, for free.
                Export your data — including donations — any time.
              </p>
              <Link className="om-link-arrow" href="/self-host">Learn about self-hosting <ArrowRight /></Link>
            </article>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="om-section" style={{ background: 'var(--om-bg-soft)' }}>
        <div className="om-container">
          <div className="om-section-header">
            <p className="om-eyebrow">How it works</p>
            <h2 className="om-h2">Five minutes from now, your masjid has a website.</h2>
          </div>

          <ol className="om-how-steps">
            {STEPS.map((s) => (
              <li key={s.n} className="om-how-step">
                <span className="om-how-num">{s.n}</span>
                <h4 className="om-h4">{s.title}</h4>
                <p className="om-body">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Feature grid */}
      <section className="om-section">
        <div className="om-container">
          <div className="om-section-header center">
            <p className="om-eyebrow">Everything in one place</p>
            <h2 className="om-h2">Everything a masjid needs. Nothing it doesn't.</h2>
          </div>

          <div className="om-feature-grid">
            {FEATURES.map(({ Icon, title, body, to }) => (
              <Link key={title} href={to} className="om-feature-tile">
                <span className="om-feature-tile-icon"><Icon width={22} height={22} /></span>
                <h4 className="om-h4">{title}</h4>
                <p className="om-body">{body}</p>
                <span className="om-feature-tile-arrow"><ArrowRight /></span>
              </Link>
            ))}
          </div>

          <div style={{ textAlign: 'center', marginTop: 48 }}>
            <Link href="/features" className="om-btn om-btn-secondary">
              Browse all features <ArrowRight />
            </Link>
          </div>
        </div>
      </section>

      {/* Proof strip */}
      <section
        className="om-section-sm"
        style={{ background: 'var(--om-bg-night)', color: 'white', textAlign: 'center' }}
      >
        <div className="om-narrow on-dark">
          <p className="om-h3" style={{ color: 'white', fontStyle: 'italic', fontWeight: 400 }}>
            "AI-native software for the masjid. Modern, fast, and open-source."
          </p>
        </div>
      </section>

      {/* Final CTA */}
      <section className="om-section-lg" style={{ background: 'var(--om-bg-cream)' }}>
        <div className="om-narrow" style={{ textAlign: 'center' }}>
          <div className="om-star-divider"><span>✦</span></div>
          <h2 className="om-h2" style={{ marginBottom: 20 }}>Ready when you are.</h2>
          <p className="om-lede" style={{ marginBottom: 36, maxWidth: 560, marginLeft: 'auto', marginRight: 'auto' }}>
            Start free with a <code>.openmasjid.app</code> subdomain. Add your custom domain when you're ready.
            Or self-host it on your own server, forever, for free.
          </p>
          <div className="om-hero-ctas" style={{ justifyContent: 'center' }}>
            <Link className="om-btn om-btn-primary om-btn-lg" href="/get-started">Claim your subdomain <ArrowRight /></Link>
            <Link className="om-btn om-btn-secondary om-btn-lg" href="/self-host"><Github width={16} height={16} />Self-host on GitHub</Link>
          </div>
          <p className="om-meta" style={{ marginTop: 24 }}>
            Or{' '}
            <Link
              href="/contact"
              style={{ color: 'var(--om-brand)', textDecoration: 'underline', textUnderlineOffset: 3 }}
            >
              talk to us about migrating
            </Link>
            {' '}from your current platform.
          </p>
        </div>
      </section>
    </MarketingShell>
  )
}
