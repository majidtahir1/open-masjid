import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import './globals.css'
import { fraunces, inter, amiri } from '@/lib/fonts'
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: 'OpenMasjid Platform',
  description: 'Multi-tenant masjid website platform',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={cn(fraunces.variable, inter.variable, amiri.variable, "font-sans", geist.variable)}
    >
      <body className="font-body bg-bg text-fg2 antialiased">{children}</body>
    </html>
  )
}
