import Link from 'next/link'
import { MarketingShell } from '../../_components/MarketingShell'
import { ArrowRight, Globe, Layers, Sparkles } from '../../_components/Icons'

export const metadata = {
  title: 'Compare — OpenMasjid',
  description: 'Honest comparisons against the three most common alternatives masajid actually consider.',
}

const ITEMS = [
  { slug: 'wordpress', title: 'vs WordPress', sub: 'The most common masjid platform. Also the most commonly hacked.', Icon: Globe },
  { slug: 'madinaapps', title: 'vs MadinaApps', sub: 'Right content model. Wrong lock-in.', Icon: Layers },
  { slug: 'squarespace', title: 'vs Squarespace', sub: 'Beautiful for restaurants. No idea what jummah is.', Icon: Sparkles },
]

export default function CompareHubPage() {
  return (
    <MarketingShell current="/compare">
      <section className="om-section-sm" style={{ paddingTop: 80, paddingBottom: 16 }}>
        <div className="om-narrow" style={{ textAlign: 'center' }}>
          <p className="om-eyebrow">Compare</p>
          <h1 className="om-h1" style={{ fontSize: 'clamp(2.25rem, 4vw, 3.5rem)' }}>
            How OpenMasjid <em style={{ fontStyle: 'italic', color: 'var(--om-accent-deep)' }}>compares.</em>
          </h1>
          <p className="om-lede" style={{ maxWidth: 640, margin: '20px auto 0' }}>
            Honest comparisons against the three most common alternatives masajid actually consider.
          </p>
        </div>
      </section>
      <section className="om-section">
        <div className="om-container">
          <div className="om-compare-grid">
            {ITEMS.map(({ slug, title, sub, Icon }) => (
              <Link
                key={slug}
                href={`/compare/${slug}`}
                className="om-card om-card-hover"
                style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
              >
                <span className="om-benefit-icon"><Icon /></span>
                <h3 className="om-h3" style={{ fontSize: '1.5rem' }}>{title}</h3>
                <p className="om-body">{sub}</p>
                <span className="om-link-arrow">See the comparison <ArrowRight /></span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </MarketingShell>
  )
}
