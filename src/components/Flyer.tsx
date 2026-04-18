import Image from 'next/image'

export type FlyerVariant = 'default' | 'navy' | 'gold'

export interface FlyerProps {
  title: string
  subtitle?: string | null
  /** Free-form meta line, e.g. "Mondays after Isha @ Main hall". */
  meta?: string | null
  variant?: FlyerVariant
  /** Logo URL. Falls back to /brand/logo-icp.jpg if not provided. */
  logoUrl?: string | null
  /**
   * Optional background image URL. When provided, renders behind the pattern
   * with a scrim so the foreground text stays readable.
   */
  backgroundImage?: string | null
  /** Alt text for the logo. Defaults to a neutral label. */
  logoAlt?: string
  /** Optional extra class names on the outer wrapper. */
  className?: string
}

const DEFAULT_LOGO = '/brand/logo-icp.jpg'

const VARIANT_STYLES: Record<
  FlyerVariant,
  { bg: string; title: string; sub: string; meta: string; patternStroke: string; patternOpacity: number }
> = {
  default: {
    bg: 'bg-cream',
    title: 'text-navy-700',
    sub: 'text-navy-800',
    meta: 'text-navy-700',
    patternStroke: '#0F1E4A',
    patternOpacity: 0.08,
  },
  gold: {
    bg: 'bg-gradient-to-br from-gold-100 to-cream',
    title: 'text-navy-700',
    sub: 'text-navy-800',
    meta: 'text-navy-700',
    patternStroke: '#0F1E4A',
    patternOpacity: 0.08,
  },
  navy: {
    bg: 'bg-navy-700',
    title: 'text-white',
    sub: 'text-gold-300',
    meta: 'text-white',
    patternStroke: '#FFFFFF',
    patternOpacity: 0.15,
  },
}

export default function Flyer({
  title,
  subtitle,
  meta,
  variant = 'default',
  logoUrl,
  backgroundImage,
  logoAlt = 'Masjid logo',
  className = '',
}: FlyerProps) {
  const style = VARIANT_STYLES[variant]
  const patternId = `icp-flyer-pattern-${variant}`
  const logoSrc = logoUrl ?? DEFAULT_LOGO

  return (
    <div
      className={[
        'relative flex aspect-[16/9] flex-col overflow-hidden',
        'rounded-[var(--r-md)] shadow-sh-sm transition-all duration-base ease-out',
        'hover:-translate-y-[2px] hover:shadow-sh-lg',
        style.bg,
        className,
      ].join(' ')}
    >
      {backgroundImage && (
        <>
          <Image
            src={backgroundImage}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 800px"
            className="absolute inset-0 z-0 object-cover"
          />
          <div
            className="absolute inset-0 z-0"
            style={{
              background:
                variant === 'navy'
                  ? 'linear-gradient(135deg, rgba(15,30,74,0.8), rgba(15,30,74,0.6))'
                  : 'linear-gradient(135deg, rgba(240,239,232,0.85), rgba(240,239,232,0.6))',
            }}
            aria-hidden="true"
          />
        </>
      )}

      {/* 8-point star pattern */}
      <div className="pointer-events-none absolute inset-0 z-0" aria-hidden="true">
        <svg
          viewBox="0 0 800 450"
          width="100%"
          height="100%"
          preserveAspectRatio="xMidYMid slice"
        >
          <defs>
            <pattern
              id={patternId}
              x="0"
              y="0"
              width="80"
              height="80"
              patternUnits="userSpaceOnUse"
            >
              <g
                fill="none"
                stroke={style.patternStroke}
                strokeWidth="1"
                opacity={style.patternOpacity}
              >
                {/* 8-point star */}
                <polygon points="40,8 48,32 72,32 52,48 60,72 40,56 20,72 28,48 8,32 32,32" />
                <circle cx="40" cy="40" r="30" />
              </g>
            </pattern>
          </defs>
          <rect width="800" height="450" fill={`url(#${patternId})`} />
        </svg>
      </div>

      {/* Corner ornaments — navy/teal/gold geometric motif */}
      <CornerOrnament position="tl" variant={variant} />
      <CornerOrnament position="br" variant={variant} />

      {/* Logo */}
      <div className="absolute right-4 top-[14px] z-[2] h-[60px] w-[60px]">
        <Image
          src={logoSrc}
          alt={logoAlt}
          width={60}
          height={60}
          className="h-full w-full object-contain"
          unoptimized={logoSrc.startsWith('/')}
        />
      </div>

      {/* Body (centered) */}
      <div className="relative z-[2] m-auto px-[16%] text-center">
        <h3
          className={[
            'm-0 font-display font-medium leading-[1.1] tracking-tight',
            'text-[clamp(22px,3.2vw,32px)]',
            style.title,
          ].join(' ')}
          style={{ letterSpacing: '-0.01em' }}
        >
          {title}
        </h3>
        {subtitle && (
          <p
            className={[
              'm-0 mt-2 font-body text-[12px] leading-[1.45]',
              'mx-auto max-w-[85%] line-clamp-2',
              style.sub,
            ].join(' ')}
          >
            {subtitle}
          </p>
        )}
        {meta && (
          <p className={['m-0 mt-[10px] font-body text-[13px] font-bold', style.meta].join(' ')}>
            {meta}
          </p>
        )}
      </div>
    </div>
  )
}

function CornerOrnament({
  position,
  variant,
}: {
  position: 'tl' | 'br'
  variant: FlyerVariant
}) {
  // Colors from the brand: navy primary, teal secondary, gold accent. On the
  // navy-background variant we swap navy for a lighter accent so the motif
  // stays visible.
  const navyFill = variant === 'navy' ? '#FFFFFF' : '#0F1E4A'
  const tealFill = '#28A0B4'
  const goldFill = '#F0C88C'
  const baseClasses = 'pointer-events-none absolute z-[1] w-[38%]'
  const positionClasses = position === 'tl' ? 'top-0 left-0' : 'bottom-0 right-0 rotate-180'
  return (
    <svg
      className={[baseClasses, positionClasses].join(' ')}
      viewBox="0 0 180 180"
      width="180"
      height="180"
      aria-hidden="true"
    >
      <g>
        {/* Navy L-shape framing the corner */}
        <path
          d="M0 0 L180 0 L180 20 L20 20 L20 180 L0 180 Z"
          fill={navyFill}
          fillOpacity={variant === 'navy' ? 0.25 : 1}
        />
        {/* Geometric blocks */}
        <rect x="30" y="30" width="28" height="28" fill={tealFill} />
        <rect x="68" y="30" width="28" height="28" fill={goldFill} />
        <rect x="30" y="68" width="28" height="28" fill={navyFill} fillOpacity={variant === 'navy' ? 0.4 : 1} />
        <rect x="68" y="68" width="60" height="10" fill={tealFill} />
        <rect x="106" y="30" width="10" height="28" fill={goldFill} />
      </g>
    </svg>
  )
}
