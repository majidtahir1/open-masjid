import '../globals.css'
import './kiosk.css'
import { fraunces, inter, amiri } from '@/lib/fonts'
import { cn } from '@/lib/utils'

export default function KioskLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={cn(fraunces.variable, inter.variable, amiri.variable)}
    >
      <body
        style={{ margin: 0, background: '#000', color: '#fff', overflow: 'hidden' }}
      >
        {children}
      </body>
    </html>
  )
}
