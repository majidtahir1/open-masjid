import { MarketingShell } from '../../_components/MarketingShell'
import { FeatureCTA } from '../../_components/FeatureSection'

const TITLE = 'About — OpenMasjid'
const DESCRIPTION =
  'Built for the ummah. Owned by it. OpenMasjid started because one masjid couldn’t find a website it could trust.'

export const metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/about' },
  openGraph: { title: TITLE, description: DESCRIPTION, url: '/about', type: 'website' },
  twitter: { title: TITLE, description: DESCRIPTION },
}

const CARDS = [
  {
    eyebrow: 'Why this exists',
    title: 'One masjid. One bad WordPress incident.',
    body: "A masjid we know needed to leave WordPress after their old site was compromised. We couldn't find a single platform that was secure, modern, and built around how masajid actually run. So we built one — and made it available to every other masjid in the same situation.",
  },
  {
    eyebrow: 'Why open-source',
    title: 'Lock-in is incompatible with khidmah.',
    body: 'If we ever stop being good for your masjid, you should be able to leave with your data and the same code. Open-sourcing it was the only choice that made sense.',
  },
  {
    eyebrow: 'Why one template',
    title: "Most masajid don't need a unique design.",
    body: "They need a credible, fast, accessible site that reflects their masjid's identity. One opinionated template + per-masjid skin gets 95% of the way to “designed by a real designer,” at 0% of the cost.",
  },
  {
    eyebrow: "Who's behind it",
    title: 'A small team of Muslim builders.',
    body: 'We attend masjid like you do. We are not VC-funded. We are not "scaling at all costs." We are trying to build something useful that lasts.',
  },
]

export default function AboutPage() {
  return (
    <MarketingShell current="/about">
      <section className="om-section-sm" style={{ paddingTop: 80, paddingBottom: 16 }}>
        <div className="om-narrow" style={{ textAlign: 'center' }}>
          <p className="om-eyebrow">About</p>
          <h1 className="om-h1" style={{ fontSize: 'clamp(2.25rem, 4vw, 3.5rem)' }}>
            Built for the ummah. <em style={{ fontStyle: 'italic', color: 'var(--om-accent-deep)' }}>Owned by it.</em>
          </h1>
          <p className="om-lede" style={{ maxWidth: 640, margin: '20px auto 0' }}>
            OpenMasjid started because one masjid couldn't find a website it could trust, afford, and run with volunteers.
            The platform we built for them is now available to every masjid that needs the same thing.
          </p>
        </div>
      </section>

      <section className="om-section">
        <div className="om-container">
          <div className="om-about-grid">
            {CARDS.map((c) => (
              <article key={c.title} className="om-about-card">
                <p className="om-eyebrow">{c.eyebrow}</p>
                <h3 className="om-h3" style={{ fontSize: '1.5rem', marginTop: 12 }}>{c.title}</h3>
                <p className="om-body" style={{ marginTop: 12 }}>{c.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <FeatureCTA />
    </MarketingShell>
  )
}
