import { MarketingShell } from '../../../_components/MarketingShell'
import { FeatureCTA, FeatureHero, FeatureSection } from '../../../_components/FeatureSection'
import { ArrowRight } from '../../../_components/Icons'

export const metadata = {
  title: 'Donations — OpenMasjid',
  description: 'Native Stripe donations with Sadaqah, Zakat, and Building Fund categories. No platform fee.',
}

export default function DonationsPage() {
  return (
    <MarketingShell current="/features/donations">
      <FeatureHero
        eyebrow="Donations"
        title="Sadaqah, Zakat, and Building Fund"
        em="in one tab."
        sub="Native Stripe donations with the categories your jamaa actually asks for, or a clean external link if you'd rather keep your existing processor. Your call."
      />

      <FeatureSection
        kicker="Categorized giving"
        title="The categories your jamaa actually asks for."
        body="Sadaqah, Zakat, Building Fund, General. Customize the labels. Donors pick a category at checkout — and you get a real report at the end of the month."
        side={
          <div className="om-mockup-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="om-tag-row" style={{ padding: '20px 20px 0' }}>
              {[
                { l: 'Sadaqah', a: true },
                { l: 'Zakat' },
                { l: 'Building Fund' },
                { l: 'General' },
              ].map((t) => (
                <span key={t.l} className={`om-tag-pill ${t.a ? 'is-active' : ''}`}>{t.l}</span>
              ))}
            </div>
            <div style={{ padding: '24px 20px' }}>
              <div className="om-amount-grid">
                {['$25', '$50', '$100', '$500'].map((a, i) => (
                  <span key={a} className={`om-amount-tile ${i === 1 ? 'is-active' : ''}`}>{a}</span>
                ))}
              </div>
              <input type="text" defaultValue="Other amount" className="om-mockup-input" style={{ marginTop: 12 }} />
              <button className="om-btn om-btn-primary" style={{ width: '100%', marginTop: 16, padding: '14px' }}>
                Donate $50 to Sadaqah <ArrowRight />
              </button>
            </div>
          </div>
        }
      />

      <FeatureSection
        alt
        kicker="No platform fee"
        title="Stripe charges Stripe's fee. We don't take a cut."
        body="2.9% + 30¢ in the US. Compare that to LaunchGood's 5%, GoFundMe's 2.9% + 30¢ + tip ask, or your bank's surprise wire fee. The difference goes to your masjid."
        side={
          <div className="om-cost-compare">
            <div className="om-cost-row"><span>$100 to Sadaqah, OpenMasjid + Stripe</span><b>$96.80</b></div>
            <div className="om-cost-row"><span>$100 to Sadaqah, LaunchGood</span><b>$92.20</b></div>
            <div className="om-cost-row"><span>$100 to Sadaqah, GoFundMe (with default tip)</span><b>$80.50</b></div>
            <p className="om-cost-foot">
              Difference per $10K raised: <b style={{ color: 'var(--om-brand)' }}>up to $1,630</b> stays with the masjid.
            </p>
          </div>
        }
      />

      <FeatureSection
        kicker="Or link out"
        title="Already on LaunchGood? Just paste the URL."
        body="If you already use LaunchGood, PayPal, or your bank's portal, paste the URL. We'll show a clean Donate button. Switch later when you're ready."
        side={
          <div className="om-mockup-card">
            <p className="om-mockup-label">External donation URL</p>
            <input
              type="text"
              defaultValue="https://launchgood.com/v4/campaign/masjid_alnoor"
              className="om-mockup-input"
            />
            <button className="om-btn om-btn-secondary" style={{ marginTop: 12 }}>Save</button>
          </div>
        }
      />

      <FeatureSection
        alt
        kicker="Recurring giving"
        title="Monthly Sadaqah Jariyah, supported."
        body="Toggle on. Donors choose monthly. The masjid gets predictable cashflow. Receipts are emailed automatically — and exported as a treasurer-ready CSV."
        side={
          <div className="om-mockup-card">
            <div className="om-toggle-row">
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, margin: 0, color: 'var(--fg1)' }}>Recurring monthly</p>
                <p style={{ fontSize: 12, color: 'var(--fg3)', margin: '4px 0 0' }}>Donor opts in at checkout</p>
              </div>
              <span className="om-toggle is-on"><span /></span>
            </div>
            <div className="om-toggle-row">
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, margin: 0, color: 'var(--fg1)' }}>Email tax receipts</p>
                <p style={{ fontSize: 12, color: 'var(--fg3)', margin: '4px 0 0' }}>Sent on every successful charge</p>
              </div>
              <span className="om-toggle is-on"><span /></span>
            </div>
          </div>
        }
      />

      <FeatureCTA />
    </MarketingShell>
  )
}
