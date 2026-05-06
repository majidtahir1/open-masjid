'use client'

/**
 * FormBuilderField — Payload 3 mounts this as the custom Field component for
 * `forms.schema` (see src/collections/Forms.ts: admin.components.Field).
 *
 * Marked 'use client' because Payload passes the full field props — which
 * include the document-level Lexical editor config containing function refs
 * (`feature: function`) — that can't cross a server→client boundary. Mirrors
 * the convention used by src/fields/TextField.tsx.
 *
 * Structure:
 *   <FormToolbar>        ← sticky nav (Build / Settings / Submissions tabs)
 *     <FormBuilderFieldClient />  ← builder canvas (shown under Build tab)
 *   </FormToolbar>
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
