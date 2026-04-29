import Link from 'next/link'
import { MarketingShell } from '../../../_components/MarketingShell'
import { CompareTable } from '../../../_components/CompareTable'
import { FeatureCTA } from '../../../_components/FeatureSection'

export const metadata = {
  title: 'OpenMasjid vs Squarespace — Compare',
  description: 'Squarespace is beautiful for restaurants and photographers. It has no idea what jummah is.',
}

export default function CompareSquarespacePage() {
  return (
    <MarketingShell current="/compare/squarespace">
      <section className="om-section-sm" style={{ paddingTop: 80, paddingBottom: 16 }}>
        <div className="om-narrow">
          <p className="om-eyebrow">
            <Link href="/compare" style={{ color: 'inherit' }}>Compare</Link> · Squarespace
          </p>
          <h1 className="om-h1" style={{ fontSize: 'clamp(2.25rem, 4vw, 3.5rem)', marginTop: 12, marginBottom: 20 }}>
            OpenMasjid <em style={{ fontStyle: 'italic', color: 'var(--om-accent-deep)' }}>vs Squarespace</em>
          </h1>
          <p className="om-lede" style={{ maxWidth: 640 }}>
            Squarespace is beautiful for restaurants and photographers. It has no idea what jummah is.
          </p>
        </div>
      </section>
      <section className="om-section">
        <div className="om-container">
          <CompareTable
            leftLabel="Squarespace"
            rows={[
              { label: 'Prayer times', left: 'Build it yourself', right: 'Built in' },
              { label: 'Jummah slots', left: 'Manual editing every week', right: 'First-class field' },
              { label: 'Hijri date', left: 'Manual', right: 'Automatic' },
              { label: 'Donations', left: 'Third-party', right: 'Native Stripe' },
              { label: 'Cost', left: '$23–$65 + add-ons', right: '$49 flat all-in' },
            ]}
          />
        </div>
      </section>
      <FeatureCTA />
    </MarketingShell>
  )
}
