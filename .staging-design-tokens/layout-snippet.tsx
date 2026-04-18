// This is a REFERENCE snippet. A later agent will merge this into
// src/app/layout.tsx (the root layout created by the Next.js scaffold).
//
// Key moves:
//  1. Import ./globals.css at the top of the root layout (replaces any
//     default stylesheet the scaffold shipped with).
//  2. Import the three font objects from @/lib/fonts.
//  3. Apply their `.variable` class names on the <html> element so the
//     CSS custom properties --font-display-loaded, --font-body-loaded,
//     and --font-arabic-loaded are available everywhere.
//  4. Set a sensible default body font via className or via globals.css.
//
// Per-tenant color overrides get injected elsewhere (by middleware / a
// server component wrapping {children}) as an inline <style> block that
// redefines --brand, --secondary, --accent on :root.

import './globals.css'
import { fraunces, inter, amiri } from '@/lib/fonts'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable} ${amiri.variable}`}>
      <body className="font-body bg-bg text-fg2 antialiased">{children}</body>
    </html>
  )
}
