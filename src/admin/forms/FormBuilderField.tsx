/**
 * FormBuilderField — server-side wrapper
 *
 * Payload 3 mounts this as the custom Field component for `forms.schema`
 * (see src/collections/Forms.ts: admin.components.Field).
 *
 * The actual interactive builder lives in FormBuilderField.client.tsx
 * (a 'use client' component). This thin wrapper simply forwards all props
 * so Payload's field machinery works correctly on the server render pass.
 */
import { FormBuilderFieldClient } from './FormBuilderField.client'

// Payload passes field props as `any`; we proxy them all to the client component.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function FormBuilderField(props: any) {
  return <FormBuilderFieldClient {...props} />
}
