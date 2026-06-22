import type { CollectionConfig, FieldHook } from 'payload'
import {
  tenantScopedCreate,
  tenantScopedDelete,
  tenantScopedRead,
  tenantScopedUpdate,
} from '../access/tenantScoped'
import { withBillingLock } from '../access/billingLocked'
import { denyKioskManager, hideForKioskManager } from '../access/kioskRoles'
import { setTenantFromUser } from '../hooks/setTenantFromUser'
import { validateSchema } from '../lib/form-schema'
import { applyRenames, detectFieldRenames } from '../lib/form-schema-migrate'
import { hasParticipantGroup, hasRequiredRegistrationFields } from '../lib/registration-fields'
import { cascadeDeleteFormSubmissions } from '../hooks/cascadeDeleteFormSubmissions'

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
    hidden: hideForKioskManager,
    useAsTitle: 'title',
    defaultColumns: ['title', 'status', 'submissionsCount', 'lastSubmission', 'updatedAt'],
    components: {
      // Hides the list-view row-selection column so there's no bulk delete;
      // form deletion is funneled through the form page's count-aware dialog.
      beforeListTable: ['/src/admin/forms/HideFormsBulkSelect#default'],
      edit: {
        // Replaces the native delete with a count-aware confirmation (warns how
        // many submissions cascade-delete with the form). Hides #action-delete.
        editMenuItems: ['/src/admin/forms/DeleteFormMenuItem#default'],
      },
      views: {
        edit: {
          // Spreadsheet of this form's submissions.
          // Spec: docs/superpowers/specs/2026-06-10-submissions-spreadsheet-design.md
          submissions: {
            Component: '/src/admin/forms/submissions/SubmissionsView#default',
            path: '/submissions',
            tab: {
              label: 'Submissions',
              href: '/submissions',
            },
          },
        },
      },
    },
  },
  access: {
    read: denyKioskManager(tenantScopedRead),
    create: denyKioskManager(withBillingLock(tenantScopedCreate)),
    update: denyKioskManager(withBillingLock(tenantScopedUpdate)),
    delete: denyKioskManager(withBillingLock(tenantScopedDelete)),
  },
  hooks: {
    beforeDelete: [cascadeDeleteFormSubmissions],
    beforeChange: [setTenantFromUser, async ({ data, originalDoc }) => {
      if (data?.schema) {
        const r = validateSchema(data.schema)
        if (!r.success) throw new Error(`Invalid form schema: ${r.error}`)
      }
      // Registration invariants are only enforced at PUBLISH — drafts can be
      // saved while still being built (e.g. before the participant group exists).
      const orig = originalDoc as Record<string, any> | undefined
      const status = (data?.status ?? orig?.status) as string | undefined
      const schoolReg = data?.schoolRegistration ?? orig?.schoolRegistration
      if (status === 'published' && schoolReg === true) {
        const rawSchema = data?.schema ?? orig?.schema
        const sr = rawSchema ? validateSchema(rawSchema) : null
        const parsed = sr && sr.success ? sr.schema : null
        if (!parsed || !hasRequiredRegistrationFields(parsed)) {
          throw new Error('Before publishing: a registration form must include the Student first name and Student last name fields.')
        }
        if (!(data?.registrationProgram ?? orig?.registrationProgram)) {
          throw new Error('Before publishing: select a program for this registration form (For program).')
        }
        const participantModel = data?.registration?.participantModel ?? orig?.registration?.participantModel
        if (participantModel === 'children' && !hasParticipantGroup(parsed)) {
          throw new Error('Before publishing: a children registration form must contain a repeatable participant group.')
        }
      }
      return data
    }],
    afterChange: [
      // Submission answers are keyed by field `name`. When a field is renamed
      // (matched by its stable `id`), re-key existing submissions so old
      // answers keep showing up in the spreadsheet, drawer, and CSV.
      async ({ doc, previousDoc, operation, req }) => {
        if (operation !== 'update') return doc
        const renames = detectFieldRenames(previousDoc?.schema, doc?.schema)
        if (renames.length === 0) return doc
        try {
          let page = 1
          for (;;) {
            const batch = await req.payload.find({
              collection: 'form-submissions',
              where: { form: { equals: doc.id } },
              limit: 200,
              page,
              depth: 0,
              overrideAccess: true,
            })
            for (const sub of batch.docs as Array<{ id: string | number; data?: Record<string, unknown> | null }>) {
              const result = applyRenames(sub.data ?? {}, renames)
              if (!result.changed) continue
              await req.payload.update({
                collection: 'form-submissions',
                id: sub.id,
                data: { data: result.data },
                overrideAccess: true,
              })
            }
            if (!batch.hasNextPage) break
            page += 1
          }
        } catch (err) {
          // Best effort: the form save itself must not fail. Re-running the
          // rename (back and forth) re-triggers the migration.
          req.payload.logger.error({ err, formId: doc.id, renames }, 'form field rename migration failed')
        }
        return doc
      },
    ],
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
      name: 'schoolRegistration',
      type: 'checkbox',
      defaultValue: false,
      label: 'Program registration form',
      admin: {
        position: 'sidebar',
        description: 'Submissions create an unplaced student you can place into a class.',
      },
    },
    {
      name: 'registrationProgram',
      type: 'relationship',
      relationTo: 'terms',
      admin: {
        position: 'sidebar',
        description: 'Which program registrants are signed up for.',
        condition: (data) => data?.schoolRegistration === true,
      },
    },
    {
      name: 'registration',
      type: 'group',
      admin: { condition: (_, sib) => sib?.schoolRegistration === true },
      fields: [
        {
          name: 'participantModel',
          type: 'select',
          defaultValue: 'children',
          options: [
            { label: 'Children (guardian registers ≥1 child)', value: 'children' },
            { label: 'Self (an adult registers themselves)', value: 'self' },
          ],
        },
      ],
    },
    {
      name: 'submissionsCount',
      type: 'ui',
      label: 'Submissions',
      admin: {
        components: {
          Field: '/src/admin/forms/cells/EmptyField#default',
          Cell: '/src/admin/forms/cells/SubmissionsCountCell#default',
        },
      },
    },
    {
      name: 'lastSubmission',
      type: 'ui',
      label: 'Last submission',
      admin: {
        components: {
          Field: '/src/admin/forms/cells/EmptyField#default',
          Cell: '/src/admin/forms/cells/LastSubmissionCell#default',
        },
      },
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
        // Registration-form pricing (cadence, discounts, currency) lives on the
        // bound program (Terms), not here — see src/collections/Terms.ts. These
        // legacy fields drive only standalone donation/payment forms and are
        // hidden when schoolRegistration is on.
        {
          name: 'enabled',
          type: 'checkbox',
          defaultValue: false,
          admin: { condition: (data) => data?.schoolRegistration !== true },
        },
        {
          name: 'mode',
          type: 'select',
          defaultValue: 'suggested',
          options: [
            { label: 'Fixed price', value: 'fixed' },
            { label: 'Suggested amounts', value: 'suggested' },
          ],
          // Legacy one-time pricing — hidden on registration forms, whose
          // pricing comes from the program/class tuition + paymentModel.
          admin: { condition: (data) => data?.schoolRegistration !== true },
        },
        // Stored in cents; the DollarCents component shows an editable $ input.
        {
          name: 'priceCents',
          type: 'number',
          min: 0,
          label: 'Price',
          admin: {
            condition: (data, sib) => data?.schoolRegistration !== true && sib?.mode === 'fixed' && sib?.enabled,
            description: 'Dollars, e.g. enter 25 for $25.',
            components: { Field: '/src/admin/forms/fields/DollarCents#default' },
          },
        },
        {
          name: 'suggestedAmountsCents',
          type: 'array',
          labels: { singular: 'Suggested amount', plural: 'Suggested amounts' },
          fields: [
            {
              name: 'amount',
              type: 'number',
              required: true,
              min: 0,
              label: 'Amount',
              admin: { description: 'Dollars', components: { Field: '/src/admin/forms/fields/DollarCents#default' } },
            },
          ],
          admin: { condition: (data, sib) => data?.schoolRegistration !== true && sib?.mode === 'suggested' && sib?.enabled },
        },
        {
          name: 'allowCustomAmount',
          type: 'checkbox',
          defaultValue: true,
          admin: { condition: (data, sib) => data?.schoolRegistration !== true && sib?.mode === 'suggested' && sib?.enabled },
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
          admin: { condition: (data) => data?.schoolRegistration !== true },
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
