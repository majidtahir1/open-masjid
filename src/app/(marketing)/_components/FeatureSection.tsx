import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowRight } from './Icons'

export function FeatureHero({
  eyebrow,
  title,
  em,
  sub,
}: {
  eyebrow: string
  title: string
  em?: string
  sub: string
}) {
  return (
    <section
      className="om-section-sm"
      style={{ paddingTop: 80, paddingBottom: 16, background: 'linear-gradient(180deg, var(--om-bg-cream), white)' }}
    >
      <div className="om-narrow">
        <p className="om-eyebrow">
          <Link href="/features" style={{ color: 'inherit', textDecoration: 'none' }}>Features</Link> · {eyebrow}
        </p>
        <h1 className="om-h1" style={{ fontSize: 'clamp(2.25rem, 4vw, 3.5rem)', marginBottom: 20, marginTop: 12 }}>
          {title} {em && <em style={{ fontStyle: 'italic', color: 'var(--om-accent-deep)' }}>{em}</em>}
        </h1>
        <p className="om-lede" style={{ maxWidth: 640 }}>{sub}</p>
      </div>
    </section>
  )
}

export function FeatureSection({
  title,
  body,
  side,
  alt = false,
  kicker,
}: {
  title: string
  body: ReactNode
  side: ReactNode
  alt?: boolean
  kicker?: string
}) {
  return (
    <section className={`om-feature-row ${alt ? 'is-alt' : ''}`}>
      <div className="om-container om-feature-row-grid">
        <div className="om-feature-row-text">
          {kicker && <p className="om-eyebrow">{kicker}</p>}
          <h3 className="om-h3">{title}</h3>
          {typeof body === 'string' ? <p className="om-body" style={{ fontSize: 16 }}>{body}</p> : body}
        </div>
        <div className="om-feature-row-side">{side}</div>
      </div>
    </section>
  )
}

export function FeatureCTA({
  to1 = '/get-started',
  label1 = 'Claim your subdomain',
  to2 = '/features',
  label2 = 'See all features',
}: {
  to1?: string
  label1?: string
  to2?: string
  label2?: string
}) {
  return (
    <section className="om-section" style={{ background: 'var(--om-bg-soft)' }}>
      <div className="om-narrow" style={{ textAlign: 'center' }}>
        <div className="om-star-divider"><span>✦</span></div>
        <h2 className="om-h2" style={{ marginBottom: 24 }}>Ready to try it?</h2>
        <div className="om-hero-ctas" style={{ justifyContent: 'center' }}>
          <Link className="om-btn om-btn-primary om-btn-lg" href={to1}>{label1} <ArrowRight /></Link>
          <Link className="om-btn om-btn-secondary om-btn-lg" href={to2}>{label2}</Link>
        </div>
      </div>
    </section>
  )
}
