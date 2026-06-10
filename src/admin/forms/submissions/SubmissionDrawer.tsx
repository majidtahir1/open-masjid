'use client'

import type { FormSchema } from '@/lib/form-schema'
import type { SubmissionRowData } from '@/lib/submissions-table'

export interface SubmissionDrawerProps {
  row: SubmissionRowData
  schema: FormSchema | null
  formSlug: string | null
  onClose: () => void
  onStatusChange: (id: string | number, status: string) => void
}

export default function SubmissionDrawer(_props: SubmissionDrawerProps) {
  return null
}
