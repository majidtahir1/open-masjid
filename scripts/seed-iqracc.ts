import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { getPayload } from 'payload'
import config from '../src/payload.config'

/**
 * Seed the Iqra Community Center (McKinney) tenant — a fundraising-first onboard: the masjid
 * is raising money to purchase its future community-center property, so the
 * site leads with the campaign (hero photo + donate) and has NO prayer
 * schedule yet (which also hides the Prayer Times nav + strip).
 *
 * Idempotent — safe to re-run. Mirrors scripts/seed.ts idioms (loosely-typed
 * payload, overrideAccess, fake platformOwner req so validate hooks pass).
 *
 * Spec: docs/superpowers/specs/2026-07-15-mfllca-onboarding-design.md
 */

const SLUG = 'iqracc'
// Bump the filename when the asset changes — media is reused by filename.
const HERO_FILENAME = 'iqracc-building.png'
const __dirname = dirname(fileURLToPath(import.meta.url))
const HERO_PATH = resolve(__dirname, 'seed-assets', 'iqracc', 'property.png')

// ---- Lexical content builders (match scripts/seedBlogIntro.ts) ----
const t = (text: string, format = 0) => ({
  type: 'text', text, detail: 0, format, mode: 'normal', style: '', version: 1,
})
const p = (...children: ReturnType<typeof t>[]) => ({
  type: 'paragraph', children, direction: null, format: '' as const, indent: 0, version: 1,
})
const h2 = (text: string) => ({
  type: 'heading', tag: 'h2', children: [t(text)], direction: null, format: '' as const, indent: 0, version: 1,
})
const lead = (bold: string, rest: string) => p(t(bold, 1), t(rest))
const img = (mediaId: string | number) => ({
  type: 'upload', relationTo: 'media', value: mediaId, fields: null, format: '', version: 1,
})
const doc = (...children: unknown[]) => ({
  root: {
    type: 'root', direction: null, format: '' as const, indent: 0, version: 1,
    children,
  },
})

async function findOne<T = unknown>(
  payload: Awaited<ReturnType<typeof getPayload>>,
  collection: string,
  where: Record<string, unknown>,
): Promise<T | undefined> {
  const res = await payload.find({
     
    collection: collection as any,
    where,
    limit: 1,
    overrideAccess: true,
  })
  return res.docs[0] as T | undefined
}

async function seed() {
  const payload = await getPayload({ config })

  // Fake req.user so validate hooks that gate on platformOwner succeed during seed
   
  const seedReq: any = { user: { id: 0, role: 'platformOwner', email: 'seed@seed' } }

  // 1. Tenant
  const tenantData = {
    name: 'Iqra Community Center',
    slug: SLUG,
    siteType: 'masjid' as const,
    status: 'active' as const,
    branding: {
      primaryColor: '#2E4632', // flyer dark green
      secondaryColor: '#1F2B4D', // flyer navy
      accentColor: '#C9A24B', // flyer gold
      displayFont: 'Fraunces' as const,
    },
    contactInfo: {
      email: 'info@iqracc.com',
      address: 'McKinney, TX',
    },
    footerTagline: 'Building our future. Together.',
    location: { lat: 33.1972, lng: -96.6398, timezone: 'America/Chicago' },
    prayerCalc: { method: 'ISNA' as const, asrMadhab: 'Standard' as const },
    donationConfig: {
      // Local/dev placeholder. Production: the Iqra CC admin completes the
      // Stripe Connect OAuth flow from their admin panel, then mode flips to
      // 'connect' automatically.
      mode: 'external' as const,
      externalUrl: 'https://donate.stripe.com/REPLACE_WITH_IQRACC_PAYMENT_LINK',
    },
  }
  let tenant = await findOne<{ id: string | number }>(payload, 'tenants', {
    slug: { equals: SLUG },
  })
  if (!tenant) {
    tenant = (await payload.create({
      collection: 'tenants',
       
      data: tenantData as any,
      overrideAccess: true,
      req: seedReq,
    })) as { id: string | number }
    console.log('✓ Created Iqra CC tenant')
  } else {
    tenant = (await payload.update({
      collection: 'tenants',
      id: tenant.id,
       
      data: tenantData as any,
      overrideAccess: true,
      req: seedReq,
    })) as { id: string | number }
    console.log('✓ Updated Iqra CC tenant')
  }
  const tenantId = tenant.id

  // 2. Admin user (local dev credentials)
  const adminEmail = 'admin@iqracc.com'
  const existingAdmin = await findOne<{ id: string | number }>(payload, 'users', {
    email: { equals: adminEmail },
  })
  if (!existingAdmin) {
    await payload.create({
      collection: 'users',
      data: {
        email: adminEmail,
        password: 'admin-dev-password',
        role: 'admin',
        tenant: tenantId,
        firstName: 'Iqra CC',
        lastName: 'Admin',
      },
      overrideAccess: true,
      req: seedReq,
    })
    console.log('✓ Created admin user', adminEmail)
  }

  // 3. Hero media (property rendering cropped from the campaign flyer)
  let heroMedia = await findOne<{ id: string | number }>(payload, 'media', {
    and: [{ filename: { equals: HERO_FILENAME } }, { tenant: { equals: tenantId } }],
  })
  if (!heroMedia) {
    const data = readFileSync(HERO_PATH)
    heroMedia = (await payload.create({
      collection: 'media' as never,
      file: { data, mimetype: 'image/png', name: HERO_FILENAME, size: data.length },
      data: {
        alt: 'Rendering of the future Iqra Community Center property in McKinney',
        tenant: tenantId,
      },
      overrideAccess: true,
      req: seedReq,
    })) as { id: string | number }
    console.log('✓ Uploaded hero media')
  }

  // 4. Hero slide — split layout: campaign copy left, crisp building photo
  //    card right (no dark overlay; the iqamah card is skipped automatically
  //    because the tenant has no prayer schedule).
  await payload.delete({
    collection: 'hero-slides',
    where: { tenant: { equals: tenantId } },
    overrideAccess: true,
    req: seedReq,
  })
  await payload.create({
    collection: 'hero-slides',
    data: {
      eyebrow: 'Iqra Community Center Project · McKinney, TX',
      title: 'Building our future. Together.',
      body:
        'Iqra Community Center is working to purchase this property to establish a welcoming space dedicated to community programs, education, wellness, family support, and meaningful gatherings.',
      style: 'split' as const,
      background: 'brand' as const,
      accent: 'cream' as const,
      splitFields: {
        cardTag: 'McKinney, TX',
        cardTitle: 'Our future home',
        photoLabel: '1 mile from Stonebridge Ranch',
        image: heroMedia.id,
      },
      ctas: [
        { label: 'Donate now', linkType: 'page' as const, page: '/donate', primary: true },
        { label: 'Learn more & sign up', linkType: 'url' as const, url: '/forms/stay-connected' },
      ],
      sortOrder: 1,
      _status: 'published',
      tenant: tenantId,
    },
    overrideAccess: true,
    req: seedReq,
  })
  console.log('✓ Created hero slide')

  // 5. Services — their planned programs
  await payload.delete({
    collection: 'services',
    where: { tenant: { equals: tenantId } },
    overrideAccess: true,
    req: seedReq,
  })
  const services = [
    {
      title: 'Youth Mentoring & Counseling',
      icon: 'users',
      description:
        'Counseling, mentoring, and character-building programs for teenagers and young adults.',
    },
    {
      title: 'Language Classes',
      icon: 'languages',
      description:
        'Conversational Arabic, Spanish, French, and German — plus English instruction and public speaking.',
    },
    {
      title: 'Educational Seminars',
      icon: 'graduation-cap',
      description:
        'Seminars on financial literacy, home buying, career readiness, and personal development.',
    },
    {
      title: 'Family & Pre-Marital Counseling',
      icon: 'heart-handshake',
      description:
        'Family counseling, pre-marital counseling, and support for families at every stage.',
    },
  ]
  for (let i = 0; i < services.length; i++) {
    await payload.create({
      collection: 'services',
      data: { ...services[i], sortOrder: i + 1, _status: 'published', tenant: tenantId },
      overrideAccess: true,
      req: seedReq,
    })
  }
  console.log(`✓ Created ${services.length} services`)

  // 6. Donation fund — the campaign fund, first in the list.
  //    (Sadaqah/Zakat defaults are auto-seeded by the tenant afterChange hook.)
  const fundData = {
    tenant: tenantId,
    name: 'Community Center Project',
    slug: 'community-center-project',
    description:
      'Help us secure the purchase of our future home — a 4,431 SF building on 2.02 acres in McKinney.',
    zakatEligible: false,
    sortOrder: -1,
    active: true,
    suggestedAmounts: [{ amount: 50 }, { amount: 100 }, { amount: 500 }, { amount: 1000 }],
  }
  const existingFund = await findOne<{ id: string | number }>(payload, 'donation-funds', {
    and: [{ tenant: { equals: tenantId } }, { slug: { equals: 'community-center-project' } }],
  })
  if (existingFund) {
    await payload.update({
      collection: 'donation-funds',
      id: existingFund.id,
       
      data: fundData as any,
      overrideAccess: true,
      req: seedReq,
    })
  } else {
    await payload.create({
      collection: 'donation-funds',
       
      data: fundData as any,
      overrideAccess: true,
      req: seedReq,
    })
  }
  console.log('✓ Created Community Center Project fund')

  // 7. Project page — the subpage they keep updating with progress
  const pageContent = doc(
    img(heroMedia.id),
    p(
      t(
        'Iqra Community Center is working to purchase a property in McKinney to establish a lasting home for our community — a welcoming space dedicated to community programs, education, wellness, family support, and meaningful gatherings.',
      ),
    ),
    h2('The property'),
    lead('Location: ', 'McKinney, TX — about one mile from The Clubs of Stonebridge Ranch.'),
    lead('Building: ', '4,431 SF on a 2.02-acre lot.'),
    lead('Zoning: ', 'Commercially zoned for office, childcare, learning center, and church use.'),
    lead('Purchase price: ', '$1.2 million.'),
    h2('What your support makes possible'),
    p(t('Secure the property purchase. Preserve and improve the facility. Create spaces for youth, families, and seniors. Expand educational and community programs. Build a long-term home for Iqra Community Center initiatives.')),
    h2('Timeline & progress'),
    lead('Summer 2026 — ', 'Fundraising campaign underway. Every contribution brings us closer to securing the property.'),
    p(t('Updates will be posted here as we reach each milestone, insha’Allah.')),
    h2('Ways to give'),
    lead('Online: ', 'Use the Donate button above to give securely by card.'),
    lead('Zelle: ', '469-235-7674.'),
    p(t('Your generosity today helps create opportunities and a better tomorrow for generations to come.')),
  )
  const pageData = {
    title: 'Community Center Project',
    slug: 'project',
    content: pageContent,
    showInNav: true,
    _status: 'published',
    tenant: tenantId,
  }
  const existingPage = await findOne<{ id: string | number }>(payload, 'pages', {
    and: [{ tenant: { equals: tenantId } }, { slug: { equals: 'project' } }],
  })
  if (existingPage) {
    await payload.update({
      collection: 'pages',
      id: existingPage.id,
       
      data: pageData as any,
      overrideAccess: true,
      req: seedReq,
    })
  } else {
    await payload.create({
      collection: 'pages',
       
      data: pageData as any,
      overrideAccess: true,
      req: seedReq,
    })
  }
  console.log('✓ Created Community Center Project page')

  // 8. "Stay Connected" signup form
  const formSchema = {
    steps: [
      {
        id: 's1',
        fields: [
          { id: 'f1', type: 'short-text', name: 'full_name', label: 'Full name', required: true },
          { id: 'f2', type: 'email', name: 'email', label: 'Email', required: true },
          { id: 'f3', type: 'phone', name: 'phone', label: 'Phone', required: false },
          {
            id: 'f4',
            type: 'checkbox-group',
            name: 'programs',
            label: 'Which programs interest you?',
            required: false,
            options: [
              { value: 'youth', label: 'Youth mentoring & counseling' },
              { value: 'languages', label: 'Language classes (Arabic, Spanish, French, German)' },
              { value: 'seminars', label: 'Educational seminars' },
              { value: 'counseling', label: 'Family & pre-marital counseling' },
              { value: 'volunteering', label: 'Volunteering' },
            ],
          },
          {
            id: 'f5',
            type: 'long-text',
            name: 'message',
            label: 'Anything you’d like us to know?',
            required: false,
          },
        ],
      },
    ],
  }
  const formData = {
    title: 'Stay Connected',
    slug: 'stay-connected',
    status: 'published' as const,
    description: doc(
      p(
        t(
          'Want to follow the Community Center Project and hear when programs launch? Leave your details and we’ll keep you posted.',
        ),
      ),
    ),
    schema: formSchema,
    settings: {
      submitButtonLabel: 'Sign me up',
      successMessage: doc(
        p(t('JazakAllahu khairan — you’re on the list. We’ll be in touch with project updates.')),
      ),
    },
    tenant: tenantId,
  }
  const existingForm = await findOne<{ id: string | number }>(payload, 'forms', {
    and: [{ tenant: { equals: tenantId } }, { slug: { equals: 'stay-connected' } }],
  })
  if (existingForm) {
    await payload.update({
      collection: 'forms',
      id: existingForm.id,
       
      data: formData as any,
      overrideAccess: true,
      req: seedReq,
    })
  } else {
    await payload.create({
      collection: 'forms',
       
      data: formData as any,
      overrideAccess: true,
      req: seedReq,
    })
  }
  console.log('✓ Created Stay Connected form')

  console.log('\nDone. Visit http://iqracc.localhost:3000')
  console.log('Admin: http://iqracc.localhost:3000/admin —', adminEmail, '/ admin-dev-password')
  process.exit(0)
}

seed().catch((err) => {
  console.error(err)
  process.exit(1)
})
