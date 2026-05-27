import { Fraunces, Inter, Amiri, Amiri_Quran } from 'next/font/google'

/**
 * OpenMasjid fonts, loaded via next/font/google (self-hosted, no runtime
 * request to fonts.googleapis.com in production). Each font exposes a CSS
 * variable consumed by globals.css as the first family in its stack.
 *
 * Keep the `variable` names in sync with globals.css:
 *   --font-display-loaded  → Fraunces
 *   --font-body-loaded     → Inter
 *   --font-arabic-loaded   → Amiri
 */

export const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-display-loaded',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
})

export const inter = Inter({
  subsets: ['latin'],
  variable: '--font-body-loaded',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
})

export const amiri = Amiri({
  subsets: ['arabic'],
  variable: '--font-arabic-loaded',
  display: 'swap',
  weight: ['400', '700'],
})

export const amiriQuran = Amiri_Quran({
  subsets: ['arabic'],
  variable: '--font-amiri-quran-loaded',
  display: 'swap',
  weight: '400',
})
