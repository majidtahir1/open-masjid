import Link from 'next/link'
import { MarketingShell } from '../../_components/MarketingShell'
import {
  ArrowRight,
  Calendar,
  Code,
  Heart,
  Palette,
  Shield,
  Sunrise,
} from '../../_components/Icons'

export const metadata = {
  title: 'Features — OpenMasjid',
  description: "Everything a masjid needs. Nothing it doesn't. Prayer times, events, donations, branding, security.",
}

const FEATURES = [
  { Icon: Sunrise, title: 'Prayer times', body: 'Multiple jummah slots, iqamah overrides, Hijri dates, full-year setup in minutes.', to: '/features/prayer-times' },
  { Icon: Calendar, title: 'Events & flyers', body: 'Three display modes — uploaded, auto-generated, or text-only.', to: '/features/events' },
  { Icon: Heart, title: 'Donations', body: 'Native Stripe with Sadaqah / Zakat / Building Fund tabs.', to: '/features/donations' },
  { Icon: Palette, title: 'Branding', body: 'Logo, three colors, a font. We derive the full palette.', to: '/features/branding' },
  { Icon: Shield, title: 'Security', body: 'No plugin marketplace. No third-party scripts.', to: '/features/security' },
  { Icon: Code, title: 'Open-source', body: 'Self-host or migrate any time.', to: '/self-host' },
]

export default function FeaturesPage() {
  return (
    <MarketingShell current="/features">
      <section className="om-section-sm" style={{ paddingTop: 80, paddingBottom: 16 }}>
        <div className="om-narrow" style={{ textAlign: 'center' }}>
          <p className="om-eyebrow">Features</p>
          <h1 className="om-h1" style={{ fontSize: 'clamp(2.25rem, 4vw, 3.5rem)', marginBottom: 20 }}>
            Everything a masjid needs.{' '}
            <em style={{ fontStyle: 'italic', color: 'var(--om-accent-deep)' }}>Nothing it doesn't.</em>
          </h1>
          <p className="om-lede" style={{ maxWidth: 640, margin: '0 auto' }}>
            We make a small number of decisions so your volunteers don't have to: prayer times, events, donations,
            branding, and security. The rest of WordPress's 60,000-plugin universe is gone.
          </p>
        </div>
      </section>

      <section className="om-section">
        <div className="om-container">
          <div className="om-feature-grid" style={{ borderRadius: 20 }}>
            {FEATURES.map(({ Icon, title, body, to }) => (
              <Link key={title} href={to} className="om-feature-tile" style={{ padding: 40 }}>
                <span className="om-feature-tile-icon" style={{ width: 56, height: 56 }}>
                  <Icon width={26} height={26} />
                </span>
                <h3 className="om-h3" style={{ fontSize: '1.5rem' }}>{title}</h3>
                <p className="om-body">{body}</p>
                <span className="om-feature-tile-arrow"><ArrowRight /></span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="om-section" style={{ background: 'var(--om-bg-cream)' }}>
        <div className="om-narrow" style={{ textAlign: 'center' }}>
          <h2 className="om-h2" style={{ marginBottom: 20 }}>What we don't do — on purpose.</h2>
          <p className="om-lede" style={{ maxWidth: 600, margin: '0 auto' }}>
            No plugin marketplace. No theme picker. No Lottie animations on your bismillah.
            One opinionated platform that gets out of your way.
          </p>
        </div>
      </section>
    </MarketingShell>
  )
}
