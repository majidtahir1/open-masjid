'use client'

import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { MarketingShell } from '../../_components/MarketingShell'
import { ArrowRight, Check } from '../../_components/Icons'

const MIGRATION_OPTIONS = ['Starting fresh', 'From WordPress', 'From MadinaApps', 'Other']

const STOP_WORDS = new Set([
  'masjid', 'mosque', 'islamic', 'center', 'centre', 'of', 'the',
  'al', 'an', 'ar', 'as', 'ash', 'at', 'az',
])

function slugifyMasjidName(name: string): string {
  const cleaned = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
  const tokens = cleaned.split(/[^a-z0-9]+/).filter((t) => t && !STOP_WORDS.has(t))
  const slug = (tokens.length ? tokens : cleaned.split(/[^a-z0-9]+/).filter(Boolean)).join('')
  return slug.slice(0, 32)
}

type FieldErrors = Partial<Record<
  'masjidName' | 'subdomain' | 'firstName' | 'email',
  string
>>

export default function GetStartedPage() {
  const router = useRouter()
  const [migration, setMigration] = useState('Starting fresh')
  const [masjidName, setMasjidName] = useState('')
  const [subdomain, setSubdomain] = useState('')
  const [subdomainEdited, setSubdomainEdited] = useState(false)
  const [name, setName] = useState('')
  const [role, setRole] = useState('board')
  const [email, setEmail] = useState('')
  const [website, setWebsite] = useState('') // honeypot
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [topError, setTopError] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<string[]>([])

  const onMasjidNameChange = (value: string) => {
    setMasjidName(value)
    if (!subdomainEdited) {
      setSubdomain(slugifyMasjidName(value))
    }
  }

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setErrors({})
    setTopError(null)
    setSuggestions([])

    const [firstName, ...rest] = name.trim().split(/\s+/)
    const lastName = rest.join(' ')

    try {
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          masjidName: masjidName.trim(),
          subdomain: subdomain.trim().toLowerCase(),
          firstName: firstName ?? '',
          lastName,
          role,
          email: email.trim().toLowerCase(),
          migrationSource: migration,
          website,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        router.push(`/get-started/check-email?email=${encodeURIComponent(data.email ?? email)}`)
        return
      }

      const data = (await res.json().catch(() => ({}))) as {
        error?: string
        message?: string
        fields?: FieldErrors
        suggestions?: string[]
      }

      if (res.status === 400 && data.fields) {
        setErrors(data.fields)
      } else if (res.status === 409 && data.error === 'slug-taken') {
        setErrors({ subdomain: data.message ?? 'That subdomain is taken.' })
        setSuggestions(data.suggestions ?? [])
      } else if (res.status === 409 && data.error === 'email-taken') {
        setErrors({ email: data.message ?? 'An account with that email already exists.' })
      } else if (res.status === 429) {
        setTopError(data.message ?? 'Too many signup attempts. Please try again later.')
      } else {
        setTopError(data.message ?? 'Something went wrong. Please try again.')
      }
    } catch {
      setTopError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const pickSuggestion = (s: string) => {
    setSubdomain(s)
    setSubdomainEdited(true)
    setSuggestions([])
    setErrors((prev) => ({ ...prev, subdomain: undefined }))
  }

  return (
    <MarketingShell current="/get-started">
      <section style={{ paddingTop: 80, paddingBottom: 64, background: 'linear-gradient(180deg, var(--om-bg-cream), white)' }}>
        <div className="om-narrow" style={{ textAlign: 'center' }}>
          <p className="om-eyebrow">Get started</p>
          <h1 className="om-h1" style={{ fontSize: 'clamp(2.25rem, 4vw, 3.5rem)', marginBottom: 20 }}>
            Five minutes from now, your masjid{' '}
            <em style={{ fontStyle: 'italic', color: 'var(--om-accent-deep)' }}>has a website.</em>
          </h1>
          <p className="om-lede" style={{ maxWidth: 640, margin: '0 auto' }}>
            Use your own domain — <code>yourmasjid.org</code> — or start free on a{' '}
            <code>.openmasjid.app</code> subdomain. Either way, skin it with your colors and start
            adding content today. Switch to a custom domain whenever you're ready.
          </p>
        </div>
      </section>

      <section style={{ paddingBottom: 96 }}>
        <div className="om-narrow">
          <div className="om-signup-card">
            <form className="om-signup-form" onSubmit={onSubmit} noValidate>
              {topError && (
                <div role="alert" style={{ background: '#fef2f2', color: '#991b1b', padding: 12, borderRadius: 8, marginBottom: 8 }}>
                  {topError}
                </div>
              )}

              <label className="om-field">
                <span className="om-field-label">Masjid name</span>
                <input
                  type="text"
                  value={masjidName}
                  onChange={(e) => onMasjidNameChange(e.target.value)}
                  placeholder="e.g. Masjid Al-Noor"
                  aria-invalid={!!errors.masjidName}
                />
                {errors.masjidName && <span className="om-field-error">{errors.masjidName}</span>}
              </label>

              <label className="om-field">
                <span className="om-field-label">
                  Starter subdomain <span className="om-field-optional">(you can move to your own domain any time)</span>
                </span>
                <div className="om-subdomain-input">
                  <input
                    type="text"
                    value={subdomain}
                    onChange={(e) => { setSubdomain(e.target.value); setSubdomainEdited(true) }}
                    placeholder="alnoor"
                    aria-invalid={!!errors.subdomain}
                  />
                  <span>.openmasjid.app</span>
                </div>
                {errors.subdomain && <span className="om-field-error">{errors.subdomain}</span>}
                {suggestions.length > 0 && (
                  <div className="om-field-hint" style={{ marginTop: 8 }}>
                    Try one of these:{' '}
                    {suggestions.map((s, i) => (
                      <span key={s}>
                        <button
                          type="button"
                          onClick={() => pickSuggestion(s)}
                          style={{ textDecoration: 'underline', background: 'none', border: 0, padding: 0, cursor: 'pointer', color: 'var(--om-accent-deep)' }}
                        >
                          {s}
                        </button>
                        {i < suggestions.length - 1 ? ', ' : ''}
                      </span>
                    ))}
                  </div>
                )}
                <span className="om-field-hint">
                  Already own a domain? Add it from settings after signup — we'll handle DNS and SSL.
                </span>
              </label>

              <div className="om-field-row">
                <label className="om-field">
                  <span className="om-field-label">Your name</span>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Br. Yusuf Khan"
                    aria-invalid={!!errors.firstName}
                  />
                  {errors.firstName && <span className="om-field-error">{errors.firstName}</span>}
                </label>
                <label className="om-field">
                  <span className="om-field-label">Your role</span>
                  <select value={role} onChange={(e) => setRole(e.target.value)}>
                    <option value="board">Board member</option>
                    <option value="imam">Imam</option>
                    <option value="volunteer">Volunteer / IT</option>
                    <option value="other">Other</option>
                  </select>
                </label>
              </div>

              <label className="om-field">
                <span className="om-field-label">Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@yourmasjid.org"
                  aria-invalid={!!errors.email}
                />
                {errors.email && <span className="om-field-error">{errors.email}</span>}
              </label>

              {/* Honeypot — bots fill this; real users never see it. */}
              <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }}>
                <label>
                  Website
                  <input
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                  />
                </label>
              </div>

              <div className="om-field">
                <span className="om-field-label">
                  Are you migrating? <span className="om-field-optional">(optional)</span>
                </span>
                <div className="om-radio-row">
                  {MIGRATION_OPTIONS.map((opt) => (
                    <button
                      type="button"
                      key={opt}
                      className={`om-radio ${migration === opt ? 'is-active' : ''}`}
                      onClick={() => setMigration(opt)}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="om-btn om-btn-primary om-btn-lg"
                style={{ width: '100%', padding: '16px', opacity: submitting ? 0.6 : 1 }}
              >
                {submitting ? 'Creating your masjid…' : <>Create my masjid&apos;s site <ArrowRight /></>}
              </button>
            </form>

            <ul className="om-signup-trust">
              <li><Check width={18} height={18} /> Free 14-day trial — no card required</li>
              <li><Check width={18} height={18} /> Free WordPress migration on Hosted</li>
              <li><Check width={18} height={18} /> MIT-licensed — self-host any time</li>
              <li><Check width={18} height={18} /> Cancel any time, full data export</li>
            </ul>
          </div>
        </div>
      </section>
    </MarketingShell>
  )
}
