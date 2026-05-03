'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { SaveButton } from '@payloadcms/ui'

/**
 * SaveButton override for donation-funds. After a successful CREATE (the
 * pathname transitions from `.../create` to `.../<id>`), redirect to the
 * collection list view so the admin sees their new fund alongside the others.
 * Updates to existing funds preserve Payload's default behavior (stay on the
 * edit view).
 */
export default function FundsSaveButton() {
  const router = useRouter()
  const pathname = usePathname()
  const wasOnCreate = useRef(false)

  useEffect(() => {
    if (!pathname) return
    if (pathname.endsWith('/create')) {
      wasOnCreate.current = true
      return
    }
    if (wasOnCreate.current) {
      wasOnCreate.current = false
      const listPath = pathname.replace(/\/[^/]+$/, '')
      router.push(listPath)
    }
  }, [pathname, router])

  return <SaveButton />
}
