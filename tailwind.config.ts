import type { Config } from 'tailwindcss'

/**
 * OpenMasjid Tailwind config.
 *
 * All colors, radii, shadows, and font families reference CSS custom
 * properties defined in src/app/globals.css. This is what enables per-tenant
 * skinning: middleware injects overrides for --brand, --secondary, --accent,
 * etc. at the top of the document, and every Tailwind utility that consumes
 * those tokens updates automatically without rebuilding CSS.
 */
const config: Config = {
  content: [
    './src/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // -------- Semantic tokens (tenant-overridable) --------
        brand: {
          DEFAULT: 'var(--brand)',
          hover: 'var(--brand-hover)',
          press: 'var(--brand-press)',
          soft: 'var(--brand-soft)',
          ink: 'var(--brand-ink)',
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          soft: 'var(--secondary-soft)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          soft: 'var(--accent-soft)',
        },

        // Surfaces / backgrounds
        bg: {
          DEFAULT: 'var(--bg)',
          alt: 'var(--bg-alt)',
          sand: 'var(--bg-sand)',
          ink: 'var(--bg-ink)',
        },

        // Foregrounds / text
        fg1: 'var(--fg1)',
        fg2: 'var(--fg2)',
        fg3: 'var(--fg3)',
        fg4: 'var(--fg4)',
        'fg-inverse': 'var(--fg-inverse)',

        // Borders
        border: {
          DEFAULT: 'var(--border)',
          strong: 'var(--border-strong)',
          teal: 'var(--border-teal)',
          navy: 'var(--border-navy)',
        },

        // Semantic status
        success: 'var(--icp-success)',
        warning: 'var(--icp-warning)',
        danger: 'var(--icp-danger)',
        info: 'var(--icp-info)',

        // Named brand tones (fixed values — these survive tenant overrides
        // because they point at the raw palette scales, not the semantic slots)
        cream: 'var(--icp-cream)',
        night: {
          500: 'var(--icp-night-500)',
          700: 'var(--icp-night-700)',
        },

        // -------- Full color scales --------
        navy: {
          50:  'var(--icp-navy-50)',
          100: 'var(--icp-navy-100)',
          200: 'var(--icp-navy-200)',
          300: 'var(--icp-navy-300)',
          500: 'var(--icp-navy-500)',
          700: 'var(--icp-navy-700)',
          800: 'var(--icp-navy-800)',
          900: 'var(--icp-navy-900)',
        },
        teal: {
          50:  'var(--icp-teal-50)',
          100: 'var(--icp-teal-100)',
          200: 'var(--icp-teal-200)',
          300: 'var(--icp-teal-300)',
          400: 'var(--icp-teal-400)',
          500: 'var(--icp-teal-500)',
          600: 'var(--icp-teal-600)',
          700: 'var(--icp-teal-700)',
          800: 'var(--icp-teal-800)',
          900: 'var(--icp-teal-900)',
        },
        gray: {
          50:  'var(--icp-gray-50)',
          100: 'var(--icp-gray-100)',
          200: 'var(--icp-gray-200)',
          300: 'var(--icp-gray-300)',
          400: 'var(--icp-gray-400)',
          500: 'var(--icp-gray-500)',
          600: 'var(--icp-gray-600)',
          700: 'var(--icp-gray-700)',
          800: 'var(--icp-gray-800)',
          900: 'var(--icp-gray-900)',
        },
        gold: {
          50:  'var(--icp-gold-50)',
          100: 'var(--icp-gold-100)',
          300: 'var(--icp-gold-300)',
          500: 'var(--icp-gold-500)',
          700: 'var(--icp-gold-700)',
        },
      },

      // -------- Spacing (design-system scale) --------
      // Design-system-specific steps. Tailwind's default spacing scale remains
      // available; these add the exact pixel values used by the ICP tokens.
      spacing: {
        'sp-0':  'var(--sp-0)',
        'sp-1':  'var(--sp-1)',
        'sp-2':  'var(--sp-2)',
        'sp-3':  'var(--sp-3)',
        'sp-4':  'var(--sp-4)',
        'sp-5':  'var(--sp-5)',
        'sp-6':  'var(--sp-6)',
        'sp-8':  'var(--sp-8)',
        'sp-10': 'var(--sp-10)',
        'sp-12': 'var(--sp-12)',
        'sp-16': 'var(--sp-16)',
        'sp-20': 'var(--sp-20)',
        'sp-24': 'var(--sp-24)',
        'sp-32': 'var(--sp-32)',
      },

      // -------- Radii --------
      borderRadius: {
        'r-xs':   'var(--r-xs)',
        'r-sm':   'var(--r-sm)',
        'r-md':   'var(--r-md)',
        'r-lg':   'var(--r-lg)',
        'r-xl':   'var(--r-xl)',
        'r-2xl':  'var(--r-2xl)',
        'r-pill': 'var(--r-pill)',
        'r-arch': 'var(--r-arch)',
      },

      // -------- Shadows --------
      boxShadow: {
        'sh-xs':    'var(--sh-xs)',
        'sh-sm':    'var(--sh-sm)',
        'sh-md':    'var(--sh-md)',
        'sh-lg':    'var(--sh-lg)',
        'sh-xl':    'var(--sh-xl)',
        'sh-inset': 'var(--sh-inset)',
      },

      // -------- Fonts --------
      fontFamily: {
        display: 'var(--font-display)',
        body:    'var(--font-body)',
        arabic:  'var(--font-arabic)',
        mono:    'var(--font-mono)',
      },

      // -------- Font sizes (tokens from CSS vars) --------
      fontSize: {
        'fs-xs':   'var(--fs-xs)',
        'fs-sm':   'var(--fs-sm)',
        'fs-base': 'var(--fs-base)',
        'fs-md':   'var(--fs-md)',
        'fs-lg':   'var(--fs-lg)',
        'fs-xl':   'var(--fs-xl)',
        'fs-2xl':  'var(--fs-2xl)',
        'fs-3xl':  'var(--fs-3xl)',
        'fs-4xl':  'var(--fs-4xl)',
        'fs-5xl':  'var(--fs-5xl)',
      },

      // -------- Line height / tracking --------
      lineHeight: {
        tight:   'var(--lh-tight)',
        snug:    'var(--lh-snug)',
        normal:  'var(--lh-normal)',
        relaxed: 'var(--lh-relaxed)',
      },
      letterSpacing: {
        tight:  'var(--tracking-tight)',
        normal: 'var(--tracking-normal)',
        wide:   'var(--tracking-wide)',
        caps:   'var(--tracking-caps)',
      },

      // -------- Motion --------
      transitionDuration: {
        fast: 'var(--dur-fast)',
        base: 'var(--dur-base)',
        slow: 'var(--dur-slow)',
      },
      transitionTimingFunction: {
        out:      'var(--ease-out)',
        'in-out': 'var(--ease-in-out)',
      },

      // -------- Layout --------
      maxWidth: {
        page:    '1200px',
        reading: '720px',
      },
    },
  },
  plugins: [],
}

export default config
