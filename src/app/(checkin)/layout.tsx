import type { Metadata, Viewport } from 'next'
import '../globals.css'
import { fraunces, inter } from '@/lib/fonts'
import { cn } from '@/lib/utils'
import { getCurrentTenant } from '@/lib/tenant-server'

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getCurrentTenant().catch(() => null)
  const name = (tenant as { name?: string } | null)?.name
  // The label shown under the iPad home-screen icon (Add to Home Screen).
  const title = name ? `${name} Check-in` : 'Check-in'
  return {
    title,
    manifest: '/checkin/manifest.webmanifest',
    appleWebApp: { capable: true, title, statusBarStyle: 'black-translucent' },
    icons: {
      icon: '/checkin/icon-192.png',
      apple: '/checkin/icon-180.png',
    },
  }
}

export const viewport: Viewport = {
  themeColor: '#1E7E8E',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function CheckinLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn(fraunces.variable, inter.variable)}>
      <body style={{ margin: 0, overflow: 'hidden', background: '#e7e5df' }}>{children}</body>
    </html>
  )
}
