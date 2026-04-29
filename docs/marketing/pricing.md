# OpenMasjid Pricing

## Strategy summary

**Two plans. That's it.**
- **Self-Host** — Free forever, MIT-licensed. Run it yourself.
- **Hosted** — $49/mo flat. We run it for you. Everything included.

**Why only two:**
A masjid board doesn't need a five-tier feature comparison. They need to answer one question: "do we run this ourselves, or pay you to run it?" Removing tier psychology removes a category of objection.

**Value metric:** flat per masjid. No per-seat, no per-event, no metered storage games. The price you sign up at is the price you renew at.

**Anchor:** masajid currently pay $40 hosting + $30 events plugin + $30 donations processor + freelancer ad-hoc = $80–$300/mo across stitched tools. Replace the whole stack at $49/mo and the math is obvious.

**Floor (anti-lock-in):** Self-Host is the open-source distribution itself. Same code we host. Doubles as a trust signal — "if you ever leave us, the code is yours forever."

| Plan | Price | Who it's for |
|------|-------|--------------|
| **Self-Host** | Free forever | Masajid with an IT volunteer who'd rather own the box |
| **Hosted** | $49/mo (or $490/yr — 2 months free) | Masajid that want a website, not a sysadmin job |

Stripe billing, USD; CAD/GBP/AUD at parity for first year.

---

## What's in each plan

### Self-Host — Free, forever
- Full source code (MIT license)
- Every feature on the Hosted plan
- Run on your own server (Docker compose)
- Community support (GitHub Discussions)
- ✗ No managed hosting, no backups, no email deliverability, no support SLA

### Hosted — $49/mo
**Everything. No tier games.**
- Hosted on `[masjid].openmasjid.app` and your custom domain
- Prayer times: manual, CSV bulk import, or Aladhan API auto-update
- Events with uploaded flyer or auto-generated branded flyer
- Native donations (Stripe — Sadaqah / Zakat / Building Fund)
- Custom branding: logo, three colors, font
- Unlimited admin users
- 50 GB media storage
- Daily backups
- Email support (24h response)
- One free 30-min onboarding session
- Free migration from WordPress / MadinaApps
- Quarterly security updates (zero-touch)

---

## What every plan includes (Self-Host or Hosted)

- All features (we don't gate features behind tiers)
- Custom branding: logo, 3 colors, font (5-min setup)
- Mobile-friendly, accessible, fast (Lighthouse 95+)
- No plugin malware risk (no plugin ecosystem)
- Export your data anytime (Postgres dump + media archive)
- Switch between Self-Host and Hosted any time — same code

---

## Access programs

- **Annual:** 2 months free ($490/yr)
- **Sadaqah scholarships:** masajid in genuine financial hardship can apply for Hosted at $0. Funded by paying masajid. Application form, reviewed quarterly.
- **Open-source contributors:** merge a PR → free Hosted for one year for your masjid
- **Early-tenant credit:** first 25 hosted masajid → 50% off Hosted for life ($24.50/mo)

---

## Pricing page copy

> # One price. Everything included. Or run it yourself, free.
>
> Replace your hosting, events plugin, and donations processor with one tool. $49/month, all-in. Or self-host the same code on your own server, free forever.
>
> [ Monthly **$49/mo** | Annual **$490/yr — 2 months free** ]
>
> *(two tier cards — Self-Host / Hosted)*
>
> ## Why only two plans?
> Because a masjid board doesn't need a five-tier feature matrix. You need to answer one question: do we run this ourselves, or pay you to run it? Every feature is in both plans. The difference is who owns the server.
>
> ## Frequently asked
>
> **Can a volunteer really run this?**
> Yes. Adding an event takes about two minutes. We onboard your first admin live for free on the Hosted plan.
>
> **Do you handle migration from WordPress?**
> Yes — free on Hosted. Send us your old site URL and we'll move events, pages, and prayer times for you.
>
> **Are donations halal?**
> Donations run through Stripe. You decide what to label them (Sadaqah, Zakat, Building Fund, General). Stripe charges its own fee (2.9% + 30¢ in the US); we don't take a cut.
>
> **What if our masjid can't afford this?**
> Apply for a Sadaqah scholarship. Hosted at $0, funded by paying masajid. We've never turned down a masjid in genuine need.
>
> **Can we self-host?**
> Yes. Self-Host is free forever, MIT-licensed. `git clone`, `docker compose up`, you're live.
>
> **Will my custom domain still work?**
> Yes — point your DNS to us and we handle TLS automatically. Included on Hosted.
>
> **What happens to our donation history if we leave?**
> You own your data. Export everything as Postgres dump + media archive any time, including donation records. There's no lock-in clause.
>
> ## Still deciding?
> [ Compare to WordPress ] [ Compare to MadinaApps ] [ Talk to us ]
