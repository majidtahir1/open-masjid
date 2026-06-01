import Link from 'next/link'
import { ArrowRight, Sparkles } from './Icons'

/* Slim announcement-style banner for the home page, sits above the hero,
   in the classic announcement-bar position under the nav. Ported from the
   Claude Design handoff (assistant/HomeSpotlight.jsx · AnsariBanner). */
export function AnsariBanner() {
  return (
    <section className="oa-home-banner">
      <div className="om-container oa-home-banner-inner">
        <span className="oa-home-banner-new">New</span>
        <p className="oa-home-banner-text">
          <Sparkles className="oa-bspark" width={16} height={16} />
          Meet <b>OpenMasjid Ansari</b>, the AI assistant that makes managing a masjid a breeze.
        </p>
        <Link className="om-btn om-btn-on-dark" href="/features/ansari">
          Meet Ansari <ArrowRight />
        </Link>
      </div>
    </section>
  )
}
