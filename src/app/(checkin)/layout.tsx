import '../globals.css'
import { fraunces, inter } from '@/lib/fonts'
import { cn } from '@/lib/utils'

export const metadata = {
  title: 'Check-in',
}

export default function CheckinLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn(fraunces.variable, inter.variable)}>
      <body style={{ margin: 0, overflow: 'hidden', background: '#e7e5df' }}>{children}</body>
    </html>
  )
}
