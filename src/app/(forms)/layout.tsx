import type React from 'react'
import type { ReactNode } from 'react'
import { Geist } from 'next/font/google'
import { fraunces, inter, amiri } from '@/lib/fonts'
import { cn } from '@/lib/utils'
import { getCurrentTenant } from '@/lib/tenant-server'
import { mediaUrl } from '@/components/types'
import '@/app/globals.css'
import '@/styles/public-forms.css'

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' })

interface FormsLayoutProps {
  children: ReactNode
}

export default async function FormsLayout({ children }: FormsLayoutProps) {
  const tenant = await getCurrentTenant()
  const tenantName = tenant?.name ?? 'OpenMasjid'
  const logoUrl = mediaUrl(tenant?.branding?.logo as never) ?? null
  const brandColor = (tenant?.branding as { primaryColor?: string } | undefined)?.primaryColor

  return (
    <html
      lang="en"
      className={cn(fraunces.variable, inter.variable, amiri.variable, 'font-sans', geist.variable)}
    >
      <body className="font-body bg-bg text-fg2 antialiased">
        <div
          className="om-pf-shell"
          style={brandColor ? ({ ['--pf-brand']: brandColor } as React.CSSProperties) : undefined}
        >
          <header className="om-pf-tenant-header">
            {logoUrl && <img src={logoUrl} alt="" className="om-pf-tenant-logo" />}
            <span className="om-pf-tenant-name">{tenantName}</span>
          </header>
          {children}
          <footer className="om-pf-platform-footer">
            <span>
              Submissions are private to your masjid · Powered by <strong>OpenMasjid</strong>
            </span>
          </footer>
        </div>
      </body>
    </html>
  )
}
