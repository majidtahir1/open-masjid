import { MarketingShell } from '../../../_components/MarketingShell'
import { FeatureCTA, FeatureHero, FeatureSection } from '../../../_components/FeatureSection'
import { Github } from '../../../_components/Icons'

export const metadata = {
  title: 'Security — OpenMasjid',
  description: "Secure for large and small masajid. No plugin marketplace. No third-party scripts you didn't approve.",
}

export default function SecurityPage() {
  const stat = (label: string, val: string) => (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      padding: '16px 0',
      borderBottom: '1px solid var(--om-border)',
    }}>
      <span style={{ fontSize: 14, color: 'var(--fg2)' }}>{label}</span>
      <b style={{ color: 'var(--icp-success)', fontFamily: 'var(--font-mono)', fontSize: 18 }}>{val}</b>
    </div>
  )

  return (
    <MarketingShell current="/features/security">
      <FeatureHero
        eyebrow="Security"
        title="Secure"
        em="for large and small masajid."
        sub="No plugin marketplace, no theme ecosystem, no third-party scripts you didn't approve. The #1 attack surface on every masjid's WordPress site simply doesn't exist here."
      />

      <FeatureSection
        kicker="No plugins"
        title="The #1 attack vector, gone."
        body="Plugins are how WordPress masajid get compromised. We don't have plugins. The features in the platform are the features in the platform — and they ship from one audited codebase."
        side={
          <div className="om-mockup-card">
            {stat('Plugins installed', '0')}
            {stat('Themes installed', '0')}
            {stat('Third-party scripts', '0')}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 0' }}>
              <span style={{ fontSize: 14, color: 'var(--fg2)' }}>Attack surface</span>
              <b style={{ color: 'var(--icp-success)', fontFamily: 'var(--font-mono)', fontSize: 18 }}>minimal</b>
            </div>
          </div>
        }
      />

      <FeatureSection
        alt
        kicker="One codebase, audited"
        title="Fix once. Ships everywhere."
        body="What ships to one masjid ships to every masjid. Vulnerabilities get fixed once and the fix rolls out everywhere — automatically on Hosted, with one docker-compose pull on Self-Host."
        side={
          <div
            className="om-mockup-card"
            style={{ background: '#0F1E4A', color: 'white', border: 'none', fontFamily: 'var(--font-mono)', fontSize: 13 }}
          >
            <p style={{ color: 'var(--icp-teal-300)', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', margin: '0 0 16px' }}>
              Last security release
            </p>
            <p style={{ margin: '0 0 8px' }}><span style={{ color: '#A4E6B6' }}>v1.4.2</span> · 2026-04-15</p>
            <p style={{ margin: '0 0 4px', opacity: 0.85 }}>· upgraded Next.js (CVE-2026-0124)</p>
            <p style={{ margin: '0 0 4px', opacity: 0.85 }}>· tightened CSP for embed routes</p>
            <p style={{ margin: '0 0 16px', opacity: 0.85 }}>· rotated all signed-URL secrets</p>
            <p style={{ color: 'var(--icp-teal-300)', fontSize: 12, margin: 0 }}>Pushed to all 12 hosted tenants.</p>
          </div>
        }
      />

      <FeatureSection
        kicker="Quarterly updates"
        title="Zero-touch on Hosted. One command on Self-Host."
        body="We ship security updates four times a year on a regular schedule, plus emergency patches as needed. Hosted tenants get them automatically. Self-Host runs `docker compose pull && docker compose up -d`."
        side={
          <div
            className="om-mockup-card"
            style={{ fontFamily: 'var(--font-mono)', fontSize: 13, background: '#0E2A2C', color: '#A4E6B6', border: 'none' }}
          >
            <p style={{ margin: 0, color: '#7AB6BF' }}><span style={{ color: '#5CB8C3' }}>$</span> docker compose pull</p>
            <p style={{ margin: '6px 0 0', opacity: 0.7 }}>Pulling openmasjid:1.4.2... done</p>
            <p style={{ margin: '6px 0 0', color: '#7AB6BF' }}><span style={{ color: '#5CB8C3' }}>$</span> docker compose up -d</p>
            <p style={{ margin: '6px 0 0', opacity: 0.7 }}>Recreating openmasjid_web... done</p>
            <p style={{ margin: '6px 0 0', opacity: 0.7 }}>Recreating openmasjid_worker... done</p>
            <p style={{ margin: '12px 0 0', color: '#A4E6B6' }}>Updated. Site stayed up.</p>
          </div>
        }
      />

      <FeatureSection
        alt
        kicker="Tenant isolation"
        title="Enforced at the database, not the application."
        body="Every query checks the tenant relationship at the row level. No cross-tenant leaks, ever. We've stress-tested this — see our security writeup on GitHub."
        side={
          <div className="om-mockup-card">
            <p className="om-mockup-label">Open source = audited by you</p>
            <p style={{ fontSize: 14, color: 'var(--fg2)', lineHeight: 1.6, margin: '0 0 16px' }}>
              Read the code. Hire a security firm to read the code. Run static analysis. We have nothing to hide.
            </p>
            <a
              href="https://github.com/majidtahir1/open-masjid"
              target="_blank"
              rel="noopener noreferrer"
              className="om-btn om-btn-secondary"
            >
              <Github width={16} height={16} /> View on GitHub
            </a>
          </div>
        }
      />

      <FeatureCTA />
    </MarketingShell>
  )
}
