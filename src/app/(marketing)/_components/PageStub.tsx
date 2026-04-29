import Link from 'next/link'
import { MarketingShell } from './MarketingShell'

export function PageStub({
  title,
  sub,
  current,
}: {
  title: string
  sub: string
  current: string
}) {
  return (
    <MarketingShell current={current}>
      <section className="om-section-lg" style={{ textAlign: 'center' }}>
        <div className="om-narrow">
          <p className="om-eyebrow">{title}</p>
          <h1 className="om-h1" style={{ fontSize: 'clamp(2.25rem, 4vw, 3.5rem)', marginTop: 16 }}>Coming soon.</h1>
          <p className="om-lede" style={{ maxWidth: 560, margin: '24px auto 32px' }}>{sub}</p>
          <Link href="/" className="om-btn om-btn-secondary">← Back home</Link>
        </div>
      </section>
    </MarketingShell>
  )
}
