import type { ReactNode } from 'react'
import Link from 'next/link'
import { MarketingShell } from '../../../_components/MarketingShell'
import {
  AnsariChat,
  Attach,
  ChatCard,
  ChatDone,
  ChatIn,
  ChatOut,
  ChatTime,
  ChatTyping,
  Confirm,
  DiffRow,
} from '../../../_components/AnsariChat'
import {
  ArrowRight,
  Bell,
  Calendar,
  Check,
  GitCompare,
  Globe,
  Lock,
  MessageCircle,
  Shield,
  Sparkles,
} from '../../../_components/Icons'

const TITLE = 'OpenMasjid Ansari: Run your masjid by chatting with it'
const DESCRIPTION =
  'Meet OpenMasjid Ansari, the AI assistant that manages your masjid website from any chat app. Prayer times, announcements, forms, events. Just send a message. It always shows you the change and waits for your yes.'

export const metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/features/ansari' },
  openGraph: { title: TITLE, description: DESCRIPTION, url: '/features/ansari', type: 'website' },
  twitter: { title: TITLE, description: DESCRIPTION },
}

const STARS = [
  { top: '16%', left: '9%', s: 12, o: 0.5 },
  { top: '30%', left: '40%', s: 8, o: 0.32 },
  { top: '64%', left: '13%', s: 11, o: 0.4 },
  { top: '22%', left: '66%', s: 8, o: 0.3 },
  { top: '70%', left: '50%', s: 10, o: 0.3 },
]

const PROMPTS = [
  'Add a 2:15 jummah slot this Friday',
  'How many RSVPs for the fundraiser?',
  'Post: parking lot closed Saturday AM',
  'Building-fund progress this month?',
  'Make a form for the youth trip, $40, cap 30',
  'New members since Ramadan?',
  'Turn this flyer into an event',
  'Move Maghrib iqamah to adhan + 5',
]

const WATCHES = [
  'Your prayer schedule is about to run out',
  'An iqamah time is drifting too close to the adhan',
  'An RSVP form is filling up, or a notice is about to expire',
  'Daylight saving or Ramadan is coming up',
  'A Sunday-morning digest of how the week is going',
]

const ASSURANCES = [
  {
    Icon: GitCompare,
    h: 'It always asks first',
    p: 'Every change is previewed as a clear before → after. Nothing is written until you reply “yes.”',
  },
  {
    Icon: Lock,
    h: 'Scoped to what it needs',
    p: 'Narrow per-area permissions. Members and donations stay read-only. No PII edits, no money moves.',
  },
  {
    Icon: Shield,
    h: 'Walled into your masjid',
    p: 'Server-side tenant isolation means it can only ever touch your masjid’s data, never another’s.',
  },
]

function CapRow({
  kicker,
  title,
  body,
  side,
  alt = false,
}: {
  kicker: string
  title: string
  body: string
  side: ReactNode
  alt?: boolean
}) {
  return (
    <section className={`om-feature-row ${alt ? 'is-alt' : ''}`}>
      <div className="om-container om-feature-row-grid">
        <div className="om-feature-row-text">
          <p className="oa-kicker" style={{ marginBottom: 12 }}>{kicker}</p>
          <h3 className="om-h3" style={{ marginBottom: 12 }}>{title}</h3>
          <p className="om-body" style={{ fontSize: 16 }}>{body}</p>
        </div>
        <div className="om-feature-row-side">{side}</div>
      </div>
    </section>
  )
}

export default function AnsariFeaturePage() {
  return (
    <MarketingShell current="/features/ansari">
      {/* ---------- HERO · deep-navy night treatment + calm content ---------- */}
      <section className="oa-heroB">
        <div className="oa-heroB-glow" aria-hidden="true" />
        <div className="oa-heroB-stars" aria-hidden="true">
          {STARS.map((st, i) => (
            <span
              key={i}
              style={{ position: 'absolute', top: st.top, left: st.left, fontSize: st.s, color: 'var(--icp-gold-300)', opacity: st.o }}
            >
              ✦
            </span>
          ))}
        </div>
        <div className="om-container oa-heroB-grid">
          <div className="oa-heroB-text">
            <p className="oa-kicker on-dark">
              <Sparkles width={14} height={14} /> OpenMasjid Ansari
            </p>
            <h1 className="om-h1" style={{ fontSize: 'clamp(2.5rem, 4.4vw, 3.85rem)', color: 'white' }}>
              Run your masjid by{' '}
              <em style={{ fontStyle: 'italic', color: 'var(--icp-teal-300)' }}>chatting with it.</em>
            </h1>
            <p className="om-lede" style={{ maxWidth: 504, color: 'var(--om-fg-on-night-soft)' }}>
              Meet <b style={{ color: '#fff', fontWeight: 600 }}>OpenMasjid Ansari</b>, the AI assistant who makes
              managing the masjid simple. Just send Ansari a message in plain words and it takes care of the website:
              prayer times, announcements, forms, events, and more.
            </p>
            <div className="om-hero-ctas">
              <Link className="om-btn om-btn-on-dark om-btn-lg" href="/get-started">Get started <ArrowRight /></Link>
              <Link className="om-btn om-btn-secondary-dark om-btn-lg" href="/features">See how it works</Link>
            </div>
          </div>

          <div style={{ position: 'relative' }}>
            <AnsariChat>
              <ChatTime>Today · 9:12 PM</ChatTime>
              <ChatOut>Push Fajr iqamah to 5:45 starting tomorrow.</ChatOut>
              <ChatTyping />
              <ChatIn>Got it. Here’s the change before I apply it:</ChatIn>
              <ChatCard label="Prayer times · review">
                <div className="oa-diff">
                  <DiffRow k="Fajr iqamah" oldVal="5:30 AM" newVal="5:45 AM" />
                  <DiffRow k="Effective" newVal="Tomorrow →" />
                </div>
                <Confirm yes="Yes, apply" no="Edit" />
              </ChatCard>
              <ChatOut>yes</ChatOut>
              <ChatDone>Updated. Fajr is now set to 5:45 AM</ChatDone>
            </AnsariChat>
          </div>
        </div>
      </section>

      {/* ---------- "THINGS PEOPLE ASK IT" ---------- */}
      <section className="om-section" style={{ background: 'var(--om-bg-cream)' }}>
        <div className="om-container">
          <p className="oa-heroC-flow" style={{ margin: '0 0 44px' }}>
            <MessageCircle width={14} height={14} /> chat
            <ArrowRight width={14} height={14} style={{ color: 'var(--om-gold)' }} />
            <GitCompare width={14} height={14} /> confirm
            <ArrowRight width={14} height={14} style={{ color: 'var(--om-gold)' }} />
            <Globe width={14} height={14} /> live site
          </p>
          <div className="om-section-header center" style={{ marginBottom: 48 }}>
            <h2 className="om-h2">If you can say it, Ansari can do it.</h2>
            <p className="om-lede" style={{ maxWidth: 600, margin: '16px auto 0' }}>
              No commands to memorize. Ask in your own words.
            </p>
          </div>
          <div className="oa-prompts" style={{ justifyContent: 'center', maxWidth: 860, margin: '0 auto' }}>
            {PROMPTS.map((p) => (
              <span key={p} className="oa-prompt">
                <span className="oa-prompt-q">“</span>{p}<span className="oa-prompt-q">”</span>
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- PROACTIVE · it reaches out first ---------- */}
      <section className="oa-proactive">
        <div className="oa-proactive-glow" aria-hidden="true" />
        <div className="om-container oa-proactive-grid">
          <div className="oa-proactive-text">
            <p className="oa-kicker on-dark">
              <Bell width={14} height={14} /> Proactive
            </p>
            <h2 className="om-h2">Relax. Ansari is monitoring your masjid 24/7.</h2>
            <p className="om-lede">
              Ansari doesn’t only answer. It stays on top of your prayer schedule, forms, events, and the calendar, and
              messages you the moment something needs attention, with a one-tap fix ready to go.
            </p>
            <ul className="oa-watch-list">
              {WATCHES.map((w) => (
                <li key={w}><Check width={17} height={17} /> {w}</li>
              ))}
            </ul>
          </div>

          <div>
            <AnsariChat input={false}>
              <ChatIn>Heads-up: your prayer schedule only covers through July 31.</ChatIn>
              <ChatCard label="Prayer times · suggested" Icon={Calendar}>
                <div className="oa-diff">
                  <DiffRow k="Coverage" newVal="Extend through August →" />
                </div>
                <Confirm yes="Yes, extend" no="Not now" />
              </ChatCard>
            </AnsariChat>
          </div>
        </div>
      </section>

      {/* ---------- CAPABILITY DEEP-DIVES ---------- */}
      <CapRow
        kicker="Announcements"
        title="Post a notice. It reaches every screen."
        body="Dictate a notice in a sentence. Ansari posts it to your site and pushes it to the prayer-hall displays through the same hook your team already uses, then expires it when you say so."
        side={
          <div className="oa-cap-chat">
            <AnsariChat input={false}>
              <ChatOut>Put up a notice: “Janazah after Dhuhr today, main hall.”</ChatOut>
              <ChatIn>Posting to the site + kiosks. Expires tonight at midnight, sound right?</ChatIn>
              <ChatOut>perfect</ChatOut>
              <ChatDone>Live on the site and 3 displays.</ChatDone>
            </AnsariChat>
          </div>
        }
      />

      <CapRow
        alt
        kicker="Reporting"
        title="Ask it anything about your numbers."
        body="New members this month? RSVPs for the fundraiser? Building-fund progress? Ansari reads the answer straight from your data. No spreadsheets, no admin login, no waiting on the one volunteer who knows where things live."
        side={
          <div className="oa-cap-chat">
            <AnsariChat input={false}>
              <ChatOut>How many new members joined this month?</ChatOut>
              <ChatIn>
                <b>34 new members</b> in May, up from 21 in April. 9 signed up at the Eid dinner. Want the breakdown by
                sign-up source?
              </ChatIn>
              <ChatOut>How’s the building fund doing?</ChatOut>
              <ChatIn>$182,400 of the $250,000 goal: <b>73%</b>, +$11.2k this month.</ChatIn>
            </AnsariChat>
          </div>
        }
      />

      <CapRow
        kicker="Events & flyers"
        title="Forward a flyer. Get an event."
        body="Someone sends the committee’s flyer to the chat. Ansari reads the title, date, time, and place off the image, and creates the event, branded flyer and all, after you confirm the details it pulled."
        side={
          <div className="oa-cap-chat">
            <AnsariChat input={false}>
              <ChatOut>
                Can you make this an event?
                <Attach label="eid-dinner-flyer.jpg" meta="Forwarded image" />
              </ChatOut>
              <ChatIn>Read it as:</ChatIn>
              <ChatCard label="New event · review" Icon={Calendar}>
                <div className="oa-diff">
                  <DiffRow k="Title" newVal="Community Eid Dinner" />
                  <DiffRow k="When" newVal="Sat May 17 · 7:00 PM" />
                  <DiffRow k="Where" newVal="Main hall" />
                </div>
                <Confirm yes="Create event" no="Fix a detail" />
              </ChatCard>
            </AnsariChat>
          </div>
        }
      />

      {/* ---------- LIGHT REASSURANCE ---------- */}
      <section className="om-section-sm" style={{ background: 'var(--om-bg-cream)' }}>
        <div className="om-container">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}>
            <p className="oa-kicker" style={{ color: 'var(--om-accent-deep)' }}>Safe by design</p>
            <p className="om-body" style={{ margin: 0, color: 'var(--fg2)' }}>
              It works like a careful volunteer with a limited set of keys, not an admin with the master set.
            </p>
          </div>
          <div className="oa-assure">
            {ASSURANCES.map(({ Icon, h, p }) => (
              <div key={h} className="oa-assure-item">
                <span className="oa-assure-ico"><Icon width={20} height={20} /></span>
                <h4>{h}</h4>
                <p>{p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- CTA ---------- */}
      <section className="om-section" style={{ background: 'var(--om-bg-soft)' }}>
        <div className="om-narrow" style={{ textAlign: 'center' }}>
          <div className="om-star-divider"><span>✦</span></div>
          <h2 className="om-h2" style={{ margin: '8px 0 16px' }}>Bring it to your masjid.</h2>
          <p className="om-lede" style={{ maxWidth: 560, margin: '0 auto 28px' }}>
            Add the assistant to your OpenMasjid site and let your volunteers run things by simply asking.
          </p>
          <div className="om-hero-ctas" style={{ justifyContent: 'center' }}>
            <Link className="om-btn om-btn-primary om-btn-lg" href="/get-started">Get started <ArrowRight /></Link>
            <Link className="om-btn om-btn-secondary om-btn-lg" href="/features">See all features</Link>
          </div>
        </div>
      </section>
    </MarketingShell>
  )
}
