import '../globals.css'
import './kiosk.css'

export default function KioskLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{ margin: 0, background: '#000', color: '#fff', overflow: 'hidden' }}
      >
        {children}
      </body>
    </html>
  )
}
