import { MarketingShell } from '../../_components/MarketingShell'
import { ArrowRight, Calendar, Github, Mail } from '../../_components/Icons'

export const metadata = {
  title: 'Contact — OpenMasjid',
  description: 'Talk to a human. Whether you are evaluating, migrating, or applying for a Sadaqah scholarship, we will respond within one business day.',
}

export default function ContactPage() {
  return (
    <MarketingShell current="/contact">
      <section className="om-section-sm" style={{ paddingTop: 80, paddingBottom: 16 }}>
        <div className="om-narrow" style={{ textAlign: 'center' }}>
          <p className="om-eyebrow">Contact</p>
          <h1 className="om-h1" style={{ fontSize: 'clamp(2.25rem, 4vw, 3.5rem)' }}>Talk to a human.</h1>
          <p className="om-lede" style={{ maxWidth: 640, margin: '20px auto 0' }}>
            Whether you are evaluating, migrating, or applying for a Sadaqah scholarship,
            we will respond within one business day.
          </p>
        </div>
      </section>
      <section className="om-section">
        <div className="om-container">
          <div className="om-contact-grid">
            <a href="#" className="om-card om-card-hover om-contact-card">
              <span className="om-benefit-icon"><Calendar /></span>
              <h3 className="om-h4">Schedule a 30-min call</h3>
              <p className="om-body">Walk through your masjid's setup with us. Migration questions welcome.</p>
              <span className="om-link-arrow">Book on Cal.com <ArrowRight /></span>
            </a>
            <a href="mailto:hello@openmasjid.app" className="om-card om-card-hover om-contact-card">
              <span className="om-benefit-icon"><Mail /></span>
              <h3 className="om-h4">Email us</h3>
              <p className="om-body">hello@openmasjid.app — for evaluations, migrations, scholarships.</p>
              <span className="om-link-arrow">Send an email <ArrowRight /></span>
            </a>
            <a
              href="https://github.com/majidtahir1/open-masjid/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="om-card om-card-hover om-contact-card"
            >
              <span className="om-benefit-icon"><Github /></span>
              <h3 className="om-h4">GitHub Issues</h3>
              <p className="om-body">Bug reports and feature requests, in the open. Anyone can read them.</p>
              <span className="om-link-arrow">Open an issue <ArrowRight /></span>
            </a>
          </div>
        </div>
      </section>
    </MarketingShell>
  )
}
