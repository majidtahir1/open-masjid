import { Suspense } from 'react'
import { MarketingShell } from '../../../_components/MarketingShell'
import { CheckEmailContent } from './CheckEmailContent'

export const metadata = {
  title: 'Check your email — OpenMasjid',
}

export default function CheckEmailPage() {
  return (
    <MarketingShell current="/get-started">
      <section style={{ paddingTop: 96, paddingBottom: 120, background: 'linear-gradient(180deg, var(--om-bg-cream), white)' }}>
        <div className="om-narrow" style={{ textAlign: 'center', maxWidth: 560 }}>
          <p className="om-eyebrow">Almost there</p>
          <h1 className="om-h1" style={{ fontSize: 'clamp(2rem, 3.5vw, 3rem)', marginBottom: 20 }}>
            Check your email
          </h1>
          <Suspense fallback={<p className="om-lede">Loading…</p>}>
            <CheckEmailContent />
          </Suspense>
          <p className="om-lede" style={{ marginTop: 24, fontSize: '0.95rem' }}>
            Didn't get it? Check your spam folder, or{' '}
            <a href="/get-started" style={{ textDecoration: 'underline' }}>try again</a>.
          </p>
        </div>
      </section>
    </MarketingShell>
  )
}
