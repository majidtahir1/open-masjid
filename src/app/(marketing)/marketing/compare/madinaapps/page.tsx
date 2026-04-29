import Link from 'next/link'
import { MarketingShell } from '../../../_components/MarketingShell'
import { CompareTable } from '../../../_components/CompareTable'
import { FeatureCTA } from '../../../_components/FeatureSection'

export const metadata = {
  title: 'OpenMasjid vs MadinaApps — Compare',
  description: 'MadinaApps gets the masjid content model right. We agree with the premise — and disagree with the lock-in.',
}

export default function CompareMadinaAppsPage() {
  return (
    <MarketingShell current="/compare/madinaapps">
      <section className="om-section-sm" style={{ paddingTop: 80, paddingBottom: 16 }}>
        <div className="om-narrow">
          <p className="om-eyebrow">
            <Link href="/compare" style={{ color: 'inherit' }}>Compare</Link> · MadinaApps
          </p>
          <h1 className="om-h1" style={{ fontSize: 'clamp(2.25rem, 4vw, 3.5rem)', marginTop: 12, marginBottom: 20 }}>
            OpenMasjid <em style={{ fontStyle: 'italic', color: 'var(--om-accent-deep)' }}>vs MadinaApps</em>
          </h1>
          <p className="om-lede" style={{ maxWidth: 640 }}>
            MadinaApps gets the masjid content model right. We agree with the premise — and disagree with the lock-in.
          </p>
        </div>
      </section>
      <section className="om-section">
        <div className="om-container">
          <CompareTable
            leftLabel="MadinaApps"
            rows={[
              { label: 'Built for masajid', left: 'Yes', right: 'Yes' },
              { label: 'Modern design', left: 'Dated', right: 'Designed-by-default 2026' },
              { label: 'Custom branding', left: 'Limited', right: 'Full skin: logo, 3 colors, font' },
              { label: 'Open-source', left: 'No', right: 'MIT' },
              { label: 'Self-host option', left: 'No', right: 'Yes, free' },
              { label: 'Data export', left: 'Limited', right: 'Full Postgres dump anytime' },
            ]}
          />
        </div>
      </section>
      <FeatureCTA />
    </MarketingShell>
  )
}
