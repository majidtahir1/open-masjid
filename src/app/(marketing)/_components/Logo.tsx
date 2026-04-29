type LogoProps = {
  variant?: 'arch' | 'outline' | 'stack'
  size?: number
  wordmark?: boolean
  theme?: 'light' | 'dark'
}

export function OMLogo({ variant = 'arch', size = 36, wordmark = true, theme = 'light' }: LogoProps) {
  const fg = theme === 'dark' ? '#FFFFFF' : 'var(--om-brand)'
  const accent = 'var(--om-accent)'
  const wordColor = theme === 'dark' ? '#FFFFFF' : 'var(--fg1)'

  let mark = (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <path d="M7 33 V19 C7 12.4 12.8 7 20 7 C27.2 7 33 12.4 33 19 V33 H7 Z" fill={fg} />
      <path d="M14.5 33 V20.5 C14.5 17.4 16.9 15 20 15 C23.1 15 25.5 17.4 25.5 20.5 V33 H14.5 Z" fill="white" />
      <circle cx="20" cy="3.6" r="1.5" fill={accent} />
      <path d="M20 1.5 L20 5.7 M17.9 3.6 L22.1 3.6" stroke={accent} strokeWidth="0.6" strokeLinecap="round" />
    </svg>
  )

  if (variant === 'outline') {
    mark = (
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true">
        <rect x="1" y="1" width="38" height="38" rx="9" stroke={fg} strokeWidth="1.25" opacity="0.18" />
        <path d="M11 30 V20 C11 14 15 10 20 10 C25 10 29 14 29 20 V30" stroke={fg} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M14.5 30 V20.5 C14.5 16.5 17 14 20 14 C23 14 25.5 16.5 25.5 20.5 V30" stroke={accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <circle cx="20" cy="7" r="1.5" fill={accent} />
      </svg>
    )
  } else if (variant === 'stack') {
    mark = (
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true">
        <path d="M8 32 V18 C8 12.5 13.4 8 20 8 C26.6 8 32 12.5 32 18 V32 Z" fill={fg} />
        <path d="M16 32 V19 C16 17 17.8 15.5 20 15.5 C22.2 15.5 24 17 24 19 V32 Z" fill="white" />
        <circle cx="20" cy="5" r="1.6" fill={accent} />
      </svg>
    )
  }

  if (!wordmark) return mark

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, color: wordColor }}>
      {mark}
      <span
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 500,
          fontSize: size * 0.62,
          letterSpacing: '-0.025em',
          fontVariationSettings: '"opsz" 100, "SOFT" 50',
          lineHeight: 1,
          color: wordColor,
        }}
      >
        open<span style={{ fontStyle: 'italic', color: theme === 'dark' ? 'var(--icp-teal-300)' : fg }}>masjid</span>
      </span>
    </span>
  )
}
