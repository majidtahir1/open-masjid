// src/collections/FormSubmissions.ts
import type { Access, CollectionConfig } from 'payload'
import { tenantScopedRead } from '../access/tenantScoped'
import { denyKioskManager } from '../access/kioskRoles'
import { createStudentFromRegistration } from '../hooks/createStudentFromRegistration'

/** School roles must not access raw form submissions (contain guardian PII from every form). */
const submissionsRead: Access = (args) => {
  const role = (args.req.user as { role?: string } | null | undefined)?.role
  if (role === 'teacher' || role === 'school_admin') return false
  return tenantScopedRead(args)
}

export const FormSubmissions: CollectionConfig = {
  slug: 'form-submissions',
  labels: { singular: 'Submission', plural: 'Submissions' },
  // Soft delete: deleting sets `deletedAt` instead of removing the row, and
  // every default query (spreadsheet, counts, CSV, capacity checks) excludes
  // trashed docs automatically. Deletion happens only via the dedicated
  // DELETE /api/forms/submissions/[id] route — collection update/delete
  // access stays locked down, so payment-linked records are never lost.
  trash: true,
  admin: {
    // No admin UI of its own — submissions are viewed via the spreadsheet
    // "Submissions" tab on each form (src/admin/forms/submissions/). The
    // REST API and access control below are unaffected by `hidden`.
    hidden: true,
    useAsTitle: 'submitterEmail',
    description: 'Form submissions. Read-only — created by the public submit endpoint.',
  },
  access: {
    create: denyKioskManager(() => false),
    update: denyKioskManager(() => false),
    delete: denyKioskManager(() => false),
    read: denyKioskManager(submissionsRead),
  },
  hooks: {
    afterChange: [createStudentFromRegistration],
  },
  fields: [
    { name: 'tenant', type: 'relationship', relationTo: 'tenants', required: true, index: true,
      admin: { readOnly: true } },
    { name: 'form', type: 'relationship', relationTo: 'forms', required: true, index: true,
      admin: { readOnly: true } },
    { name: 'submitterEmail', type: 'email', admin: { readOnly: true } },
    { name: 'submitterName', type: 'text', admin: { readOnly: true } },
    { name: 'data', type: 'json', required: true, admin: { readOnly: true } },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'new',
      required: true,
      options: [
        { label: 'New', value: 'new' },
        { label: 'Reviewed', value: 'reviewed' },
        { label: 'Archived', value: 'archived' },
      ],
    },
    {
      name: 'paymentStatus',
      type: 'select',
      options: [
        { label: 'Not applicable', value: 'na' },
        { label: 'Pending payment', value: 'pending_payment' },
        { label: 'Paid', value: 'paid' },
        { label: 'Expired', value: 'expired' },
      ],
      defaultValue: 'na',
      admin: { readOnly: true },
    },
    { name: 'amountCents', type: 'number', admin: { readOnly: true } },
    { name: 'currency', type: 'text', admin: { readOnly: true } },
    { name: 'stripeCheckoutSessionId', type: 'text', index: true, admin: { readOnly: true } },
    { name: 'stripePaymentIntentId', type: 'text', index: true, admin: { readOnly: true } },
    { name: 'paidAt', type: 'date', admin: { readOnly: true } },
    { name: 'submittedAt', type: 'date', required: true, defaultValue: () => new Date(),
      admin: { readOnly: true } },
    { name: 'userAgent', type: 'text', admin: { readOnly: true } },
    { name: 'ipHash', type: 'text', admin: { readOnly: true } },
  ],
}

export default FormSubmissions
