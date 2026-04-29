'use client'

import { useState } from 'react'
import { MarketingShell } from '../../../_components/MarketingShell'
import { BrowserFrame, TenantPreview } from '../../../_components/TenantPreview'
import { FeatureCTA, FeatureHero, FeatureSection } from '../../../_components/FeatureSection'
import { Check } from '../../../_components/Icons'

const PRESETS = [
  { brand: '#0F1E4A', accent: '#1E7E8E', label: 'Navy / Teal' },
  { brand: '#1E7E8E', accent: '#D9A84E', label: 'Teal / Gold' },
  { brand: '#5A2E1F', accent: '#D9A84E', label: 'Maroon / Gold' },
  { brand: '#0E2A2C', accent: '#28A0B4', label: 'Night / Aqua' },
  { brand: '#3A4D2A', accent: '#D9A84E', label: 'Olive / Gold' },
]

const FONTS = [
  { name: 'Fraunces', style: { fontFamily: 'Fraunces, serif' } },
  { name: 'DM Serif Display', style: { fontFamily: '"DM Serif Display", serif' } },
  { name: 'Cormorant', style: { fontFamily: 'Cormorant, serif' } },
  { name: 'Inter Tight', style: { fontFamily: 'Inter, sans-serif', fontWeight: 600 } },
]

export default function BrandingPage() {
  const [tBrand, setTBrand] = useState('#0F1E4A')
  const [tAccent, setTAccent] = useState('#1E7E8E')

  return (
    <MarketingShell current="/features/branding">
      <FeatureHero
        eyebrow="Branding & Themes"
        title="Looks like your masjid built it."
        em="In five minutes."
        sub="One opinionated template, three colors, your logo, your font. The whole site reskins itself. No theme to pick, no designer to hire."
      />

      <section className="om-section" style={{ background: 'var(--om-bg-cream)' }}>
        <div className="om-container">
          <div className="om-section-header center">
            <p className="om-eyebrow">Live demo</p>
            <h2 className="om-h2">Three colors do all the work.</h2>
            <p className="om-lede" style={{ maxWidth: 540, margin: '16px auto 0' }}>
              Pick a brand and accent. We derive hover states, soft tints, and pressed states automatically.
            </p>
          </div>

          <div className="om-branding-demo">
            <div className="om-branding-controls">
              <p className="om-mockup-label">Presets</p>
              <div className="om-preset-grid">
                {PRESETS.map((p) => (
                  <button
                    key={p.label}
                    className={`om-preset ${tBrand === p.brand ? 'is-active' : ''}`}
                    onClick={() => { setTBrand(p.brand); setTAccent(p.accent) }}
                  >
                    <span className="om-preset-swatches">
                      <span style={{ background: p.brand }} />
                      <span style={{ background: p.accent }} />
                    </span>
                    {p.label}
                  </button>
                ))}
              </div>

              <div style={{ marginTop: 24 }}>
                <p className="om-mockup-label">Brand</p>
                <div className="om-color-input">
                  <input type="color" value={tBrand} onChange={(e) => setTBrand(e.target.value)} />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>{tBrand}</span>
                </div>
              </div>
              <div style={{ marginTop: 16 }}>
                <p className="om-mockup-label">Accent</p>
                <div className="om-color-input">
                  <input type="color" value={tAccent} onChange={(e) => setTAccent(e.target.value)} />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>{tAccent}</span>
                </div>
              </div>

              <div className="om-derived">
                <p className="om-mockup-label" style={{ marginBottom: 10 }}>Auto-derived palette</p>
                <div className="om-derived-row">
                  <span style={{ background: tBrand, opacity: 1 }}>700</span>
                  <span style={{ background: tBrand, opacity: 0.85 }}>800</span>
                  <span style={{ background: tBrand, opacity: 0.7 }}>900</span>
                  <span style={{ background: tBrand, opacity: 0.15, color: tBrand }}>50</span>
                </div>
                <div className="om-derived-row">
                  <span style={{ background: tAccent, opacity: 1 }}>500</span>
                  <span style={{ background: tAccent, opacity: 0.8 }}>700</span>
                  <span style={{ background: tAccent, opacity: 0.18, color: tAccent }}>50</span>
                </div>
              </div>
            </div>

            <div>
              <BrowserFrame url="masjid.openmasjid.app">
                <TenantPreview brand={{ primary: tBrand, accent: tAccent, name: 'Masjid Al-Noor', city: 'Plano, TX' }} />
              </BrowserFrame>
            </div>
          </div>
        </div>
      </section>

      <FeatureSection
        kicker="Curated typography"
        title="A short list. No 800-font dropdown."
        body="Choose from a curated set of display fonts that pair well with Inter (body) and Amiri (Arabic). Each pairing is hand-tuned."
        side={
          <div className="om-font-grid">
            {FONTS.map((t) => (
              <div key={t.name} className="om-font-card">
                <p style={{ ...t.style, fontSize: 24, margin: 0 }}>The masjid is a sanctuary.</p>
                <p style={{
                  fontSize: 11,
                  color: 'var(--fg3)',
                  margin: '6px 0 0',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}>{t.name}</p>
              </div>
            ))}
          </div>
        }
      />

      <FeatureSection
        kicker="Your domain, your identity"
        title="Bring your own domain. We'll wire it up."
        body="Most masajid we work with use their own domain — yourmasjid.org, masjidalnoor.com, whatever you already own or want to register. Point your DNS at us and we'll provision SSL, handle www redirects, and keep certificates renewed forever. If you don't have a domain yet, we'll start you on yourmasjid.openmasjid.app and you can switch any time without breaking links."
        side={
          <div className="om-mockup-card">
            <p className="om-mockup-label">Custom domain</p>
            <input type="text" defaultValue="masjidalnoor.org" className="om-mockup-input" readOnly />
            <p className="om-mockup-foot" style={{ marginTop: 12, color: 'var(--icp-success)' }}>
              <Check width={14} height={14} /> SSL active · auto-renewing · www → apex
            </p>
            <hr style={{ border: 0, borderTop: '1px solid var(--om-border)', margin: '20px 0' }} />
            <p className="om-mockup-label">Or start free on a subdomain</p>
            <div className="om-subdomain-input">
              <input type="text" defaultValue="alnoor" readOnly />
              <span>.openmasjid.app</span>
            </div>
            <p className="om-mockup-foot" style={{ marginTop: 12 }}>
              Move to your own domain whenever — old links keep working.
            </p>
          </div>
        }
      />

      <FeatureSection
        alt
        kicker="What you can't customize"
        title="On purpose."
        body="Page layout, component structure, and section order are platform-level decisions. That's the point. Your volunteers can never break the design — and the design improves automatically when we ship updates."
        side={
          <div className="om-mockup-card">
            <ul className="om-list" style={{ margin: 0 }}>
              <li><b>You control:</b> logo, three colors, font, copy, content.</li>
              <li><b>We control:</b> layout, spacing, accessibility, mobile breakpoints.</li>
              <li><b>The trade:</b> your volunteers can't break the site. We can't ship surprises.</li>
            </ul>
          </div>
        }
      />

      <FeatureCTA />
    </MarketingShell>
  )
}
