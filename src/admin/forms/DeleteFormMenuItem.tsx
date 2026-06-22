'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { ConfirmationModal, PopupList, toast, useConfig, useDocumentInfo, useModal } from '@payloadcms/ui'
import { useRouter } from 'next/navigation'

/**
 * Count-aware "Delete" entry for the Forms edit-view kebab menu.
 *
 * Replaces Payload's built-in delete confirmation with one that warns how many
 * submissions will be cascade-deleted alongside the form (see the
 * `cascadeDeleteFormSubmissions` beforeDelete hook — deleting a form
 * permanently deletes its submissions too).
 *
 * Payload offers no per-collection switch to hide the native delete button, and
 * the kebab menu portals to <body>, so collection-scoped CSS can't reach it.
 * Instead we hide the native `#action-delete` from a `useEffect`. This component
 * is only registered as an `editMenuItems` entry on the Forms collection, so the
 * effect only ever runs on the Forms edit view — the hiding is Forms-scoped.
 */
export default function DeleteFormMenuItem() {
  const { id } = useDocumentInfo()
  const {
    config: { routes },
  } = useConfig()
  const { openModal } = useModal()
  const router = useRouter()
  const [count, setCount] = useState<number | null>(null)

  const modalSlug = `delete-form-with-submissions-${id ?? 'new'}`

  // Hide the native delete entry so only this count-aware one shows.
  useEffect(() => {
    const native = document.getElementById('action-delete')
    if (!native) return
    const prev = native.style.display
    native.style.display = 'none'
    return () => {
      native.style.display = prev
    }
  }, [])

  // Pre-fetch the submission count so the confirmation body is ready on open.
  useEffect(() => {
    if (!id) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(
          `${routes.api}/form-submissions?where[form][equals]=${id}&limit=0&depth=0`,
          { credentials: 'include' },
        )
        const json = await res.json()
        if (!cancelled) setCount(typeof json?.totalDocs === 'number' ? json.totalDocs : 0)
      } catch {
        if (!cancelled) setCount(0)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id, routes.api])

  const onConfirm = useCallback(async () => {
    try {
      const res = await fetch(`${routes.api}/forms/${id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!res.ok) throw new Error('delete failed')
      toast.success('Form deleted.')
      router.push(`${routes.admin}/collections/forms`)
    } catch {
      toast.error("Couldn't delete the form. Please try again.")
    }
  }, [id, routes.admin, routes.api, router])

  if (!id) return null

  const body =
    count && count > 0
      ? `Are you sure you want to delete this form? ${count} associated submission${
          count === 1 ? '' : 's'
        } will be deleted as well. This can't be undone.`
      : "Are you sure you want to delete this form? This can't be undone."

  return (
    <React.Fragment>
      <PopupList.Button id="action-delete-form" onClick={() => openModal(modalSlug)}>
        Delete
      </PopupList.Button>
      <ConfirmationModal
        modalSlug={modalSlug}
        heading="Delete form"
        body={body}
        confirmLabel="Delete"
        confirmingLabel="Deleting…"
        onConfirm={onConfirm}
      />
    </React.Fragment>
  )
}
