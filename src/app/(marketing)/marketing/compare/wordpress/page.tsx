import Link from 'next/link'
import { MarketingShell } from '../../../_components/MarketingShell'
import { CompareTable } from '../../../_components/CompareTable'
import { FeatureCTA } from '../../../_components/FeatureSection'
import { ArrowRight } from '../../../_components/Icons'

export const metadata = {
  title: 'OpenMasjid vs WordPress — Compare',
  description: "WordPress is the most common masjid website platform. It's also the most commonly hacked. Here's what changes when you move.",
}

export default function CompareWordPressPage() {
  return (
    <MarketingShell current="/compare/wordpress">
      <section className="om-section-sm" style={{ paddingTop: 80, paddingBottom: 16 }}>
        <div className="om-narrow">
          <p className="om-eyebrow">
            <Link href="/compare" style={{ color: 'inherit' }}>Compare</Link> · WordPress
          </p>
          <h1 className="om-h1" style={{ fontSize: 'clamp(2.25rem, 4vw, 3.5rem)', marginTop: 12, marginBottom: 20 }}>
            OpenMasjid <em style={{ fontStyle: 'italic', color: 'var(--om-accent-deep)' }}>vs WordPress</em>
          </h1>
          <p className="om-lede" style={{ maxWidth: 640 }}>
            WordPress is the most common masjid website platform. It's also the most commonly hacked.
            Here's what changes when you move.
          </p>
        </div>
      </section>
      <section className="om-section">
        <div className="om-container">
          <CompareTable
            leftLabel="WordPress + plugins"
            rows={[
              { label: 'Prayer times', left: 'Plugin (varies)', right: 'First-class, included' },
              { label: 'Events & flyers', left: 'Events Calendar plugin', right: 'Built-in, three display modes' },
              { label: 'Donations', left: 'GiveWP / WooCommerce', right: 'Native Stripe, included' },
              { label: 'Forms / RSVPs', left: 'Gravity Forms / Jotform ($30+/mo)', right: 'Built-in builder, included' },
              { label: 'Security', left: 'Plugin attack surface', right: 'No plugins' },
              { label: 'Maintenance', left: 'You + plugin updates', right: 'Zero-touch on hosted' },
              { label: 'Total monthly cost', left: '$40–$80 + freelancer', right: '$49 flat' },
              { label: 'Lock-in', left: 'None (just risky)', right: 'None (MIT)' },
            ]}
          />
        </div>
      </section>
      <section className="om-section" style={{ background: 'var(--om-bg-cream)' }}>
        <div className="om-narrow">
          <h2 className="om-h2" style={{ marginBottom: 20 }}>The migration math.</h2>
          <p className="om-lede" style={{ marginBottom: 32 }}>
            If you're paying $40 hosting + $30 events plugin + $30 donations + occasional freelancer,
            switching to Hosted at $49/mo pays for itself in month one.
          </p>
          <Link href="/contact" className="om-btn om-btn-primary om-btn-lg">
            See the migration plan <ArrowRight />
          </Link>
        </div>
      </section>
      <FeatureCTA />
    </MarketingShell>
  )
}
