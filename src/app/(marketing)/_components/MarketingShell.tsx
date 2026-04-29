import type { ReactNode } from 'react'
import { MarketingHeader } from './Header'
import { MarketingFooter } from './Footer'

export function MarketingShell({ children, current }: { children: ReactNode; current: string }) {
  return (
    <div className="om-app">
      <MarketingHeader current={current} />
      <main className="om-main">{children}</main>
      <MarketingFooter />
    </div>
  )
}
