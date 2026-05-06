// src/collections/FormSubmissions.ts
import type { CollectionConfig } from 'payload'
import { tenantScopedRead } from '../access/tenantScoped'

export const FormSubmissions: CollectionConfig = {
  slug: 'form-submissions',
  labels: { singular: 'Submission', plural: 'Submissions' },
  admin: {
    group: 'Forms',
    useAsTitle: 'submitterEmail',
    defaultColumns: ['submittedAt', 'submitterEmail', 'form', 'status', 'paymentStatus'],
    description: 'Form submissions. Read-only — created by the public submit endpoint.',
    components: {
      beforeListTable: ['/src/admin/forms/SubmissionsList#default'],
      views: {
        edit: {
          // Replace the default edit view with a bespoke submission-detail layout.
          // Artboard ref: 4.2 sub-detail
          default: {
            Component: '/src/admin/forms/SubmissionDetail#default',
          },
        },
      },
    },
  },
  access: {
    create: () => false,
    update: () => false,
    delete: () => false,
    read: tenantScopedRead,
  },
  fields: [
    { name: 'tenant', type: 'relationship', relationTo: 'tenants', required: true, index: true,
      admin: { readOnly: true } },
    { name: 'form', type: 'relationship', relationTo: 'forms', required: true, index: true,
      admin: { readOnly: true } },
    { name: 'submitterEmail', type: 'email', required: true, admin: { readOnly: true } },
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
      admin: {
        components: {
          Cell: '/src/admin/forms/cells/StatusCell#default',
        },
      },
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
      admin: {
        readOnly: true,
        components: {
          Cell: '/src/admin/forms/cells/PaymentStatusCell#default',
        },
      },
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
