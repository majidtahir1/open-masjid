import type { ReactNode } from 'react'

const TITLE = 'Get started — OpenMasjid'
const DESCRIPTION =
  'Claim your masjid subdomain in five minutes. We will email you a secure setup link — no card required for the trial.'

export const metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/get-started' },
  openGraph: { title: TITLE, description: DESCRIPTION, url: '/get-started', type: 'website' },
  twitter: { title: TITLE, description: DESCRIPTION },
}

export default function GetStartedLayout({ children }: { children: ReactNode }) {
  return children
}
