import Link from 'next/link'
import { RefreshCw } from 'lucide-react'

import { getAdminUser } from '@/lib/admin-context'

export default async function RerunMenuItem() {
  const { user } = await getAdminUser()
  if (!user || user.role !== 'admin') return null
  return (
    <Link
      href="/admin"
      className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
    >
      <RefreshCw className="size-4" aria-hidden /> Re-run onboarding
    </Link>
  )
}
