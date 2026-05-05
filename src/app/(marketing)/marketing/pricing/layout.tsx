import type { ReactNode } from 'react'

const TITLE = 'Pricing — OpenMasjid'
const DESCRIPTION =
  'Free to self-host. $49/mo hosted, with custom domain and Stripe donations included. Sadaqah scholarships available for masajid that need them.'

export const metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/pricing' },
  openGraph: { title: TITLE, description: DESCRIPTION, url: '/pricing', type: 'website' },
  twitter: { title: TITLE, description: DESCRIPTION },
}

export default function PricingLayout({ children }: { children: ReactNode }) {
  return children
}
