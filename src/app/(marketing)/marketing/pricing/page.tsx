'use client'

import { useState } from 'react'
import Link from 'next/link'
import { MarketingShell } from '../../_components/MarketingShell'
import { ArrowRight, Check, X } from '../../_components/Icons'

type CtaKind = 'primary' | 'secondary'

function PriceCard({
  tier,
  price,
  period,
  sub,
  cta,
  ctaTo,
  ctaKind,
  features,
  dis,
  featured,
}: {
  tier: string
  price: string
  period?: string
  sub: string
  cta: string
  ctaTo: string
  ctaKind: CtaKind
  features: string[]
  dis?: string[]
  featured?: boolean
}) {
  return (
    <article className={`om-price-card ${featured ? 'is-featured' : ''}`}>
      {featured && <span className="om-price-ribbon">Recommended</span>}
      <div>
        <p className="om-price-tier">{tier}</p>
        <div className="om-price-amount">
          <span className="om-price-num">{price}</span>
          {period && <span className="om-price-period">/{period}</span>}
        </div>
        <p className="om-price-sub">{sub}</p>
      </div>
      <Link
        className={`om-btn ${ctaKind === 'primary' ? 'om-btn-primary' : 'om-btn-secondary'} om-btn-lg`}
        href={ctaTo}
        style={{ width: '100%' }}
      >
        {cta} <ArrowRight />
      </Link>
      <ul className="om-price-features">
        {features.map((f) => (
          <li key={f}><Check width={18} height={18} /> <span>{f}</span></li>
        ))}
        {dis?.map((f) => (
          <li key={`dis-${f}`} className="dis"><X width={18} height={18} /> <span>{f}</span></li>
        ))}
      </ul>
    </article>
  )
}

const FAQS = [
  { q: 'Can a volunteer really run this?', a: 'Yes. Adding an event takes about two minutes. We onboard your first admin live for free on the Hosted plan.' },
  { q: 'Are donations halal?', a: "Donations run through Stripe. You decide what to label them (Sadaqah, Zakat, Building Fund, General). Stripe charges its own fee (2.9% + 30¢ in the US); we don't take a cut." },
  { q: "What if our masjid can't afford this?", a: "Apply for a Sadaqah scholarship. Hosted at $0, funded by paying masajid. We've never turned down a masjid in genuine need." },
  { q: 'Can we self-host?', a: 'Yes. Self-Host is free forever, fully open-source. git clone, docker compose up, you are live.' },
  { q: 'Will my custom domain still work?', a: 'Yes — point your DNS to us and we handle TLS automatically. Included on Hosted.' },
  { q: 'What happens to our donation history if we leave?', a: "You own your data. Export everything as Postgres dump + media archive any time, including donation records. There's no lock-in clause." },
]

export default function PricingPage() {
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly')
  const [openFaq, setOpenFaq] = useState(0)

  return (
    <MarketingShell current="/pricing">
      <section className="om-section-sm" style={{ paddingTop: 64, paddingBottom: 32 }}>
        <div className="om-narrow" style={{ textAlign: 'center' }}>
          <p className="om-eyebrow">Pricing</p>
          <h1 className="om-h1" style={{ fontSize: 'clamp(2.25rem, 4vw, 3.5rem)', marginBottom: 20 }}>
            One price. Everything included.{' '}
            <em style={{ fontStyle: 'italic', color: 'var(--om-accent-deep)' }}>Or run it yourself, free.</em>
          </h1>
          <p className="om-lede" style={{ maxWidth: 640, margin: '0 auto 32px' }}>
            Replace your hosting, events plugin, and donations processor with one tool. $49/month, all-in.
            Or self-host the same code on your own server, free forever.
          </p>
          <div className="om-billing-toggle" role="tablist">
            <button
              role="tab"
              aria-selected={billing === 'monthly'}
              className={billing === 'monthly' ? 'is-active' : ''}
              onClick={() => setBilling('monthly')}
            >
              Monthly · $49/mo
            </button>
            <button
              role="tab"
              aria-selected={billing === 'annual'}
              className={billing === 'annual' ? 'is-active' : ''}
              onClick={() => setBilling('annual')}
            >
              Annual · $490/yr <span className="om-pill om-pill-gold" style={{ marginLeft: 6 }}>2 months free</span>
            </button>
          </div>
        </div>
      </section>

      <section style={{ paddingBottom: 80 }}>
        <div className="om-container">
          <div className="om-price-grid">
            <PriceCard
              tier="Self-Host"
              price="Free"
              period="forever"
              sub="For masajid with an IT volunteer who'd rather own the box."
              cta="Self-host on GitHub"
              ctaTo="/self-host"
              ctaKind="secondary"
              features={[
                'Full source code (open-source)',
                'Every feature on the Hosted plan',
                'Run on your own server (Docker compose)',
                'Community support (GitHub Discussions)',
              ]}
              dis={['No managed hosting or backups', 'No email deliverability', 'No support SLA']}
            />
            <PriceCard
              tier="Hosted"
              price={billing === 'annual' ? '$490' : '$49'}
              period={billing === 'annual' ? 'year' : 'mo'}
              sub={billing === 'annual'
                ? 'Save $98/year — 2 months free.'
                : 'For masajid that want a website, not a sysadmin job.'}
              cta="Claim your subdomain"
              ctaTo="/get-started"
              ctaKind="primary"
              featured
              features={[
                'Hosted on .openmasjid.app + your custom domain',
                'Prayer times are quick and easy to set up',
                'Events with uploaded or auto-generated flyer',
                'Native donations (Stripe — Sadaqah, Zakat, Building Fund)',
                'Custom branding: logo, three colors, font',
                'Unlimited admin users',
                '50 GB media storage · daily backups',
                'Email support (24h response)',
                'One free 30-min onboarding session',
                'Quarterly security updates (zero-touch)',
              ]}
            />
          </div>
          <p className="om-price-foot">
            Stripe billing in USD. CAD, GBP, AUD at parity for the first year.
            Switch between Self-Host and Hosted any time — same code.
          </p>
        </div>
      </section>

      <section className="om-section" style={{ background: 'var(--om-bg-cream)' }}>
        <div className="om-narrow" style={{ textAlign: 'center' }}>
          <div className="om-star-divider"><span>✦</span></div>
          <h2 className="om-h2" style={{ marginBottom: 20 }}>Why only two plans?</h2>
          <p className="om-lede" style={{ maxWidth: 640, margin: '0 auto' }}>
            Because a masjid board doesn't need a five-tier feature matrix. You need to answer one question:{' '}
            <em>do we run this ourselves, or pay you to run it?</em> Every feature is in both plans.
            The difference is who owns the server.
          </p>
        </div>
      </section>

      <section className="om-section">
        <div className="om-narrow">
          <div className="om-section-header center">
            <p className="om-eyebrow">Frequently asked</p>
            <h2 className="om-h2">The questions every board asks.</h2>
          </div>

          <div className="om-faq">
            {FAQS.map((f, i) => (
              <details
                key={f.q}
                open={openFaq === i}
                onToggle={(e) => {
                  if ((e.target as HTMLDetailsElement).open) setOpenFaq(i)
                }}
              >
                <summary>
                  <span>{f.q}</span>
                  <span className="om-faq-icon" aria-hidden="true">+</span>
                </summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="om-section" style={{ background: 'var(--om-bg-night)', color: 'white' }}>
        <div className="om-container on-dark">
          <div className="om-section-header center">
            <p className="om-eyebrow on-dark">Access programs</p>
            <h2 className="om-h2" style={{ color: 'white' }}>If $49/mo doesn't fit, we have options.</h2>
          </div>
          <div className="om-access-grid">
            <div className="om-access-card">
              <p className="om-access-tag">Annual</p>
              <h4 className="om-h4" style={{ color: 'white' }}>$490/yr — 2 months free.</h4>
              <p>Most masajid pay annually so the treasurer signs one cheque per year.</p>
            </div>
            <div className="om-access-card">
              <p className="om-access-tag">Sadaqah scholarships</p>
              <h4 className="om-h4" style={{ color: 'white' }}>Hosted at $0 for masajid in genuine need.</h4>
              <p>Funded by paying masajid. Application form, reviewed quarterly. We've never turned down a masjid in genuine hardship.</p>
            </div>
            <div className="om-access-card">
              <p className="om-access-tag">Open-source contributors</p>
              <h4 className="om-h4" style={{ color: 'white' }}>Merge a PR → free Hosted for one year.</h4>
              <p>Help build OpenMasjid and your masjid gets the hosted plan free for a year. As many years as you contribute.</p>
            </div>
            <div className="om-access-card">
              <p className="om-access-tag">Early-tenant credit</p>
              <h4 className="om-h4" style={{ color: 'white' }}>First 25 masajid → 50% off for life.</h4>
              <p>$24.50/mo forever for being among the first to bet on us. About 8 spots remaining.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="om-section">
        <div className="om-narrow" style={{ textAlign: 'center' }}>
          <h2 className="om-h2" style={{ marginBottom: 20 }}>Still deciding?</h2>
          <p className="om-lede" style={{ marginBottom: 32 }}>
            Compare us directly against what your masjid runs today.
          </p>
          <div className="om-hero-ctas" style={{ justifyContent: 'center' }}>
            <Link className="om-btn om-btn-secondary" href="/compare/wordpress">Compare to WordPress</Link>
            <Link className="om-btn om-btn-secondary" href="/compare/madinaapps">Compare to MadinaApps</Link>
            <Link className="om-btn om-btn-secondary" href="/contact">Talk to us</Link>
          </div>
        </div>
      </section>
    </MarketingShell>
  )
}
