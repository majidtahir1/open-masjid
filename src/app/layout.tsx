import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import './globals.css'
import { fraunces, inter, amiri } from '@/lib/fonts'

export const metadata: Metadata = {
  title: 'OpenMasjid Platform',
  description: 'Multi-tenant masjid website platform',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${inter.variable} ${amiri.variable}`}
    >
      <body className="font-body bg-bg text-fg2 antialiased">{children}</body>
    </html>
  )
}
