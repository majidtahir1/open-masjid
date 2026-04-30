import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Geist } from 'next/font/google'

import '../globals.css'
import './marketing.css'
import { fraunces, inter, amiri } from '@/lib/fonts'
import { cn } from '@/lib/utils'

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' })

export const metadata: Metadata = {
  title: 'OpenMasjid — Modern websites for masajid. Open-source.',
  description:
    "The masjid website platform that's secure, beautifully designed, and yours to keep. Hosted from $49/mo, or self-host free. Open-source.",
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
