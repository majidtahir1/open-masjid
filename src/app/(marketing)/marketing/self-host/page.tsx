import Link from 'next/link'
import { MarketingShell } from '../../_components/MarketingShell'
import { FeatureCTA } from '../../_components/FeatureSection'
import { Database, Github, Layers, Server, X } from '../../_components/Icons'

export const metadata = {
  title: 'Self-Host — OpenMasjid',
  description: 'Run OpenMasjid on your own server, free, forever. MIT-licensed. Same code we host.',
}

export default function SelfHostPage() {
  return (
    <MarketingShell current="/self-host">
      <section className="om-section-sm" style={{ paddingTop: 80, paddingBottom: 16, background: 'var(--om-bg-night)', color: 'white' }}>
        <div className="om-container on-dark">
          <div className="om-section-header" style={{ marginBottom: 24, textAlign: 'center' }}>
            <p className="om-eyebrow on-dark">Self-Host</p>
            <h1 className="om-h1" style={{ color: 'white', fontSize: 'clamp(2.25rem, 4vw, 3.5rem)' }}>
              Run OpenMasjid on your own server,{' '}
              <em style={{ fontStyle: 'italic', color: 'var(--icp-teal-300)' }}>free, forever.</em>
            </h1>
            <p className="om-lede" style={{ color: 'var(--om-fg-on-night-soft)', maxWidth: 640, margin: '20px auto 0' }}>
              MIT-licensed. Same code we host.{' '}
              <code style={{ fontFamily: 'var(--font-mono)', background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: 4 }}>
                docker compose up
              </code>
              , you're live. We mean it when we say there's no lock-in.
            </p>
          </div>

          <div className="om-terminal" style={{ maxWidth: 720, margin: '40px auto 0' }}>
            <div className="om-terminal-bar">
              <span /><span /><span />
              <span style={{ flex: 1, textAlign: 'center', color: 'var(--om-fg-on-night-soft)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
                ~/openmasjid
              </span>
            </div>
            <div className="om-terminal-body">
              <p><span className="t-prompt">$</span> git clone https://github.com/majidtahir1/open-masjid.git</p>
              <p className="t-out">Cloning into 'open-masjid'...</p>
              <p><span className="t-prompt">$</span> cp .env.example .env</p>
              <p><span className="t-prompt">$</span> docker compose up -d</p>
              <p className="t-out">Creating openmasjid_postgres... done</p>
              <p className="t-out">Creating openmasjid_web... done</p>
              <p className="t-out">Creating openmasjid_worker... done</p>
              <p className="t-success">→ Ready at http://localhost:3000</p>
              <p style={{ margin: '12px 0 0' }}>
                <span className="t-prompt">$</span> <span className="t-cursor" />
              </p>
            </div>
          </div>

          <div className="om-hero-ctas" style={{ justifyContent: 'center', marginTop: 32 }}>
            <a
              className="om-btn om-btn-on-dark om-btn-lg"
              href="https://github.com/majidtahir1/open-masjid"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Github width={16} height={16} /> Star on GitHub
            </a>
            <Link className="om-btn om-btn-secondary-dark om-btn-lg" href="/get-started">
              Or have us host it
            </Link>
          </div>
        </div>
      </section>

      <section className="om-section">
        <div className="om-container">
          <div className="om-self-grid">
            <div className="om-self-card">
              <span className="om-benefit-icon"><Server /></span>
              <h3 className="om-h4">Why self-host?</h3>
              <p className="om-body">
                Some masajid have an IT volunteer who'd rather own the box. Some run on TrueNAS in the imam's office.
                Some just want maximum control over their data. All valid.
              </p>
            </div>
            <div className="om-self-card">
              <span className="om-benefit-icon"><Layers /></span>
              <h3 className="om-h4">What you get</h3>
              <p className="om-body">
                Every feature on the Hosted plan. No artificial gates between Self-Host and Hosted.
                The same engine, on your hardware.
              </p>
            </div>
            <div className="om-self-card">
              <span className="om-benefit-icon"><X /></span>
              <h3 className="om-h4">What you don't get</h3>
              <p className="om-body">
                Managed backups. Email deliverability through our Resend account. Automatic updates. Support SLA.
                You can buy any of these as add-ons later.
              </p>
            </div>
            <div className="om-self-card">
              <span className="om-benefit-icon"><Database /></span>
              <h3 className="om-h4">Switch any time</h3>
              <p className="om-body">
                Self-host today, move to hosted when your volunteer moves away. Or vice versa.
                Same database schema either way. Postgres dump moves cleanly between them.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="om-section" style={{ background: 'var(--om-bg-cream)' }}>
        <div className="om-narrow">
          <div className="om-section-header center">
            <p className="om-eyebrow">Five-minute install</p>
            <h2 className="om-h2">Three commands. You're live.</h2>
          </div>
          <ol className="om-install-steps">
            <li>
              <span className="om-install-num">1</span>
              <div>
                <h4 className="om-h4">Clone the repo</h4>
                <pre className="om-code-block"><code>{`git clone https://github.com/majidtahir1/open-masjid.git
cd open-masjid`}</code></pre>
              </div>
            </li>
            <li>
              <span className="om-install-num">2</span>
              <div>
                <h4 className="om-h4">Configure environment</h4>
                <pre className="om-code-block"><code>{`cp .env.example .env
# edit .env: DATABASE_URL, STRIPE_KEYS, etc.`}</code></pre>
              </div>
            </li>
            <li>
              <span className="om-install-num">3</span>
              <div>
                <h4 className="om-h4">Start everything</h4>
                <pre className="om-code-block"><code>docker compose up -d</code></pre>
                <p className="om-meta" style={{ marginTop: 8 }}>
                  Detailed setup in the{' '}
                  <a
                    href="https://github.com/majidtahir1/open-masjid#readme"
                    style={{ color: 'var(--om-brand)', textDecoration: 'underline' }}
                  >
                    README
                  </a>.
                </p>
              </div>
            </li>
          </ol>
        </div>
      </section>

      <FeatureCTA
        to1="/get-started"
        label1="Or have us host it"
        to2="/pricing"
        label2="See pricing"
      />
    </MarketingShell>
  )
}
