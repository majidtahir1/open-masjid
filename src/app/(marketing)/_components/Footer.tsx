import Link from 'next/link'
import { OMLogo } from './Logo'
import { Github, Twitter, Linkedin } from './Icons'

export function MarketingFooter() {
  return (
    <footer className="om-footer">
      <div className="om-container">
        <p className="om-footer-bismillah" aria-label="Bismillah">﷽</p>

        <div className="om-footer-grid">
          <div className="om-footer-brand">
            <OMLogo variant="arch" size={32} theme="dark" />
            <p>
              A modern, open-source website platform built for masajid.
              Run by your volunteers. Owned by you.
            </p>
          </div>

          <div className="om-footer-col">
            <h5>Product</h5>
            <ul>
              <li><Link href="/features">Features</Link></li>
              <li><Link href="/pricing">Pricing</Link></li>
              <li><Link href="/compare">Compare</Link></li>
              <li><Link href="/blog">Changelog</Link></li>
            </ul>
          </div>

          <div className="om-footer-col">
            <h5>For Masajid</h5>
            <ul>
              <li><Link href="/get-started">Get started</Link></li>
              <li><Link href="/self-host">Self-host</Link></li>
              <li><Link href="/contact">Migration help</Link></li>
              <li><Link href="/features/branding">Custom domain</Link></li>
            </ul>
          </div>

          <div className="om-footer-col">
            <h5>Resources</h5>
            <ul>
              <li><Link href="/docs">Docs</Link></li>
              <li><Link href="/blog">Blog</Link></li>
              <li><a href="https://github.com/majidtahir1/open-masjid" target="_blank" rel="noopener noreferrer">GitHub ↗</a></li>
            </ul>
          </div>

          <div className="om-footer-col">
            <h5>Company</h5>
            <ul>
              <li><Link href="/about">About</Link></li>
              <li><Link href="/contact">Contact</Link></li>
            </ul>
          </div>
        </div>

        <div className="om-footer-bottom">
          <span>© 2026 OpenMasjid · <span className="om-tagline">Built with niyyah for the ummah.</span></span>
          <div className="om-footer-social" aria-label="Social links">
            <a href="#" aria-label="Twitter / X"><Twitter /></a>
            <a href="https://github.com/majidtahir1/open-masjid" aria-label="GitHub"><Github width={18} height={18} /></a>
            <a href="#" aria-label="LinkedIn"><Linkedin /></a>
          </div>
        </div>
      </div>
    </footer>
  )
}
