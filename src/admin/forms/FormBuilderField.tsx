/**
 * FormBuilderField — server-side wrapper
 *
 * Payload 3 mounts this as the custom Field component for `forms.schema`
 * (see src/collections/Forms.ts: admin.components.Field).
 *
 * Structure:
 *   <FormToolbar>        ← sticky nav (Build / Settings / Submissions tabs)
 *     <FormBuilderFieldClient />  ← builder canvas (shown under Build tab)
 *   </FormToolbar>
 *
 * Note: FormToolbar is a 'use client' component. To avoid a client-boundary
 * issue in Payload's RSC context we import it directly — Payload v3 handles
 * the 'use client' boundary via its module resolution.
 */
import { FormBuilderFieldClient } from './FormBuilderField.client'
import FormToolbar from './FormToolbar'

// Payload passes field props as `any`; we proxy them all to the client component.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function FormBuilderField(props: any) {
  return (
    <FormToolbar>
      <FormBuilderFieldClient {...props} />
    </FormToolbar>
  )
}
