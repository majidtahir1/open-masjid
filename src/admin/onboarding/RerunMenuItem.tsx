import Link from 'next/link'
import { headers as getHeaders } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import { RefreshCw } from 'lucide-react'

export default async function RerunMenuItem() {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await getHeaders() })
  if (!user || user.role === 'platformOwner') return null
  return (
    <Link
      href="/admin"
      className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
    >
      <RefreshCw className="size-4" aria-hidden /> Re-run onboarding
    </Link>
  )
}
