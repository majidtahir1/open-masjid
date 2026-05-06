import Link from 'next/link'
import { OMLogo } from './Logo'
import { ArrowRight, ChevronDown, Sunrise, Calendar, ClipboardList, Heart, Palette, Shield } from './Icons'

const HEADER_NAV = [
  { label: 'Features', to: '/features', hasDropdown: true },
  { label: 'Pricing', to: '/pricing' },
  { label: 'Self-Host', to: '/self-host' },
  { label: 'Compare', to: '/compare' },
  { label: 'Blog', to: '/blog' },
]

const FEATURE_DROPDOWN = [
  { to: '/features/prayer-times', Icon: Sunrise, title: 'Prayer Times', desc: 'Quick, easy setup for the whole year.' },
  { to: '/features/events', Icon: Calendar, title: 'Events & Flyers', desc: 'Three display modes. Recurring patterns.' },
  { to: '/features/donations', Icon: Heart, title: 'Donations', desc: 'Native Stripe. Sadaqah, Zakat, Building Fund.' },
  { to: '/features/forms', Icon: ClipboardList, title: 'Forms & RSVPs', desc: 'Visual builder. Capacity. Payments.' },
  { to: '/features/branding', Icon: Palette, title: 'Branding', desc: 'Three colors. Your logo. Your font.' },
  { to: '/features/security', Icon: Shield, title: 'Security', desc: 'No plugins. No attack surface.' },
]

const PRAYER_TIMES = [
  { name: 'Fajr', time: '5:18' },
  { name: 'Dhuhr', time: '1:30' },
  { name: 'Asr', time: '5:42' },
  { name: 'Maghrib', time: '7:55' },
  { name: 'Isha', time: '9:25' },
]

export function MarketingPrayerStrip() {
  return (
    <div className="om-prayer-strip" role="status" aria-label="Today's prayer times">
      <span className="om-pst-tag">Today · 19 Shawwal</span>
      <div className="om-pst-times">
        {PRAYER_TIMES.map((p) => (
          <span key={p.name}>{p.name} <b>{p.time}</b></span>
        ))}
      </div>
      <span className="om-pst-meta">live demo</span>
    </div>
  )
}

function HeaderLink({
  to,
  label,
  current,
  hasDropdown,
}: {
  to: string
  label: string
  current: string
  hasDropdown?: boolean
}) {
  const isActive = current === to || (to !== '/' && current.startsWith(to))
  if (hasDropdown) {
    return (
      <div className="om-dropdown">
        <Link href={to} className={`om-dropdown-trigger ${isActive ? 'is-active' : ''}`}>
          {label} <ChevronDown />
        </Link>
        <div className="om-dropdown-menu" role="menu">
          {FEATURE_DROPDOWN.map(({ to: t, Icon, title, desc }) => (
            <Link key={t} href={t} className="om-dropdown-item">
              <span className="om-di-icon"><Icon width={18} height={18} /></span>
              <span>
                <p className="om-di-title">{title}</p>
                <p className="om-di-desc">{desc}</p>
              </span>
            </Link>
          ))}
        </div>
      </div>
    )
  }
  return (
    <Link href={to} className={isActive ? 'is-active' : ''}>
      {label}
    </Link>
  )
}

export function MarketingHeader({ current = '/' }: { current?: string }) {
  return (
    <>
      <MarketingPrayerStrip />
      <header className="om-header">
        <div className="om-header-inner">
          <Link href="/" aria-label="OpenMasjid home">
            <OMLogo variant="stack" size={36} />
          </Link>
          <nav className="om-nav" aria-label="Main">
            {HEADER_NAV.map((n) => (
              <HeaderLink key={n.to} {...n} current={current} />
            ))}
          </nav>
          <div className="om-nav-end">
            <a className="signin" href="https://admin.openmasjid.app" aria-label="Sign in to admin">Sign in</a>
            <Link className="om-btn om-btn-primary" href="/get-started">
              Get started
              <ArrowRight />
            </Link>
          </div>
        </div>
      </header>
    </>
  )
}
