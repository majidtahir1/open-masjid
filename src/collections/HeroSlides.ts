import type { CollectionConfig } from 'payload'

import {
  tenantScopedCreate,
  tenantScopedDelete,
  tenantScopedRead,
  tenantScopedUpdate,
} from '../access/tenantScoped'
import { applyHeroStyleDefaults } from '../hooks/applyHeroStyleDefaults'
import { setTenantFromUser } from '../hooks/setTenantFromUser'
import { validateLucideIcon } from '../lib/validateLucideIcon'

export const HeroSlides: CollectionConfig = {
  slug: 'hero-slides',
  labels: {
    singular: 'Hero Slide',
    plural: 'Hero Slides',
  },
  admin: {
    group: 'Content',
    hideAPIURL: true,
    useAsTitle: 'title',
    defaultColumns: ['title', 'accent', 'active', 'sortOrder'],
    description:
      'Slides for the homepage hero slider. Use these for mission statements, donation pushes, or general announcements. Featured events from the Events collection are auto-added at render time.',
  },
  access: {
    read: tenantScopedRead,
    create: tenantScopedCreate,
    update: tenantScopedUpdate,
    delete: tenantScopedDelete,
  },
  hooks: {
    beforeChange: [setTenantFromUser, applyHeroStyleDefaults],
  },
  fields: [
    {
      type: 'collapsible',
      label: 'Slide Content',
      admin: {
        description: 'The text shown on the slide. Keep the title punchy (under ~8 words).',
        initCollapsed: false,
      },
      fields: [
        {
          name: 'eyebrow',
          type: 'text',
          label: 'Eyebrow Text',
          admin: {
            description:
              'Small label above the headline, e.g. "Islamic Center of Prosper". Optional — omit to save vertical space.',
            placeholder: 'Islamic Center of Prosper',
            components: {
              Field: '/src/fields/TextField#default',
            },
          },
        },
        {
          name: 'title',
          type: 'text',
          required: true,
          label: 'Headline',
          admin: {
            description: 'The main line visitors see. Short and action-oriented.',
            placeholder: 'A community rooted in service',
            components: {
              Field: '/src/fields/TextField#default',
            },
          },
        },
        {
          name: 'body',
          type: 'textarea',
          label: 'Body Copy',
          admin: {
            description: 'One or two sentences supporting the headline.',
            components: {
              Field: '/src/fields/TextareaField#default',
            },
          },
        },
        {
          name: 'meta',
          type: 'text',
          label: 'Footer Note',
          admin: {
            description:
              'Optional small line below the CTAs, e.g. "Monthly recurring available".',
            components: {
              Field: '/src/fields/TextField#default',
            },
          },
        },
      ],
    },
    {
      name: 'style',
      type: 'select',
      required: true,
      defaultValue: 'original',
      label: 'Layout Style',
      options: [
        { label: 'Original — centered editorial (single column)', value: 'original' },
        { label: 'Split — copy + card stack (next iqamah, photo, up next)', value: 'split' },
        { label: 'Live — copy + "Right now at ICP" widget', value: 'live' },
        { label: 'Photo — full-bleed dark + ayah card', value: 'photo' },
      ],
      admin: {
        description:
          'Visual layout for this slide. Each style has a built-in color treatment that you can override via Slide Theme below.',
        components: {
          Field: '/src/fields/SelectField#default',
        },
      },
    },
    {
      name: 'accent',
      type: 'select',
      required: true,
      defaultValue: 'cream',
      label: 'Slide Theme',
      options: [
        { label: 'Cream — warm, neutral (default welcome slides)', value: 'cream' },
        { label: 'Teal — fresh, calm (mission / about)', value: 'teal' },
        { label: 'Navy — serious, premium (flagship programs)', value: 'navy' },
        { label: 'Gold — celebratory (Eid, fundraisers, milestones)', value: 'gold' },
      ],
      admin: {
        description:
          'Color treatment for the slide. Defaults to the style\'s built-in color (Cream for most, Navy for the Photo style). Pick a different theme to override.',
        components: {
          Field: '/src/fields/SelectField#default',
        },
      },
    },
    {
      name: 'splitFields',
      type: 'group',
      label: 'Split Layout — Card Content',
      admin: {
        description:
          'Content shown in the right-side card stack for the Split layout. Only used when Layout Style is "Split".',
        condition: (_, siblingData) => siblingData?.style === 'split',
      },
      fields: [
        {
          name: 'photoLabel',
          type: 'text',
          label: 'Photo Label',
          admin: {
            description: 'Caption shown over the photo card. e.g. "Friday gathering".',
            placeholder: 'Friday gathering',
            components: { Field: '/src/fields/TextField#default' },
          },
        },
        {
          name: 'photoTone',
          type: 'select',
          label: 'Photo Tone',
          defaultValue: 'secondary',
          options: [
            { label: 'Secondary (default)', value: 'secondary' },
            { label: 'Accent', value: 'accent' },
            { label: 'Brand', value: 'brand' },
          ],
          admin: {
            description:
              'Tint for the placeholder when no image is uploaded. Picks from your tenant theme: Brand = primary, Secondary = secondary, Accent = highlight.',
            components: { Field: '/src/fields/SelectField#default' },
          },
        },
        {
          name: 'cardTag',
          type: 'text',
          label: 'Photo Card Tag',
          admin: {
            description: 'Eyebrow above the photo card title. e.g. "Jummah · this week".',
            placeholder: 'Jummah · this week',
            components: { Field: '/src/fields/TextField#default' },
          },
        },
        {
          name: 'cardTitle',
          type: 'text',
          label: 'Photo Card Title',
          admin: {
            description: 'Main line on the photo card. e.g. "On Tawakkul — Shaykh Omar".',
            components: { Field: '/src/fields/TextField#default' },
          },
        },
        {
          name: 'image',
          type: 'upload',
          relationTo: 'media',
          label: 'Photo (optional)',
          admin: {
            description: 'Real photo for the card. Falls back to a tinted placeholder if empty.',
          },
        },
      ],
    },
    {
      name: 'photoFields',
      type: 'group',
      label: 'Photo Layout — Background + Ayah',
      admin: {
        description:
          'Background image and ayah card content for the full-bleed Photo layout. Only used when Layout Style is "Photo".',
        condition: (_, siblingData) => siblingData?.style === 'photo',
      },
      fields: [
        {
          name: 'photoLabel',
          type: 'text',
          label: 'Background Label',
          admin: {
            description: 'Caption corner-tag for the background. e.g. "Masjid prayer hall · golden hour".',
            components: { Field: '/src/fields/TextField#default' },
          },
        },
        {
          name: 'photoTone',
          type: 'select',
          label: 'Background Tone',
          defaultValue: 'brand',
          options: [
            { label: 'Brand (default)', value: 'brand' },
            { label: 'Secondary', value: 'secondary' },
            { label: 'Accent', value: 'accent' },
          ],
          admin: {
            description:
              'Tint for the background placeholder when no image is uploaded. Picks from your tenant theme.',
            components: { Field: '/src/fields/SelectField#default' },
          },
        },
        {
          name: 'photoPattern',
          type: 'select',
          label: 'Background Pattern',
          defaultValue: 'arch',
          options: [
            { label: 'Arch — minaret silhouette (default)', value: 'arch' },
            { label: 'Geometric — 8-pointed star tessellation', value: 'geometric' },
            { label: 'Stars — scattered subtle stars', value: 'stars' },
            { label: 'Lattice — interlocking circles', value: 'lattice' },
          ],
          admin: {
            description:
              'Decorative pattern shown when no Background Photo is uploaded.',
            components: { Field: '/src/fields/SelectField#default' },
          },
        },
        {
          name: 'image',
          type: 'upload',
          relationTo: 'media',
          label: 'Background Photo (optional)',
          admin: {
            description: 'Full-bleed photo. Falls back to a tinted placeholder if empty.',
          },
        },
        {
          name: 'ayahArabic',
          type: 'textarea',
          label: 'Ayah (Arabic)',
          admin: {
            description: 'Right-to-left Arabic verse displayed in the side card.',
            placeholder: 'إِنَّ الصَّلَاةَ كَانَتْ عَلَى الْمُؤْمِنِينَ كِتَابًا مَّوْقُوتًا',
            components: { Field: '/src/fields/TextareaField#default' },
          },
        },
        {
          name: 'ayahTranslation',
          type: 'textarea',
          label: 'Ayah (English Translation)',
          admin: {
            description: 'Translation displayed below the Arabic.',
            components: { Field: '/src/fields/TextareaField#default' },
          },
        },
        {
          name: 'ayahCitation',
          type: 'text',
          label: 'Ayah Citation',
          admin: {
            description: 'Reference for the verse, e.g. "An-Nisa · 4:103".',
            placeholder: 'An-Nisa · 4:103',
            components: { Field: '/src/fields/TextField#default' },
          },
        },
      ],
    },
    {
      name: 'ctas',
      type: 'array',
      label: 'Call-to-Action Buttons',
      labels: { singular: 'CTA', plural: 'CTAs' },
      admin: {
        description:
          'Up to two buttons per slide. Mark one as Primary (filled) and leave the other secondary (outlined).',
      },
      fields: [
        {
          name: 'label',
          type: 'text',
          required: true,
          label: 'Button Label',
          admin: {
            placeholder: 'Donate',
            components: {
              Field: '/src/fields/TextField#default',
            },
          },
        },
        {
          name: 'linkType',
          type: 'select',
          required: true,
          defaultValue: 'url',
          label: 'Link Type',
          options: [
            { label: 'Internal page', value: 'page' },
            { label: 'External URL', value: 'url' },
          ],
          admin: {
            description:
              'Use "Internal page" for site pages (faster, handles branding). Use "External URL" for LaunchGood, forms, etc.',
            components: {
              Field: '/src/fields/SelectField#default',
            },
          },
        },
        {
          name: 'page',
          type: 'select',
          label: 'Page',
          options: [
            { label: 'Home', value: '/' },
            { label: 'Events', value: '/events' },
            { label: 'Prayer Times', value: '/prayer-times' },
            { label: 'Donate', value: '/donate' },
            { label: 'About', value: '/about' },
          ],
          admin: {
            description: 'Shown only when Link Type is "Internal page".',
            condition: (_, siblingData) => siblingData?.linkType === 'page',
            components: {
              Field: '/src/fields/SelectField#default',
            },
          },
        },
        {
          name: 'url',
          type: 'text',
          label: 'External URL',
          admin: {
            description:
              'Shown only when Link Type is "External URL". Include https://',
            placeholder: 'https://launchgood.com/...',
            condition: (_, siblingData) => siblingData?.linkType === 'url',
            components: {
              Field: '/src/fields/TextField#default',
            },
          },
        },
        {
          name: 'icon',
          type: 'text',
          label: 'Icon',
          admin: {
            description: 'Optional. Pick an icon for the button.',
            components: {
              Field: '/src/fields/IconPickerField#default',
            },
          },
          validate: (value: unknown) => validateLucideIcon(value),
        },
        {
          name: 'primary',
          type: 'checkbox',
          defaultValue: false,
          label: 'Primary Button',
          admin: {
            description:
              'On = filled/branded button. Off = outlined secondary button. Mark one CTA per slide as primary.',
            components: {
              Field: '/src/fields/CheckboxField#default',
            },
          },
        },
      ],
    },
    {
      name: 'sortOrder',
      type: 'number',
      defaultValue: 0,
      label: 'Sort Order',
      admin: {
        description: 'Lower numbers appear first in the slider.',
        position: 'sidebar',
        components: {
          Field: '/src/fields/NumberField#default',
        },
      },
    },
    {
      name: 'active',
      type: 'checkbox',
      defaultValue: true,
      label: 'Active',
      admin: {
        description: 'Uncheck to hide this slide without deleting it.',
        position: 'sidebar',
        components: {
          Field: '/src/fields/CheckboxField#default',
        },
      },
    },
    {
      name: 'tenant',
      type: 'relationship',
      relationTo: 'tenants',
      required: true,
      index: true,
      label: 'Tenant',
      admin: {
        position: 'sidebar',
        description: 'Set automatically from your account. Only a Platform Owner can reassign.',
        condition: (_, __, { user }) => {
          const u = user as { role?: string } | null | undefined
          return u?.role === 'platformOwner'
        },
      },
      access: {
        update: ({ req: { user } }) => {
          if (!user) return false
          return user.role === 'platformOwner'
        },
      },
    },
  ],
  versions: {
    drafts: {
      schedulePublish: true,
    },
  },
}

export default HeroSlides
