import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Geist } from 'next/font/google'

import '../globals.css'
import './marketing.css'
import { fraunces, inter, amiri } from '@/lib/fonts'
import { cn } from '@/lib/utils'

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' })

export const metadata: Metadata = {
  metadataBase: new URL('https://openmasjid.app'),
  title: 'OpenMasjid — Modern websites for masajid. Open-source.',
  description:
    "The masjid website platform that's secure, beautifully designed, and yours to keep. Hosted from $49/mo, or self-host free. Open-source.",
  icons: { icon: '/brand/openmasjid-favicon.svg' },
  openGraph: {
    siteName: 'OpenMasjid',
    type: 'website',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'OpenMasjid — A modern website platform built for masajid' }],
  },
  twitter: {
    card: 'summary_large_image',
  },
}

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={cn(fraunces.variable, inter.variable, amiri.variable, 'font-sans', geist.variable)}
    >
      <body className="font-body bg-bg text-fg2 antialiased">{children}</body>
    </html>
  )
}
