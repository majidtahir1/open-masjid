import type { CollectionConfig, FieldHook } from 'payload'
import {
  tenantScopedCreate,
  tenantScopedDelete,
  tenantScopedRead,
  tenantScopedUpdate,
} from '../access/tenantScoped'
import { withBillingLock } from '../access/billingLocked'
import { setTenantFromUser } from '../hooks/setTenantFromUser'
import { validateSchema } from '../lib/form-schema'

const slugify = (v: string): string =>
  v.toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')

const autoSlug: FieldHook = ({ value, data, operation }) => {
  if (value) return value
  if (operation === 'create' && data?.title) return slugify(String(data.title))
  return value
}

export const Forms: CollectionConfig = {
  slug: 'forms',
  labels: { singular: 'Form', plural: 'Forms' },
  admin: {
    group: 'Forms',
    useAsTitle: 'title',
    defaultColumns: ['title', 'status', 'submissionsCount', 'updatedAt'],
  },
  access: {
    read: tenantScopedRead,
    create: withBillingLock(tenantScopedCreate),
    update: withBillingLock(tenantScopedUpdate),
    delete: withBillingLock(tenantScopedDelete),
  },
  hooks: {
    beforeChange: [setTenantFromUser, async ({ data }) => {
      if (data?.schema) {
        const r = validateSchema(data.schema)
        if (!r.success) throw new Error(`Invalid form schema: ${r.error}`)
      }
      return data
    }],
  },
  fields: [
    { name: 'title', type: 'text', required: true, label: 'Form title' },
    {
      name: 'slug',
      type: 'text',
      index: true,
      hooks: { beforeValidate: [autoSlug] },
      admin: { position: 'sidebar', description: 'URL slug. /forms/<slug>.' },
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'draft',
      required: true,
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Published', value: 'published' },
        { label: 'Closed', value: 'closed' },
      ],
      admin: { position: 'sidebar' },
    },
    {
      name: 'description',
      type: 'richText',
      admin: { description: 'Shown above the form on the public page.' },
    },
    {
      name: 'schema',
      type: 'json',
      required: true,
      defaultValue: { steps: [{ id: 's1', fields: [] }] },
      admin: {
        description: 'The form definition. Use the builder above.',
        components: { Field: '/src/admin/forms/FormBuilderField#default' },
      },
    },
    {
      name: 'settings',
      type: 'group',
      fields: [
        { name: 'submitButtonLabel', type: 'text', defaultValue: 'Submit' },
        { name: 'successMessage', type: 'richText' },
        {
          name: 'capacity',
          type: 'number',
          min: 0,
          admin: { description: 'Max submissions before the form closes. Leave blank for no limit.' },
        },
        {
          name: 'closedMessage',
          type: 'text',
          defaultValue: 'This form is closed. Thank you for your interest.',
        },
        {
          name: 'notificationEmails',
          type: 'array',
          fields: [
            { name: 'email', type: 'email', required: true },
          ],
        },
        {
          name: 'sendConfirmation',
          type: 'checkbox',
          defaultValue: false,
          label: 'Send a confirmation email to the submitter',
        },
        { name: 'confirmationSubject', type: 'text' },
        {
          name: 'confirmationBody',
          type: 'textarea',
          admin: { description: 'Plain text body. {{name}} interpolates the submitter name field if present.' },
        },
      ],
    },
    {
      name: 'payment',
      type: 'group',
      fields: [
        { name: 'enabled', type: 'checkbox', defaultValue: false },
        {
          name: 'mode',
          type: 'select',
          defaultValue: 'suggested',
          options: [
            { label: 'Fixed price', value: 'fixed' },
            { label: 'Suggested amounts', value: 'suggested' },
          ],
        },
        {
          name: 'priceCents',
          type: 'number',
          admin: { condition: (_, sib) => sib?.mode === 'fixed' && sib?.enabled },
        },
        {
          name: 'suggestedAmountsCents',
          type: 'array',
          fields: [
            { name: 'amount', type: 'number', required: true, min: 0 },
          ],
          admin: { condition: (_, sib) => sib?.mode === 'suggested' && sib?.enabled },
        },
        {
          name: 'allowCustomAmount',
          type: 'checkbox',
          defaultValue: true,
          admin: { condition: (_, sib) => sib?.mode === 'suggested' && sib?.enabled },
        },
        {
          name: 'currency',
          type: 'select',
          defaultValue: 'usd',
          options: [
            { label: 'USD', value: 'usd' },
            { label: 'CAD', value: 'cad' },
            { label: 'GBP', value: 'gbp' },
          ],
        },
        {
          name: 'description',
          type: 'text',
          admin: { description: 'Shown on the Stripe checkout page.' },
        },
      ],
    },
    {
      name: 'tenant',
      type: 'relationship',
      relationTo: 'tenants',
      required: true,
      index: true,
      admin: { position: 'sidebar', readOnly: true },
    },
  ],
}

export default Forms
