import type { CollectionConfig, FieldAccess } from 'payload'

import { platformOwnerOnly } from '../access/tenantScoped'
import { withBillingLock } from '../access/billingLocked'
import { geocodeTenantAddress } from '../hooks/geocodeTenantAddress'
import { seedDefaultDonationFunds } from '../hooks/seedDefaultDonationFunds'
import { seedPrayerDisplayContent } from '../hooks/seedPrayerDisplayContent'
import { validateUniqueCustomDomains } from '../hooks/validateUniqueCustomDomains'

/**
 * Field-update guard for tenant lifecycle / billing / Stripe-derived state.
 * Tenant admins can update their own tenant doc, but these fields must only
 * change via platform-owner action or the trusted server paths that use
 * `overrideAccess` (afterLogin, billing webhook, Stripe Connect callback /
 * disconnect, donations sync). `admin.hidden` / `admin.readOnly` are UI-only
 * controls — this enforces the boundary server-side. `overrideAccess` writes
 * bypass field access, so the legitimate server writers are unaffected.
 */
const platformOwnerFieldUpdate: FieldAccess = ({ req: { user } }) =>
  (user as { role?: string } | null)?.role === 'platformOwner'

/**
 * Field-update guard that is demo-aware: real tenants are unaffected (admins
 * may still edit), but the shared public demo tenant is locked to platform
 * owners. `doc` holds the original document on update (undefined on create),
 * so this only ever denies an UPDATE to the demo tenant doc by a non-owner.
 */
const demoLockedFieldUpdate: FieldAccess = ({ req: { user }, doc }) => {
  if ((user as { role?: string } | null)?.role === 'platformOwner') return true
  return !(doc as { demoMode?: boolean | null } | undefined)?.demoMode
}

/**
 * Tenants — each masjid (and the ICPC umbrella) is a tenant.
 *
 * Decision: SiteSettings-style fields (contactInfo, socialLinks, etc.) live
 * directly on this collection rather than as a separate Payload global.
 * Payload globals are not natively per-tenant, and storing tenant-scoped
 * config here keeps branding + contact + social in a single editable doc.
 */
export const Tenants: CollectionConfig = {
  slug: 'tenants',
  labels: {
    singular: 'Tenant',
    plural: 'Tenants',
  },
  admin: {
    enableListViewSelectAPI: true,
    group: 'Site',
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'siteType'],
    description:
      'A tenant is a masjid (or umbrella org) served by the platform. Each tenant has its own domain, branding, and content.',
    components: {
      beforeListTable: ['/src/admin/CreateTenantPanel#default'],
    },
  },
  hooks: {
    beforeValidate: [validateUniqueCustomDomains],
    beforeChange: [geocodeTenantAddress],
    afterChange: [seedDefaultDonationFunds, seedPrayerDisplayContent],
  },
  access: {
    // Only platform owners can create or delete tenants.
    create: withBillingLock(platformOwnerOnly),
    delete: withBillingLock(platformOwnerOnly),
    // Platform owners see all; tenant users (admin/staff) can read only their own tenant.
    read: ({ req: { user } }) => {
      if (!user) return false
      if (user.role === 'platformOwner') return true
      const tenant = (user as { tenant?: unknown }).tenant
      const tenantId =
        typeof tenant === 'object' && tenant !== null && 'id' in tenant
          ? (tenant as { id: string | number }).id
          : (tenant as string | number | undefined)
      if (!tenantId) return false
      return { id: { equals: tenantId } }
    },
    // Platform owners can update any tenant; admins can update their own.
    update: withBillingLock(({ req: { user } }) => {
      if (!user) return false
      if (user.role === 'platformOwner') return true
      if (user.role !== 'admin') return false
      const tenant = (user as { tenant?: unknown }).tenant
      const tenantId =
        typeof tenant === 'object' && tenant !== null && 'id' in tenant
          ? (tenant as { id: string | number }).id
          : (tenant as string | number | undefined)
      if (!tenantId) return false
      return { id: { equals: tenantId } }
    }),
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Identity',
          description: 'How this tenant is named and what type of site it runs.',
          fields: [
            {
              name: 'name',
              type: 'text',
              required: true,
              label: 'Display Name',
              admin: {
                description:
                  'Public-facing name shown in the site header, footer, and emails, e.g. "Islamic Center of Prosper".',
                placeholder: 'Islamic Center of Prosper',
                components: {
                  Field: '/src/admin/SiteSettingsIdentityField#default',
                },
              },
            },
            {
              name: 'slug',
              type: 'text',
              required: true,
              unique: true,
              index: true,
              label: 'URL Slug',
              admin: {
                hidden: true,
                description:
                  'Short identifier used for the platform subdomain (e.g. "icp" becomes icp.openmasjid.app). Lowercase letters, numbers, and dashes only. Avoid changing after launch.',
                placeholder: 'icp',
                components: {
                  Field: '/src/fields/TextField#default',
                },
              },
              // Demo tenants are located by slug for nightly reset; a shared
              // demo admin must not be able to change it (would orphan the old
              // demo tenant + its connected account). Real tenants unaffected.
              access: { update: demoLockedFieldUpdate },
            },
            {
              name: 'siteType',
              type: 'select',
              required: true,
              defaultValue: 'masjid',
              label: 'Site Type',
              options: [
                { label: 'Masjid', value: 'masjid' },
                { label: 'Umbrella Organization', value: 'umbrella' },
              ],
              admin: {
                hidden: true,
                description:
                  'Choose "Masjid" for a single-community site, or "Umbrella Organization" for a parent org that groups multiple masajid.',
                components: {
                  Field: '/src/fields/SelectField#default',
                },
              },
            },
          ],
        },
        {
          label: 'Domains',
          description:
            'Custom domains owned by this masjid. The platform subdomain (from slug) always works — custom domains are optional.',
          fields: [
            {
              name: 'customDomains',
              type: 'array',
              label: 'Custom Domains',
              labels: {
                singular: 'Custom Domain',
                plural: 'Custom Domains',
              },
              // Real tenants: admins may edit. Demo tenant: locked to platform
              // owners so the shared public admin can't repoint demo domains.
              access: { update: demoLockedFieldUpdate },
              admin: {
                description:
                  'Add each custom domain the masjid owns (both with and without www if applicable). Visitors reaching these domains will see this tenant\'s public site.',
              },
              fields: [
                {
                  name: 'domain',
                  type: 'text',
                  required: true,
                  label: 'Domain',
                  admin: {
                    description:
                      'Hostname only — no https:// and no trailing slash. Example: icprosper.org',
                    placeholder: 'icprosper.org',
                    components: {
                      Field: '/src/fields/TextField#default',
                    },
                  },
                },
              ],
            },
          ],
        },
        {
          label: 'Branding',
          description:
            'Logo, colors, and typography. These values drive the design tokens used across the public site.',
          fields: [
            {
              name: 'branding',
              type: 'group',
              label: 'Branding',
              admin: {
                description:
                  'Upload a logo and set brand colors. Hover/pressed/soft shades are derived automatically — you only choose three colors.',
                components: {
                  Field: '/src/admin/SiteSettingsBrandingField#default',
                },
              },
              fields: [
                {
                  name: 'logo',
                  type: 'upload',
                  relationTo: 'media',
                  label: 'Logo',
                  admin: {
                    description:
                      'Primary logo shown in the site header and admin panel. Prefer a transparent PNG or SVG.',
                  },
                },
                {
                  name: 'favicon',
                  type: 'upload',
                  relationTo: 'media',
                  label: 'Favicon',
                  admin: {
                    description:
                      'Square icon shown in the browser tab for both the public site and the admin panel. 32×32 or 64×64 PNG/ICO — NOT the full logo. If left blank, a neutral OpenMasjid icon is used.',
                  },
                },
                {
                  name: 'primaryColor',
                  type: 'text',
                  label: 'Primary Color',
                  admin: {
                    description:
                      'Main brand color — used for buttons, links, and headings. Hex value, e.g. #0F1E4A (navy).',
                    placeholder: '#0F1E4A',
                    components: {
                      Field: '/src/fields/TextField#default',
                    },
                  },
                },
                {
                  name: 'secondaryColor',
                  type: 'text',
                  label: 'Secondary Color',
                  admin: {
                    description:
                      'Supporting accent — used in highlights and secondary UI. Hex value, e.g. #28A0B4 (teal).',
                    placeholder: '#28A0B4',
                    components: {
                      Field: '/src/fields/TextField#default',
                    },
                  },
                },
                {
                  name: 'accentColor',
                  type: 'text',
                  label: 'Accent Color',
                  admin: {
                    description:
                      'Warm accent — used sparingly on badges and devotional elements. Hex value, e.g. #F0C88C (gold).',
                    placeholder: '#F0C88C',
                    components: {
                      Field: '/src/fields/TextField#default',
                    },
                  },
                },
                {
                  name: 'displayFont',
                  type: 'select',
                  defaultValue: 'Fraunces',
                  label: 'Display Font',
                  options: [
                    { label: 'Fraunces (warm serif)', value: 'Fraunces' },
                    { label: 'Playfair Display (editorial serif)', value: 'Playfair Display' },
                    { label: 'DM Serif Display (modern serif)', value: 'DM Serif Display' },
                    { label: 'IBM Plex Sans (geometric sans)', value: 'IBM Plex Sans' },
                  ],
                  admin: {
                    description:
                      'Headline font. Body text and Arabic fonts are fixed platform-wide for consistency.',
                    components: {
                      Field: '/src/fields/SelectField#default',
                    },
                  },
                },
                {
                  name: 'headerArabicLine',
                  type: 'text',
                  label: 'Header Arabic Line',
                  admin: {
                    description:
                      'Optional Arabic line (e.g. a bismillah or duʿa) shown centered beneath the site header on every page. Rendered right-to-left in an Arabic font. Leave blank to hide.',
                    components: {
                      Field: '/src/fields/TextField#default',
                    },
                  },
                },
              ],
            },
            {
              name: 'homepageCopy',
              type: 'group',
              label: 'Homepage Copy',
              admin: {
                description:
                  'Overrides for the hardcoded homepage section copy. Every field is optional — leave a field blank to use the platform default.',
              },
              fields: [
                {
                  name: 'eventsEyebrow',
                  type: 'text',
                  label: 'Events Eyebrow',
                  admin: {
                    description:
                      'Small caps label above the homepage "Upcoming events" block. Leave blank for the platform default: "What\'s happening".',
                    components: {
                      Field: '/src/fields/TextField#default',
                    },
                  },
                },
                {
                  name: 'eventsHeading',
                  type: 'text',
                  label: 'Events Heading',
                  admin: {
                    description:
                      'Heading of the homepage events block. Leave blank for the platform default: "Upcoming events".',
                    components: {
                      Field: '/src/fields/TextField#default',
                    },
                  },
                },
                {
                  name: 'eventsSubcopy',
                  type: 'textarea',
                  label: 'Events Subcopy',
                  admin: {
                    description:
                      'Short sentence under the events heading. Leave blank for the platform default: "Classes, programs, and gatherings for the whole community."',
                    components: {
                      Field: '/src/fields/TextareaField#default',
                    },
                  },
                },
                {
                  name: 'servicesEyebrow',
                  type: 'text',
                  label: 'Services Eyebrow',
                  admin: {
                    description:
                      'Small caps label above the homepage services grid. Leave blank for the platform default: "What we do".',
                    components: {
                      Field: '/src/fields/TextField#default',
                    },
                  },
                },
                {
                  name: 'servicesHeading',
                  type: 'text',
                  label: 'Services Heading',
                  admin: {
                    description:
                      'Heading of the homepage services grid. Leave blank for the platform default: "Services for our community".',
                    components: {
                      Field: '/src/fields/TextField#default',
                    },
                  },
                },
                {
                  name: 'servicesSubcopy',
                  type: 'textarea',
                  label: 'Services Subcopy',
                  admin: {
                    description:
                      'Short sentence under the services heading. Leave blank for the platform default: "From your first week to your last rites — we\'re here for every part of the journey, Insha\'Allah."',
                    components: {
                      Field: '/src/fields/TextareaField#default',
                    },
                  },
                },
                {
                  name: 'servicesLayout',
                  type: 'select',
                  defaultValue: 'cards',
                  label: 'Services Layout',
                  options: [
                    { label: 'Cards (default)', value: 'cards' },
                    { label: 'Compact strip', value: 'compact' },
                  ],
                  admin: {
                    description:
                      'How service cards are laid out on the homepage. "Compact strip" renders smaller cards in a tighter multi-column strip.',
                    components: {
                      Field: '/src/fields/SelectField#default',
                    },
                  },
                },
                {
                  name: 'donateEyebrow',
                  type: 'text',
                  label: 'Donate Eyebrow',
                  admin: {
                    description:
                      'Small caps label above the homepage donate band. Leave blank for the platform default: "Build with us".',
                    components: {
                      Field: '/src/fields/TextField#default',
                    },
                  },
                },
                {
                  name: 'donateQuote',
                  type: 'textarea',
                  label: 'Donate Quote',
                  admin: {
                    description:
                      'Pull quote in the homepage donate band. Leave blank for the platform default hadith: "The most beloved deeds to Allah are those done consistently, even if small."',
                    components: {
                      Field: '/src/fields/TextareaField#default',
                    },
                  },
                },
                {
                  name: 'donateCitation',
                  type: 'text',
                  label: 'Donate Citation',
                  admin: {
                    description:
                      'Citation line under the donate quote. Leave blank for the platform default: "— Prophet Muhammad (peace be upon him)".',
                    components: {
                      Field: '/src/fields/TextField#default',
                    },
                  },
                },
                {
                  name: 'donateButtonLabel',
                  type: 'text',
                  label: 'Donate Button Label',
                  admin: {
                    description:
                      'Label of the donate band button. Leave blank for the platform default: "Donate now".',
                    components: {
                      Field: '/src/fields/TextField#default',
                    },
                  },
                },
              ],
            },
          ],
        },
        {
          label: 'Prayer Calculation',
          description:
            'Required for auto-calculating adhan times. The masjid location + calculation method drive per-day adhan times.',
          fields: [
            {
              name: 'location',
              type: 'group',
              label: 'Location',
              admin: {
                description:
                  'Masjid coordinates and timezone. Lat/lng are auto-filled from the address on save. Override manually if the geocoder picks the wrong point.',
              },
              fields: [
                {
                  name: 'lat',
                  type: 'number',
                  label: 'Latitude',
                  admin: {
                    description: 'Decimal degrees (e.g. 33.2257 for Prosper, TX).',
                    placeholder: '33.2257',
                  },
                },
                {
                  name: 'lng',
                  type: 'number',
                  label: 'Longitude',
                  admin: {
                    description: 'Decimal degrees (e.g. -96.7969 for Prosper, TX).',
                    placeholder: '-96.7969',
                  },
                },
                {
                  name: 'timezone',
                  type: 'text',
                  label: 'Timezone',
                  admin: {
                    description:
                      'IANA timezone for the masjid (e.g. America/Chicago, America/New_York). See https://en.wikipedia.org/wiki/List_of_tz_database_time_zones.',
                    placeholder: 'America/Chicago',
                  },
                },
              ],
            },
            {
              name: 'prayerDisplay',
              type: 'group',
              label: 'Prayer Display',
              admin: {
                description: 'Settings for the kiosk prayer display (the lobby TV screen).',
              },
              fields: [
                {
                  name: 'displayCity',
                  type: 'text',
                  label: 'Display city',
                  admin: {
                    description:
                      'Shown under the masjid name on the prayer display, e.g. "Plano, TX". Leave blank to hide.',
                  },
                },
                {
                  name: 'dwellSeconds',
                  type: 'number',
                  label: 'Prayer screen dwell (seconds)',
                  defaultValue: 10,
                  min: 5,
                  max: 60,
                  admin: {
                    description:
                      'How long the prayer screen stays up before the carousel advances (5–60). Default 10.',
                  },
                },
                {
                  name: 'salahHoldoverMinutes',
                  type: 'number',
                  label: 'Salah holdover (minutes)',
                  defaultValue: 5,
                  min: 1,
                  max: 90,
                  admin: {
                    description:
                      'How long the "Salah in progress" screen stays up after iqamah, for all prayers (1–90). Default 5.',
                  },
                },
                {
                  name: 'salahManualUntil',
                  type: 'date',
                  admin: {
                    hidden: true,
                    description:
                      'Set by the "Salah now" admin control; the takeover stays up until this time.',
                  },
                },
                {
                  name: 'salahManualClearedAt',
                  type: 'date',
                  admin: {
                    hidden: true,
                    description: 'Set by "End now"; clears an active manual takeover.',
                  },
                },
              ],
            },
            {
              name: 'checkinKiosk',
              type: 'group',
              label: 'Parent Check-in Kiosk',
              admin: {
                description: 'Settings for the parent self check-in iPad (drop-off / pickup).',
              },
              fields: [
                {
                  name: 'pin',
                  type: 'text',
                  label: 'Staff setup PIN',
                  admin: {
                    description:
                      'A 4–6 digit PIN a staff member enters once to bind an iPad to a program. Share with staff only. Leave blank to disable kiosk setup.',
                  },
                },
              ],
            },
            {
              name: 'prayerCalc',
              type: 'group',
              label: 'Calculation Method',
              admin: {
                description:
                  'Select the calculation convention your community follows. ISNA is the default in North America.',
              },
              fields: [
                {
                  name: 'method',
                  type: 'select',
                  defaultValue: 'ISNA',
                  label: 'Method',
                  options: [
                    { label: 'ISNA (North America)', value: 'ISNA' },
                    { label: 'Muslim World League', value: 'MWL' },
                    { label: 'Egyptian General Authority', value: 'Egyptian' },
                    { label: 'Umm al-Qura (Makkah)', value: 'UmmAlQura' },
                    { label: 'University of Islamic Sciences, Karachi', value: 'Karachi' },
                    { label: 'Institute of Geophysics, Tehran', value: 'Tehran' },
                    { label: 'Shia Ithna-Ashari, Jafari', value: 'Jafari' },
                  ],
                },
                {
                  name: 'asrMadhab',
                  type: 'select',
                  defaultValue: 'Standard',
                  label: 'Asr Madhab',
                  options: [
                    { label: 'Standard (Shafi/Maliki/Hanbali)', value: 'Standard' },
                    { label: 'Hanafi', value: 'Hanafi' },
                  ],
                },
              ],
            },
          ],
        },
        {
          label: 'Contact',
          description: 'Contact information and social links shown in the footer and About pages.',
          fields: [
            {
              name: 'contactInfo',
              type: 'group',
              label: 'Contact Info',
              admin: {
                hidden: true,
                description: 'Shown in the site footer and the About page.',
              },
              fields: [
                {
                  name: 'phone',
                  type: 'text',
                  label: 'Phone',
                  admin: {
                    placeholder: '(555) 555-5555',
                    components: {
                      Field: '/src/fields/TextField#default',
                    },
                  },
                },
                {
                  name: 'email',
                  type: 'text',
                  label: 'Email',
                  admin: {
                    placeholder: 'info@icprosper.org',
                    components: {
                      Field: '/src/fields/TextField#default',
                    },
                  },
                },
                {
                  name: 'zelle',
                  type: 'text',
                  label: 'Zelle',
                  admin: {
                    description:
                      'Zelle address (email or phone) for donations. Shown in the site footer when set.',
                    placeholder: 'donate@icprosper.org',
                    components: {
                      Field: '/src/fields/TextField#default',
                    },
                  },
                },
                {
                  name: 'address',
                  type: 'textarea',
                  label: 'Address',
                  admin: {
                    description: 'Street address, one line per part (street, city/state/zip).',
                    components: {
                      Field: '/src/fields/TextareaField#default',
                    },
                  },
                },
              ],
            },
            {
              name: 'socialLinks',
              type: 'array',
              label: 'Social Links',
              labels: {
                singular: 'Social Link',
                plural: 'Social Links',
              },
              admin: {
                description:
                  'Links to the masjid\'s social accounts. Rendered as icons in the footer.',
                hidden: true,
              },
              fields: [
                {
                  name: 'platform',
                  type: 'select',
                  required: true,
                  label: 'Platform',
                  options: [
                    { label: 'Facebook', value: 'facebook' },
                    { label: 'Instagram', value: 'instagram' },
                    { label: 'YouTube', value: 'youtube' },
                    { label: 'Twitter / X', value: 'twitter' },
                    { label: 'LinkedIn', value: 'linkedin' },
                  ],
                  admin: {
                    components: {
                      Field: '/src/fields/SelectField#default',
                    },
                  },
                },
                {
                  name: 'url',
                  type: 'text',
                  required: true,
                  label: 'URL',
                  admin: {
                    description: 'Full URL including https://',
                    placeholder: 'https://instagram.com/your-handle',
                    components: {
                      Field: '/src/fields/TextField#default',
                    },
                  },
                },
              ],
            },
            {
              name: 'footerTagline',
              type: 'text',
              label: 'Footer Tagline',
              admin: {
                description:
                  'Optional short phrase shown beneath the logo in the footer, e.g. "Serving Prosper since 2010".',
                placeholder: 'A community rooted in service.',
                hidden: true,
                components: {
                  Field: '/src/fields/TextField#default',
                },
              },
            },
            {
              name: 'footerLegalNote',
              type: 'textarea',
              label: 'Footer Legal Note',
              admin: {
                description:
                  'Legal/tax line shown at the bottom of the footer, e.g. "ACME is a 501(c)(3) tax-exempt nonprofit. Donations are tax-deductible."',
                hidden: true,
                components: {
                  Field: '/src/fields/TextareaField#default',
                },
              },
            },
          ],
        },
        {
          label: 'Account',
          description: 'Lifecycle and signup metadata for this tenant. Hidden from tenant admins.',
          fields: [
            {
              name: 'status',
              type: 'select',
              defaultValue: 'pending',
              label: 'Status',
              options: [
                { label: 'Pending — admin has not yet set their password', value: 'pending' },
                { label: 'Trialing — 14-day free trial in progress', value: 'trialing' },
                { label: 'Active — paid subscription', value: 'active' },
                { label: 'Past Due — payment failed or trial expired', value: 'past_due' },
                { label: 'Canceled — subscription canceled (in grace period)', value: 'canceled' },
                { label: 'Offline — grace period elapsed; public site disabled', value: 'offline' },
                { label: 'Grandfathered — pre-billing tenant; never enforced', value: 'grandfathered' },
              ],
              admin: {
                hidden: true,
                description:
                  'A tenant is "pending" until its admin user signs in for the first time. Pending tenants are subject to auto-cleanup after 7 days.',
              },
              access: { update: platformOwnerFieldUpdate },
            },
            {
              name: 'demoMode',
              type: 'checkbox',
              defaultValue: false,
              label: 'Demo tenant',
              admin: {
                hidden: true,
                description:
                  'Public demo tenant. Routes Stripe to TEST mode, sandboxes email, and is wiped nightly. Never set on a real masjid.',
              },
              access: { update: platformOwnerFieldUpdate },
            },
            {
              name: 'trialEndsAt',
              type: 'date',
              label: 'Trial Ends At',
              admin: {
                hidden: true,
                description:
                  'Recorded at signup (now + 14 days). Not enforced yet — billing/paywall will read this when introduced.',
              },
              access: { update: platformOwnerFieldUpdate },
            },
            {
              name: 'signupMetadata',
              type: 'json',
              label: 'Signup Metadata',
              admin: {
                hidden: true,
                description:
                  'Free-form blob captured at public signup (role, migration source, etc.). Used for analytics, not for product logic.',
              },
              access: { update: platformOwnerFieldUpdate },
            },
          ],
        },
        {
          label: 'Team',
          description: 'People who can sign in to manage this masjid.',
          fields: [
            {
              name: 'teamPanel',
              type: 'ui',
              admin: {
                components: {
                  Field: '/src/admin/TeamPanel#default',
                },
                // Hide the tab entirely for roles that can't manage other users.
                // Staff can only see themselves and kioskManager has even
                // narrower scope — neither has a useful view here.
                condition: (_data, _siblingData, { user }) => {
                  const role = (user as { role?: string } | null | undefined)?.role
                  return role === 'platformOwner' || role === 'admin'
                },
              },
            },
          ],
        },
        {
          label: 'Billing',
          description: 'Subscription, payment method, and invoices.',
          fields: [
            {
              name: 'billingTabIntro',
              type: 'ui',
              admin: {
                components: {
                  Field: '/src/admin/BillingTabIntro#default',
                },
              },
            },
            {
              name: 'subscriptionPlan',
              type: 'select',
              label: 'Plan',
              options: [
                { label: 'Monthly ($49/mo)', value: 'monthly' },
                { label: 'Annual ($490/yr)', value: 'annual' },
                { label: 'Grandfathered (free)', value: 'grandfathered' },
              ],
              admin: { hidden: true, readOnly: true },
              access: { update: platformOwnerFieldUpdate },
            },
            {
              name: 'stripeCustomerId',
              type: 'text',
              admin: { hidden: true, readOnly: true },
              access: { update: platformOwnerFieldUpdate },
            },
            {
              name: 'stripeSubscriptionId',
              type: 'text',
              admin: { hidden: true, readOnly: true },
              access: { update: platformOwnerFieldUpdate },
            },
            {
              name: 'currentPeriodEnd',
              type: 'date',
              admin: { hidden: true, readOnly: true },
              access: { update: platformOwnerFieldUpdate },
            },
            {
              name: 'gracePeriodEndsAt',
              type: 'date',
              admin: {
                hidden: true,
                readOnly: true,
                description:
                  'Set when entering past_due (from trial) or canceled. Public site goes offline after this date.',
              },
              access: { update: platformOwnerFieldUpdate },
            },
          ],
        },
        {
          label: 'Donations',
          description: 'How donations are collected for this masjid.',
          fields: [
            {
              name: 'donationConfig',
              type: 'group',
              label: 'Donation Config',
              admin: {
                description:
                  'Choose how the "Donate" button behaves. Start with an external link; Stripe integration is planned for a future release.',
              },
              fields: [
                {
                  name: 'mode',
                  type: 'select',
                  defaultValue: 'external',
                  label: 'Donation Mode',
                  options: [
                    { label: 'External link (LaunchGood, PayPal, etc.)', value: 'external' },
                    { label: 'Stripe Connect (on-site)', value: 'connect' },
                  ],
                  admin: {
                    description:
                      'External link is the default. Switch to Stripe Connect after connecting your account.',
                    components: {
                      Field: '/src/fields/SelectField#default',
                    },
                  },
                  // Demo tenant's donate button is locked to its seeded Connect
                  // test config; a shared demo admin can't repoint it.
                  access: { update: demoLockedFieldUpdate },
                },
                {
                  name: 'externalUrl',
                  type: 'text',
                  label: 'External Donation URL',
                  admin: {
                    description:
                      'Shown only when Donation Mode is "External link". Full URL to your existing donation page.',
                    placeholder: 'https://launchgood.com/...',
                    condition: (_, siblingData) => siblingData?.mode === 'external',
                    components: {
                      Field: '/src/fields/TextField#default',
                    },
                  },
                  access: { update: demoLockedFieldUpdate },
                },
                {
                  name: 'stripeAccountId',
                  type: 'text',
                  label: 'Stripe Account ID',
                  admin: {
                    hidden: true,
                    readOnly: true,
                    description:
                      'Connected Stripe account ID. Set automatically by the Connect OAuth flow.',
                  },
                  access: { update: platformOwnerFieldUpdate },
                },
                {
                  name: 'stripeAccountConnectedAt',
                  type: 'date',
                  admin: { hidden: true, readOnly: true },
                  access: { update: platformOwnerFieldUpdate },
                },
                {
                  name: 'stripeChargesEnabled',
                  type: 'checkbox',
                  defaultValue: false,
                  admin: { hidden: true, readOnly: true },
                  access: { update: platformOwnerFieldUpdate },
                },
                {
                  name: 'stripePayoutsEnabled',
                  type: 'checkbox',
                  defaultValue: false,
                  admin: { hidden: true, readOnly: true },
                  access: { update: platformOwnerFieldUpdate },
                },
                {
                  name: 'stripeAccountLastSyncedAt',
                  type: 'date',
                  admin: { hidden: true, readOnly: true },
                  access: { update: platformOwnerFieldUpdate },
                },
              ],
            },
          ],
        },
        {
          label: 'Ansari',
          description: "Proactive nudge preferences for Ansari, this masjid's assistant.",
          fields: [
            {
              name: 'ansariSettingsPanel',
              type: 'ui',
              admin: {
                components: {
                  Field: '/src/admin/AnsariSettingsTab#default',
                },
                // Kiosk managers can't read/write ansari-settings; hide the tab.
                condition: (_data, _siblingData, { user }) =>
                  (user as { role?: string } | null | undefined)?.role !== 'kioskManager',
              },
            },
          ],
        },
        {
          label: 'Onboarding',
          description: 'Internal setup-checklist state. Managed by the welcome wizard.',
          fields: [
            {
              name: 'onboarding',
              type: 'group',
              label: 'Milestone State',
              admin: {
                description:
                  'Per-milestone state for the post-login setup wizard. Auto-detected milestones are not stored here; only explicit user actions (skip, mark-complete) are persisted.',
              },
              fields: (() => {
                const SLUG_LABELS = {
                  branding: 'Branding',
                  identity: 'Identity & Contact',
                  prayer: 'Prayer Times',
                  firstEvent: 'First Event',
                  hero: 'Hero & Homepage',
                  donations: 'Donations',
                } as const
                return (
                  ['branding', 'identity', 'prayer', 'firstEvent', 'hero', 'donations'] as const
                ).map((slug) => ({
                  name: slug,
                  type: 'select' as const,
                  label: SLUG_LABELS[slug],
                  options: [
                    { label: 'Complete', value: 'complete' },
                    { label: 'Dismissed', value: 'dismissed' },
                  ],
                  admin: { description: `Explicit user action for the ${slug} milestone.` },
                }))
              })(),
            },
            {
              name: 'onboardingCompletedAt',
              type: 'date',
              admin: {
                description: 'Set when the user dismisses the celebratory screen.',
                readOnly: true,
              },
            },
          ],
        },
      ],
    },
    {
      name: 'kioskBroadcastAt',
      type: 'date',
      label: 'Kiosk Broadcast Timestamp',
      admin: {
        hidden: true,
        description: 'Internal — bumped when admin clicks "Push update to all kiosks".',
      },
    },
  ],
}

export default Tenants
