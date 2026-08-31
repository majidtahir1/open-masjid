/**
 * Slim Arabic band rendered directly beneath the sticky header (above the
 * PrayerStrip) when the tenant has configured `branding.headerArabicLine`.
 *
 * Server component — the layout passes the raw (possibly missing) value down
 * and this renders nothing when it's blank, so tenants without the field are
 * unaffected.
 */
export default function HeaderArabicBand({ text }: { text?: string | null }) {
  const value = typeof text === 'string' ? text.trim() : ''
  if (!value) return null

  return (
    <div className="border-b border-border bg-brand-soft">
      <p
        dir="rtl"
        lang="ar"
        className="m-0 mx-auto max-w-page px-6 py-2.5 text-center font-arabic text-[22px] leading-[1.9] text-[var(--accent-strong)]"
      >
        {value}
      </p>
    </div>
  )
}
