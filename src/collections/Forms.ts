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
    enableListViewSelectAPI: true,
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
        description: 'The form definition. Drag, drop, and edit fields below.',
        components: {
          Field: '/src/admin/forms/FormBuilderField.client#FormBuilderFieldClient',
        },
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
      name: 'appearance',
      type: 'group',
      fields: [
        {
          name: 'displayMode',
          type: 'select',
          defaultValue: 'all-at-once',
          options: [
            { label: 'All questions on one page', value: 'all-at-once' },
            { label: 'One question per page (Typeform-style)', value: 'one-per-page' },
          ],
          admin: { description: 'How visitors progress through the form.' },
        },
        {
          name: 'introMessage',
          type: 'richText',
          admin: { description: 'Optional message shown above the first field.' },
        },
        {
          name: 'submissionMessage',
          type: 'richText',
          admin: { description: 'Shown after a successful submission. If left blank, falls back to Settings → Confirmation.' },
        },
        {
          name: 'backgroundColor',
          type: 'text',
          label: 'Background color',
          admin: {
            description: 'Solid background color shown behind the form card. Ignored if a gradient is set below.',
            placeholder: '#FAF9F4',
            components: {
              Field: '/src/admin/forms/fields/ColorField#default',
            },
          },
        },
        {
          name: 'backgroundGradient',
          type: 'group',
          fields: [
            {
              name: 'from',
              type: 'text',
              label: 'Gradient start',
              admin: {
                placeholder: '#1B3358',
                components: { Field: '/src/admin/forms/fields/ColorField#default' },
              },
            },
            {
              name: 'to',
              type: 'text',
              label: 'Gradient end',
              admin: {
                placeholder: '#0E1B2C',
                components: { Field: '/src/admin/forms/fields/ColorField#default' },
              },
            },
            {
              name: 'direction',
              type: 'select',
              defaultValue: 'vertical',
              options: [
                { label: 'Top → Bottom', value: 'vertical' },
                { label: 'Left → Right', value: 'horizontal' },
                { label: 'Diagonal (TL → BR)', value: 'diagonal' },
              ],
            },
          ],
          admin: { description: 'Optional gradient. When the start color is set, the gradient overrides the solid color above.' },
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
