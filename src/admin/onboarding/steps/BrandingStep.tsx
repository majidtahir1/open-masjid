'use client'

import { useMemo, useRef, useState, type CSSProperties } from 'react'
import { ExternalLink, Lightbulb, Upload, X } from 'lucide-react'
import { HINTS } from '@/lib/onboardingHints'
import { contrastRatio } from '@/lib/contrast'

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type LogoRef = {
  id: number | string
  url?: string
  filename?: string
  filesize?: number
} | null

export type BrandingInitial = {
  logo?: LogoRef
  favicon?: { id: number | string; url?: string; filename?: string; filesize?: number } | null
  primaryColor?: string
  secondaryColor?: string
  accentColor?: string
  displayFont?: string
}

type Props = {
  initial: BrandingInitial
  tenantName: string
  publicUrl: string
  onClose: () => void
  onSaved: () => void
  onAdvance?: () => void
  mode?: 'modal' | 'standalone'
  markCompleteOnSave?: boolean
}

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const DEFAULT_PRIMARY = '#0F1E4A'
const DEFAULT_SECONDARY = '#28A0B4'
const DEFAULT_ACCENT = '#F0C88C'
const DEFAULT_FONT = 'Fraunces'

const FONT_OPTIONS: Array<{ value: string; label: string; cssStack: string }> = [
  {
    value: 'Fraunces',
    label: 'FRAUNCES',
    cssStack: '"Fraunces", "Times New Roman", serif',
  },
  {
    value: 'Playfair Display',
    label: 'PLAYFAIR DISPLAY',
    cssStack: '"Playfair Display", "Times New Roman", serif',
  },
  {
    value: 'DM Serif Display',
    label: 'DM SERIF DISPLAY',
    cssStack: '"DM Serif Display", "Times New Roman", serif',
  },
  {
    value: 'IBM Plex Sans',
    label: 'IBM PLEX SANS',
    cssStack: '"IBM Plex Sans", "Helvetica Neue", sans-serif',
  },
]

/** Six pre-rolled alt swatches per role. Curated, not generated. */
const ALT_SWATCHES: Record<'primary' | 'secondary' | 'accent', string[]> = {
  primary: ['#0F1E4A', '#1B3A6B', '#0E5C4A', '#3B2C5F', '#5B1F2D', '#1F2937'],
  secondary: ['#28A0B4', '#0EA5E9', '#0F766E', '#7C3AED', '#DB2777', '#65A30D'],
  accent: ['#F0C88C', '#FACC15', '#F97316', '#FB7185', '#A78BFA', '#34D399'],
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function isValidHex(s: string): boolean {
  return /^#?[0-9a-fA-F]{6}$/.test(s.trim()) || /^#?[0-9a-fA-F]{3}$/.test(s.trim())
}

function ensureHash(s: string): string {
  const t = s.trim()
  if (!t) return t
  return t.startsWith('#') ? t : `#${t}`
}

/* ------------------------------------------------------------------ */
/* Subcomponents                                                       */
/* ------------------------------------------------------------------ */

function ContrastChip({
  bg,
  fg,
  inverted,
}: {
  bg: string
  fg: string
  inverted?: boolean
}) {
  const ratio = useMemo(() => contrastRatio(bg, fg), [bg, fg])
  const display = ratio.toFixed(1)
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '3px 8px',
        borderRadius: 'var(--r-pill)',
        fontFamily: 'var(--font-body)',
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '0.02em',
        background: inverted ? bg : 'var(--bg-alt)',
        color: inverted ? '#fff' : 'var(--fg2)',
        border: inverted ? 'none' : '1px solid var(--border)',
      }}
    >
      <span style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic' }}>Aa</span>
      {display}
    </span>
  )
}

function ColorCard({
  label,
  caption,
  role,
  value,
  onChange,
}: {
  label: string
  caption: string
  role: 'primary' | 'secondary' | 'accent'
  value: string
  onChange: (next: string) => void
}) {
  const hexLooksValid = isValidHex(value)
  const safe = hexLooksValid ? ensureHash(value) : '#888888'

  return (
    <div
      style={{
        background: 'var(--bg)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-md)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          height: 56,
          background: safe,
          borderBottom: '1px solid var(--border)',
        }}
      />
      <div style={{ padding: 'var(--sp-4)', display: 'grid', gap: 'var(--sp-3)' }}>
        <div
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--fg3)',
          }}
        >
          {label}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-sm)',
            padding: '6px 10px',
            background: 'var(--bg-alt)',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
              color: 'var(--fg3)',
            }}
          >
            #
          </span>
          <input
            type="text"
            value={value.replace(/^#/, '')}
            onChange={(e) => onChange(ensureHash(e.target.value))}
            spellCheck={false}
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
              color: 'var(--fg1)',
              padding: 0,
              minWidth: 0,
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <ContrastChip bg="#ffffff" fg={safe} />
          <ContrastChip bg={safe} fg="#ffffff" inverted />
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {ALT_SWATCHES[role].map((alt) => (
            <button
              key={alt}
              type="button"
              onClick={() => onChange(alt)}
              aria-label={`Use ${alt}`}
              style={{
                width: 22,
                height: 22,
                borderRadius: 'var(--r-sm)',
                border:
                  alt.toLowerCase() === safe.toLowerCase()
                    ? '2px solid var(--fg1)'
                    : '1px solid var(--border)',
                background: alt,
                cursor: 'pointer',
                padding: 0,
              }}
            />
          ))}
        </div>
        <p
          style={{
            margin: 0,
            fontFamily: 'var(--font-body)',
            fontSize: 12,
            color: 'var(--fg3)',
            lineHeight: 1.45,
          }}
        >
          {caption}
        </p>
      </div>
    </div>
  )
}

function FontCard({
  fontValue,
  label,
  cssStack,
  active,
  onSelect,
  sampleName,
}: {
  fontValue: string
  label: string
  cssStack: string
  active: boolean
  onSelect: () => void
  sampleName: string
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        textAlign: 'left',
        cursor: 'pointer',
        background: active ? 'var(--bg-alt)' : 'var(--bg)',
        border: active ? '2px solid var(--brand)' : '1px solid var(--border)',
        borderRadius: 'var(--r-md)',
        padding: 'var(--sp-5)',
        display: 'grid',
        gap: 'var(--sp-3)',
        // keep total padding consistent across active/inactive
        margin: active ? 0 : 1,
      }}
      aria-pressed={active}
      aria-label={`Use ${fontValue}`}
    >
      <span
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.14em',
          color: 'var(--fg3)',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: cssStack,
          fontSize: 28,
          lineHeight: 1.15,
          color: 'var(--fg1)',
        }}
      >
        {sampleName}
      </span>
    </button>
  )
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

export function BrandingStep({
  initial,
  tenantName,
  publicUrl,
  onClose,
  onSaved,
  onAdvance,
  mode = 'modal',
  markCompleteOnSave = true,
}: Props) {
  const [logo, setLogo] = useState<LogoRef>(initial.logo ?? null)
  const [favicon, setFavicon] = useState<LogoRef>(initial.favicon ?? null)
  const [faviconOpen, setFaviconOpen] = useState<boolean>(!!initial.favicon)
  const [uploading, setUploading] = useState(false)
  const [uploadingFavicon, setUploadingFavicon] = useState(false)
  const [primary, setPrimary] = useState<string>(initial.primaryColor || DEFAULT_PRIMARY)
  const [secondary, setSecondary] = useState<string>(
    initial.secondaryColor || DEFAULT_SECONDARY,
  )
  const [accent, setAccent] = useState<string>(initial.accentColor || DEFAULT_ACCENT)
  const [font, setFont] = useState<string>(initial.displayFont || DEFAULT_FONT)
  const [saving, setSaving] = useState<'draft' | 'continue' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const faviconInputRef = useRef<HTMLInputElement | null>(null)

  const onPickFile = () => fileInputRef.current?.click()
  const onPickFavicon = () => faviconInputRef.current?.click()

  const handleFile = async (file: File) => {
    setError(null)
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      // Pre-fill a sensible default alt text so the upload validates even if
      // the user never opens the Media doc. Owners can refine it later.
      fd.append('alt', `${tenantName} logo`)
      const res = await fetch('/api/media', { method: 'POST', body: fd })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(text || `Upload failed (${res.status})`)
      }
      const json = (await res.json()) as {
        doc?: { id: number | string; url?: string; filename?: string; filesize?: number }
        id?: number | string
        url?: string
        filename?: string
        filesize?: number
      }
      const doc = json.doc ?? {
        id: json.id as number | string,
        url: json.url,
        filename: json.filename,
        filesize: json.filesize,
      }
      if (doc.id == null) throw new Error('Upload returned no id')
      setLogo({
        id: doc.id,
        url: doc.url,
        filename: doc.filename,
        filesize: doc.filesize,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleFaviconFile = async (file: File) => {
    setError(null)
    setUploadingFavicon(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('alt', `${tenantName} favicon`)
      const res = await fetch('/api/media', { method: 'POST', body: fd })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(text || `Upload failed (${res.status})`)
      }
      const json = (await res.json()) as {
        doc?: { id: number | string; url?: string; filename?: string; filesize?: number }
        id?: number | string
        url?: string
        filename?: string
        filesize?: number
      }
      const doc = json.doc ?? {
        id: json.id as number | string,
        url: json.url,
        filename: json.filename,
        filesize: json.filesize,
      }
      if (doc.id == null) throw new Error('Upload returned no id')
      setFavicon({
        id: doc.id,
        url: doc.url,
        filename: doc.filename,
        filesize: doc.filesize,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploadingFavicon(false)
    }
  }

  const submit = async (kind: 'draft' | 'continue') => {
    const markComplete = kind === 'continue'
    setError(null)
    setSaving(kind)
    try {
      const res = await fetch('/admin/api/onboarding/branding', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          logoMediaId: logo?.id ?? null,
          faviconMediaId: favicon?.id ?? null,
          primaryColor: primary,
          secondaryColor: secondary,
          accentColor: accent,
          displayFont: font,
          markComplete,
        }),
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(text || `Save failed (${res.status})`)
      }
      if (kind === 'continue' && onAdvance) {
        onAdvance()
      } else {
        onSaved()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(null)
    }
  }

  /* ----- Layout ----- */

  return (
    <div
      style={{
        background: 'var(--bg)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-lg)',
        boxShadow: 'var(--sh-sm)',
        overflow: 'hidden',
        fontFamily: 'var(--font-body)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* ---------- Sticky header + progress bar ---------- */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          background: 'var(--bg)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div
          style={{
            padding: 'var(--sp-6) var(--sp-8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 'var(--sp-6)',
          }}
        >
          <div>
            {mode === 'modal' && (
              <p
                style={{
                  margin: 0,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.14em',
                  color: 'var(--fg3)',
                  textTransform: 'uppercase',
                }}
              >
                Step 01 of 06
              </p>
            )}
            <h2
              style={{
                margin: 0,
                fontFamily: 'var(--font-display)',
                fontWeight: 500,
                fontSize: 28,
                lineHeight: 1.15,
                color: 'var(--fg1)',
              }}
            >
              Branding
            </h2>
          </div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--sp-3)',
            }}
          >
            <HeaderSaveButton saving={saving} onSave={() => void submit(mode === 'modal' ? 'draft' : 'continue')} />
            {mode === 'modal' && (
              <button
                type="button"
                aria-label="Close"
                onClick={onClose}
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: 6,
                  borderRadius: 'var(--r-sm)',
                  color: 'var(--fg2)',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={20} strokeWidth={1.75} />
              </button>
            )}
          </div>
        </div>

        {/* ---------- 6-segment progress bar (wizard only) ---------- */}
        {mode === 'modal' && (
          <div
            style={{
              display: 'flex',
              gap: 4,
              padding: '0 var(--sp-8)',
              background: 'var(--bg)',
            }}
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: 4,
                  background: i === 0 ? 'var(--brand)' : 'var(--icp-gray-100)',
                  borderRadius: 2,
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* ---------- Body ---------- */}
      <div
        style={{
          padding: 'var(--sp-10) var(--sp-12)',
          display: 'grid',
          gap: 'var(--sp-12)',
        }}
      >
        {/* Section header */}
        <div>
          <p
            style={{
              margin: 0,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.14em',
              color: 'var(--fg3)',
              textTransform: 'uppercase',
            }}
          >
            {mode === 'modal' ? 'Step 01 of 06 · Branding' : 'Branding'}
          </p>
          <h1
            style={{
              margin: 'var(--sp-3) 0 var(--sp-3) 0',
              fontFamily: 'var(--font-display)',
              fontWeight: 500,
              fontSize: 'clamp(2rem, 4vw, 2.75rem)',
              lineHeight: 1.1,
              color: 'var(--fg1)',
            }}
          >
            Make it{' '}
            <em style={{ fontStyle: 'italic', color: 'var(--brand)' }}>
              look like your masjid.
            </em>
          </h1>
          <p
            style={{
              margin: 0,
              maxWidth: 640,
              fontFamily: 'var(--font-body)',
              fontSize: 'var(--fs-sm)',
              color: 'var(--fg2)',
              lineHeight: 1.55,
            }}
          >
            Upload your logo, pick three colors, choose a display font. The preview on
            the right reflects every change in real time.
          </p>
        </div>

        {/* ----- Logo block ----- */}
        <section style={{ display: 'grid', gap: 'var(--sp-4)' }}>
          <h3
            style={{
              margin: 0,
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize: 18,
              color: 'var(--fg1)',
            }}
          >
            Logo
          </h3>
          <p
            style={{
              margin: 0,
              fontFamily: 'var(--font-body)',
              fontSize: 14,
              color: 'var(--fg3)',
              lineHeight: 1.55,
              maxWidth: 640,
            }}
          >
            SVG, PNG, or JPG. We&apos;ll resize for every screen and auto-generate a
            favicon. Square crops work best — we&apos;ll center any aspect ratio.
          </p>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--sp-4)',
              alignItems: 'stretch',
              marginTop: 'var(--sp-2)',
            }}
          >
            {/* Drop zone */}
            <div
              style={{
                width: '100%',
                border: '1.5px dashed var(--border-strong, var(--border))',
                borderRadius: 'var(--r-md)',
                padding: 'var(--sp-6) var(--sp-8)',
                background: 'var(--bg-alt)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--sp-6)',
                flexWrap: 'wrap',
              }}
            >
              <button
                type="button"
                onClick={onPickFile}
                disabled={uploading}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--r-md)',
                  padding: '10px 16px',
                  fontFamily: 'var(--font-body)',
                  fontSize: 14,
                  fontWeight: 600,
                  color: 'var(--fg1)',
                  cursor: uploading ? 'wait' : 'pointer',
                  opacity: uploading ? 0.6 : 1,
                }}
              >
                <Upload size={16} strokeWidth={1.75} />
                {uploading ? 'Uploading...' : 'Replace logo'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void handleFile(f)
                  e.target.value = ''
                }}
              />
              <div style={{ display: 'grid', gap: 4, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: 'var(--fg2)' }}>
                  {logo?.filename ?? 'No logo uploaded yet'}
                  {logo?.filesize ? ` · ${formatBytes(logo.filesize)}` : ''}
                </div>
                <div style={{ fontSize: 12, color: 'var(--fg3)' }}>
                  {faviconOpen ? (
                    <button
                      type="button"
                      onClick={() => setFaviconOpen(false)}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        color: 'var(--brand)',
                        fontWeight: 600,
                        fontSize: 12,
                        cursor: 'pointer',
                        fontFamily: 'var(--font-body)',
                      }}
                    >
                      Hide favicon override ←
                    </button>
                  ) : (
                    <>
                      Favicon will auto-generate from this.{' '}
                      <button
                        type="button"
                        onClick={() => setFaviconOpen(true)}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          color: 'var(--brand)',
                          fontWeight: 600,
                          fontSize: 12,
                          cursor: 'pointer',
                          fontFamily: 'var(--font-body)',
                        }}
                      >
                        Override →
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Logo preview tile — full width, below the drop zone */}
            <div
              style={{
                width: '100%',
                height: 240,
                borderRadius: 'var(--r-md)',
                background: 'var(--bg-alt)',
                border: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 32,
                overflow: 'hidden',
              }}
            >
              {logo?.url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={logo.url}
                  alt="Current logo"
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                />
              ) : (
                <div
                  style={{
                    width: 120,
                    height: 120,
                    borderRadius: 'var(--r-sm)',
                    background:
                      'linear-gradient(180deg, var(--icp-gray-100), var(--icp-gray-200))',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--fg3)',
                    fontFamily: 'var(--font-display)',
                    fontSize: 56,
                    fontWeight: 500,
                  }}
                >
                  ﷲ
                </div>
              )}
            </div>

            {/* Hidden favicon file input */}
            <input
              ref={faviconInputRef}
              type="file"
              accept="image/*,.ico"
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void handleFaviconFile(f)
                e.target.value = ''
              }}
            />

            {/* Favicon override section — collapsible */}
            {faviconOpen && (
              <div
                style={{
                  borderTop: '1px solid var(--border)',
                  paddingTop: 'var(--sp-4)',
                  display: 'flex',
                  gap: 'var(--sp-4)',
                  alignItems: 'center',
                }}
              >
                {/* Favicon preview tile */}
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 'var(--r-md)',
                    background: 'var(--bg-alt)',
                    border: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 8,
                    flexShrink: 0,
                    overflow: 'hidden',
                  }}
                >
                  {favicon?.url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={favicon.url}
                      alt="Current favicon"
                      style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 'var(--r-sm)',
                        background:
                          'linear-gradient(180deg, var(--icp-gray-100), var(--icp-gray-200))',
                      }}
                    />
                  )}
                </div>

                {/* Favicon drop zone */}
                <div
                  style={{
                    flex: 1,
                    border: '1.5px dashed var(--border-strong, var(--border))',
                    borderRadius: 'var(--r-md)',
                    padding: 'var(--sp-4) var(--sp-6)',
                    background: 'var(--bg-alt)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--sp-4)',
                    flexWrap: 'wrap',
                  }}
                >
                  <button
                    type="button"
                    onClick={onPickFavicon}
                    disabled={uploadingFavicon}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      background: 'var(--bg)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--r-md)',
                      padding: '8px 12px',
                      fontFamily: 'var(--font-body)',
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'var(--fg1)',
                      cursor: uploadingFavicon ? 'wait' : 'pointer',
                      opacity: uploadingFavicon ? 0.6 : 1,
                    }}
                  >
                    <Upload size={14} strokeWidth={1.75} />
                    {uploadingFavicon ? 'Uploading...' : 'Upload favicon'}
                  </button>
                  <div style={{ display: 'grid', gap: 3, minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13, color: 'var(--fg2)' }}>
                      {favicon?.filename ?? 'No favicon uploaded yet'}
                      {favicon?.filesize ? ` · ${formatBytes(favicon.filesize)}` : ''}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--fg3)' }}>
                      Square 32×32 or 64×64 PNG/ICO. Defaults to your logo if blank.
                    </div>
                  </div>
                  {favicon && (
                    <button
                      type="button"
                      onClick={() => setFavicon(null)}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        fontFamily: 'var(--font-body)',
                        fontSize: 12,
                        color: 'var(--fg3)',
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                    >
                      Remove favicon
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ----- Brand colors block ----- */}
        <section style={{ display: 'grid', gap: 'var(--sp-4)' }}>
          <h3
            style={{
              margin: 0,
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize: 18,
              color: 'var(--fg1)',
            }}
          >
            Brand colors
          </h3>
          <p
            style={{
              margin: 0,
              fontFamily: 'var(--font-body)',
              fontSize: 14,
              color: 'var(--fg3)',
              lineHeight: 1.55,
              maxWidth: 640,
            }}
          >
            Pick three. We&apos;ll derive the full palette — hover states, soft tints,
            contrast pairings — automatically.
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 'var(--sp-4)',
              marginTop: 'var(--sp-2)',
            }}
          >
            <ColorCard
              label="Brand"
              caption="Primary buttons, links, header"
              role="primary"
              value={primary}
              onChange={setPrimary}
            />
            <ColorCard
              label="Secondary"
              caption="Donate strip, accents"
              role="secondary"
              value={secondary}
              onChange={setSecondary}
            />
            <ColorCard
              label="Accent"
              caption="Event pills, highlights"
              role="accent"
              value={accent}
              onChange={setAccent}
            />
          </div>
        </section>

        {/* ----- Display font block ----- */}
        <section style={{ display: 'grid', gap: 'var(--sp-4)' }}>
          <h3
            style={{
              margin: 0,
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize: 18,
              color: 'var(--fg1)',
            }}
          >
            Display font
          </h3>
          <p
            style={{
              margin: 0,
              fontFamily: 'var(--font-body)',
              fontSize: 14,
              color: 'var(--fg3)',
              lineHeight: 1.55,
              maxWidth: 640,
            }}
          >
            Used for headings on every page. Body text is always set in Inter for
            legibility.
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 'var(--sp-4)',
              marginTop: 'var(--sp-2)',
            }}
          >
            {FONT_OPTIONS.map((f) => (
              <FontCard
                key={f.value}
                fontValue={f.value}
                label={f.label}
                cssStack={f.cssStack}
                active={font === f.value}
                onSelect={() => setFont(f.value)}
                sampleName={tenantName}
              />
            ))}
          </div>
          <a
            href="#"
            onClick={(e) => e.preventDefault()}
            style={{
              marginTop: 'var(--sp-2)',
              fontFamily: 'var(--font-body)',
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--brand)',
              justifySelf: 'start',
            }}
          >
            + Use a different Google Font
          </a>
        </section>

        {/* ----- Did you know? block ----- */}
        <section style={{ display: 'grid', gap: 'var(--sp-4)' }}>
          <h3
            style={{
              margin: 0,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize: 18,
              color: 'var(--fg1)',
            }}
          >
            <Lightbulb size={16} strokeWidth={1.75} style={{ color: 'var(--brand)' }} />
            Did you know?
          </h3>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 'var(--sp-4)',
            }}
          >
            {HINTS.branding.map((h) => (
              <div
                key={h.headline}
                style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--r-md)',
                  padding: 'var(--sp-5)',
                  display: 'grid',
                  gap: 'var(--sp-2)',
                }}
              >
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    fontFamily: 'var(--font-display)',
                    fontWeight: 600,
                    fontSize: 15,
                    color: 'var(--brand)',
                    lineHeight: 1.3,
                  }}
                >
                  <Lightbulb
                    size={14}
                    strokeWidth={1.75}
                    style={{ color: 'var(--brand)', flexShrink: 0 }}
                  />
                  <span>{h.headline}</span>
                </div>
                <p
                  style={{
                    margin: 0,
                    fontFamily: 'var(--font-body)',
                    fontSize: 14,
                    color: 'var(--fg2)',
                    lineHeight: 1.5,
                  }}
                >
                  {h.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {error && (
          <div
            role="alert"
            style={{
              padding: 'var(--sp-3) var(--sp-4)',
              borderRadius: 'var(--r-md)',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#991b1b',
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}
      </div>

      {/* ---------- Footer ---------- */}
      <div
        style={{
          padding: 'var(--sp-5) var(--sp-8)',
          background: 'var(--bg-alt)',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--sp-4)',
          flexWrap: 'wrap',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--sp-6)',
          }}
        >
          {mode === 'modal' && (
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                padding: 0,
                fontFamily: 'var(--font-body)',
                fontSize: 14,
                fontWeight: 500,
                color: 'var(--fg3)',
                cursor: 'pointer',
              }}
            >
              Skip
            </button>
          )}
          <a
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontFamily: 'var(--font-body)',
              fontSize: 14,
              fontWeight: 500,
              color: 'var(--fg2)',
            }}
          >
            <ExternalLink size={14} strokeWidth={1.75} />
            Preview
          </a>
        </div>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--sp-3)',
          }}
        >
          {mode === 'modal' && (
            <SecondaryFooterButton
              disabled={saving !== null}
              onClick={() => void submit('draft')}
            >
              {saving === 'draft' ? 'Saving...' : 'Save draft'}
            </SecondaryFooterButton>
          )}
          <PrimaryFooterButton
            disabled={saving !== null}
            onClick={() => void submit(markCompleteOnSave ? 'continue' : 'draft')}
          >
            {saving !== null && (markCompleteOnSave ? saving === 'continue' : saving === 'draft')
              ? 'Saving...'
              : markCompleteOnSave
                ? 'Save & continue →'
                : 'Save changes →'}
          </PrimaryFooterButton>
        </div>
      </div>
    </div>
  )
}

function HeaderSaveButton({
  saving,
  onSave,
}: {
  saving: 'draft' | 'continue' | null
  onSave: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const isSaving = saving !== null
  return (
    <button
      type="button"
      onClick={onSave}
      disabled={isSaving}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        background: hovered && !isSaving ? 'var(--brand-hover)' : 'var(--brand)',
        color: 'white',
        padding: '8px 16px',
        borderRadius: 'var(--r-md)',
        fontFamily: 'var(--font-body)',
        fontSize: 'var(--fs-sm)',
        fontWeight: 600,
        border: 'none',
        cursor: isSaving ? 'wait' : 'pointer',
        opacity: isSaving ? 0.6 : 1,
        transform: hovered && !isSaving ? 'translateY(-1px)' : 'translateY(0)',
        transition: 'background var(--dur-base) var(--ease-out), transform var(--dur-base) var(--ease-out)',
      }}
    >
      {isSaving ? 'Saving…' : 'Save'}
    </button>
  )
}

const baseFooterBtn: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '10px 18px',
  borderRadius: 'var(--r-md)',
  fontFamily: 'var(--font-body)',
  fontSize: 14,
  fontWeight: 600,
  lineHeight: 1,
  cursor: 'pointer',
  border: '1px solid transparent',
  transition: 'background var(--dur-base) var(--ease-out)',
}

function PrimaryFooterButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        ...baseFooterBtn,
        background: 'var(--brand)',
        color: '#fff',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {children}
    </button>
  )
}

function SecondaryFooterButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        ...baseFooterBtn,
        background: 'var(--bg)',
        color: 'var(--fg1)',
        borderColor: 'var(--border)',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {children}
    </button>
  )
}

export default BrandingStep
