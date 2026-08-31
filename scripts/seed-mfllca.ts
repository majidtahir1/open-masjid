import { getPayload } from 'payload'
import config from '../src/payload.config'
import { generateDays } from '../src/lib/generateDays'

const richText = (paragraphs: string[]) => ({
  root: {
    type: 'root',
    children: paragraphs.map((text) => ({
      type: 'paragraph',
      children: [{ type: 'text', text, version: 1 }],
      direction: null,
      format: '',
      indent: 0,
      version: 1,
    })),
    direction: null,
    format: '' as const,
    indent: 0,
    version: 1,
  },
})

async function findOne<T = unknown>(
  payload: Awaited<ReturnType<typeof getPayload>>,
  collection: string,
  where: Record<string, unknown>,
): Promise<T | undefined> {
  const res = await payload.find({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    collection: collection as any,
    where,
    limit: 1,
    overrideAccess: true,
  })
  return res.docs[0] as T | undefined
}

async function deleteAll(
  payload: Awaited<ReturnType<typeof getPayload>>,
  collection: string,
  tenantId: string | number,
) {
  await payload.delete({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    collection: collection as any,
    where: { tenant: { equals: tenantId } },
    overrideAccess: true,
  })
}

async function seed() {
  const payload = await getPayload({ config })

  // Fake req.user so validate hooks that gate on platformOwner succeed during seed
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const seedReq: any = { user: { id: 0, role: 'platformOwner', email: 'seed@seed' } }

  // 1. Tenant (upsert by slug)
  let tenant = await findOne<{ id: string | number }>(payload, 'tenants', {
    slug: { equals: 'mfllca' },
  })
  const tenantData = {
    name: 'MFLLCA',
    slug: 'mfllca',
    siteType: 'masjid' as const,
    status: 'active' as const,
    branding: {
      primaryColor: '#1d5c3a',
      secondaryColor: '#123f28',
      accentColor: '#c9a24b',
      headerArabicLine:
        'أَعُوذُ بِاللهِ مِنَ الشَّيْطَانِ الرَّجِيمِ بِسْمِ اللهِ الرَّحْمَٰنِ الرَّحِيمِ',
    },
    homepageCopy: {
      eventsEyebrow: 'Stay connected',
      eventsHeading: 'Upcoming events',
      eventsSubcopy:
        'Upcoming programs, educational activities, community gatherings, special events, and initiatives.',
      servicesEyebrow: 'Get to know us',
      servicesHeading: 'Our community at a glance',
      servicesSubcopy:
        'Explore the project, our programs, and the many ways to take part.',
      servicesLayout: 'compact' as const,
      donateEyebrow: 'Every contribution makes a difference',
      donateQuote:
        'Together, we can build a welcoming community center that benefits individuals and families for generations to come.',
      donateCitation: '',
      donateButtonLabel: 'Support our project',
    },
    contactInfo: {
      address: 'Serving McKinney, Frisco,\nand surrounding communities',
      phone: '469-739-2300',
      zelle: '469-739-2300',
    },
    footerTagline: 'Learn. Grow. Connect.',
    footerLegalNote:
      'MFLLCA is a 501(c)(3) tax-exempt nonprofit organization. Donations are tax-deductible.',
    location: {
      lat: 33.1976,
      lng: -96.6398,
      timezone: 'America/Chicago',
    },
    prayerCalc: {
      method: 'ISNA' as const,
      asrMadhab: 'Standard' as const,
    },
  }
  if (!tenant) {
    tenant = (await payload.create({
      collection: 'tenants',
      data: tenantData,
      overrideAccess: true,
      req: seedReq,
    })) as { id: string | number }
    console.log('✓ Created MFLLCA tenant')
  } else {
    tenant = (await payload.update({
      collection: 'tenants',
      id: tenant.id,
      data: tenantData,
      overrideAccess: true,
      req: seedReq,
    })) as { id: string | number }
    console.log('✓ Updated MFLLCA tenant')
  }
  const tenantId = tenant.id

  // 2. Media uploads (find by alt + tenant, create if missing)
  async function upsertMedia(alt: string, filePath: string): Promise<string | number> {
    const existing = await findOne<{ id: string | number }>(payload, 'media', {
      and: [{ alt: { equals: alt } }, { tenant: { equals: tenantId } }],
    })
    if (existing) {
      console.log(`✓ Media exists: ${alt}`)
      return existing.id
    }
    const created = (await payload.create({
      collection: 'media',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { alt, tenant: tenantId } as any,
      filePath,
      overrideAccess: true,
      req: seedReq,
    })) as { id: string | number }
    console.log(`✓ Uploaded media: ${alt}`)
    return created.id
  }

  const logoId = await upsertMedia('MFLLCA logo', 'scripts/seed-assets/mfllca-logo.png')
  const buildingId = await upsertMedia(
    'MFLLCA community center building',
    'scripts/seed-assets/mfllca-building.jpeg',
  )

  // Attach logo to tenant branding
  await payload.update({
    collection: 'tenants',
    id: tenantId,
    data: { branding: { ...tenantData.branding, logo: logoId } },
    overrideAccess: true,
    req: seedReq,
  })
  console.log('✓ Attached logo to tenant branding')

  // 3. Pages (upsert by slug) — created before services so a service can link to one
  async function upsertPage(data: Record<string, unknown>): Promise<string | number> {
    const existing = await findOne<{ id: string | number }>(payload, 'pages', {
      and: [{ slug: { equals: data.slug } }, { tenant: { equals: tenantId } }],
    })
    if (existing) {
      const updated = (await payload.update({
        collection: 'pages',
        id: existing.id,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: data as any,
        overrideAccess: true,
        req: seedReq,
      })) as { id: string | number }
      console.log(`✓ Updated page: ${data.slug}`)
      return updated.id
    }
    const created = (await payload.create({
      collection: 'pages',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: data as any,
      overrideAccess: true,
      req: seedReq,
    })) as { id: string | number }
    console.log(`✓ Created page: ${data.slug}`)
    return created.id
  }

  const projectExcerpt =
    'MFLLCA has purchased a property to establish a welcoming community center for education, programs, families, worship, and the entire community.'
  const projectPageId = await upsertPage({
    title: 'Our Community Center Project',
    slug: 'our-community-center-project',
    showInNav: true,
    navOrder: 1,
    featured: false,
    heroExcerpt: projectExcerpt,
    heroAccent: 'gold',
    content: richText([
      projectExcerpt,
      'Our vision is to transform this property into a lasting home where individuals and families can learn, connect, grow, worship, and support one another.',
    ]),
    _status: 'published',
    tenant: tenantId,
  })

  const programsPageId = await upsertPage({
    title: 'Programs & Services',
    slug: 'programs',
    showInNav: true,
    navOrder: 2,
    content: richText([
      'Programs and opportunities designed to serve individuals and families of all ages, including:',
      'Education & Learning — classes and educational programs for learners of every age and level.',
      'Language Learning — language classes that build fluency, confidence, and connection.',
      'Youth Programs — engaging activities and mentorship that help young people grow and thrive.',
      'Family Programs — gatherings and programs that bring families together and strengthen bonds.',
      'Wellness Initiatives — health and wellness activities supporting mind, body, and spirit.',
      'Senior Programs — social and enrichment programs honoring and serving our seniors.',
      'Community Support — assistance and resources for neighbors and families in times of need.',
      'Daily Salah — daily congregational prayers in a welcoming, peaceful space.',
      'Friday Salah — weekly Jummah prayer and khutbah for the whole community.',
    ]),
    _status: 'published',
    tenant: tenantId,
  })

  const getInvolvedPageId = await upsertPage({
    title: 'Get Involved',
    slug: 'get-involved',
    showInNav: true,
    navOrder: 3,
    content: richText([
      'There are many ways to be part of building our future. Volunteer your time, share our mission, connect us with supporters or sponsors, or contribute your skills and expertise.',
    ]),
    _status: 'published',
    tenant: tenantId,
  })

  // 4. Services — delete all, recreate
  await deleteAll(payload, 'services', tenantId)
  const services: Array<Record<string, unknown>> = [
    {
      title: 'Our Community Center Project',
      icon: 'landmark',
      description:
        'MFLLCA has purchased a property to establish a welcoming community center for education, programs, families, and the entire community.',
      linkType: 'page',
      linkPage: projectPageId,
      linkLabel: 'Learn more',
    },
    {
      title: 'Programs & Services',
      icon: 'users',
      description:
        'Programs for all ages including education, language learning, youth, family, wellness, seniors, and community support initiatives.',
      linkType: 'page',
      linkPage: programsPageId,
      linkLabel: 'Explore programs',
    },
    {
      title: 'Why Support Us',
      icon: 'hand-heart',
      description:
        'Your support helps us build a lasting home for our programs and creates opportunities for generations to come.',
      linkType: 'url',
      linkUrl: '/donate',
      linkLabel: 'Make an impact',
    },
    {
      title: 'Upcoming Events',
      icon: 'calendar-days',
      description: 'Stay connected with our upcoming events, programs, and community gatherings.',
      linkType: 'url',
      linkUrl: '/events',
      linkLabel: 'View events',
    },
    {
      title: 'Get Involved',
      icon: 'sprout',
      description:
        'Volunteer your time, share our mission, or connect us with supporters who can help.',
      linkType: 'page',
      linkPage: getInvolvedPageId,
      linkLabel: 'Get involved',
    },
  ]
  for (let i = 0; i < services.length; i++) {
    await payload.create({
      collection: 'services',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: {
        linkType: 'none',
        ...services[i],
        sortOrder: i + 1,
        _status: 'published',
        tenant: tenantId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      overrideAccess: true,
      req: seedReq,
    })
  }
  console.log(`✓ Created ${services.length} services`)

  // 5. Hero slide — delete all, recreate
  await deleteAll(payload, 'hero-slides', tenantId)
  await payload.create({
    collection: 'hero-slides',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: {
      style: 'showcase',
      active: true,
      sortOrder: 1,
      eyebrow: null,
      title: 'Building Our Future.\nTogether.',
      body: 'A welcoming community center dedicated to education, family, wellness, community programs, and meaningful gatherings.\n\nMFLLCA is creating a place where individuals and families can connect, learn, grow, worship, and support one another for generations to come.',
      splitFields: {
        image: buildingId,
        photoLabel: 'MFLLCA community center building',
      },
      ctas: [
        { label: 'Donate now', linkType: 'page', page: '/donate', primary: true },
        { label: 'Our Community Center', linkType: 'url', url: '/our-community-center-project' },
      ],
      _status: 'published',
      tenant: tenantId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    overrideAccess: true,
    req: seedReq,
  })
  console.log('✓ Created hero slide')

  // 6. Events — delete all, recreate
  await deleteAll(payload, 'events', tenantId)
  // No events yet — MFLLCA hasn't started programming. The homepage events
  // section hides itself when a tenant has no upcoming events.
  const events: Array<Record<string, unknown>> = []
  for (const ev of events) {
    await payload.create({
      collection: 'events',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: {
        ...ev,
        description: richText([ev.shortDescription as string]),
        _status: 'published',
        tenant: tenantId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      overrideAccess: true,
      req: seedReq,
    })
  }
  console.log(`✓ Created ${events.length} events`)

  // 7. Prayer schedule — delete all, recreate with generated days
  await deleteAll(payload, 'prayer-schedules', tenantId)
  const location = tenantData.location
  const schedule = {
    name: 'Current Schedule',
    startDate: new Date('2026-08-01T00:00:00Z').toISOString(),
    endDate: new Date('2026-12-31T00:00:00Z').toISOString(),
    iqamahRules: {
      fajr: { mode: 'absolute', absoluteValue: '5:20 AM' },
      zuhr: { mode: 'absolute', absoluteValue: '1:15 PM' },
      asr: { mode: 'absolute', absoluteValue: '4:45 PM' },
      maghrib: { mode: 'absolute', absoluteValue: '7:50 PM' },
      isha: { mode: 'absolute', absoluteValue: '9:15 PM' },
    },
    jummahTimes: [{ time: '1:15 PM' }, { time: '2:00 PM' }],
    notes: 'Special salahs as announced.',
  }
  const days = generateDays({
    startDate: schedule.startDate,
    endDate: schedule.endDate,
    lat: location.lat,
    lng: location.lng,
    timezone: location.timezone,
    method: 'ISNA',
    madhab: 'Standard',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rules: schedule.iqamahRules as any,
  })
  await payload.create({
    collection: 'prayer-schedules',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: { ...schedule, days, tenant: tenantId } as any,
    overrideAccess: true,
    req: seedReq,
  })
  console.log(`✓ Created prayer schedule (${days.length} days generated)`)

  // 8. Donation fund — upsert by slug
  const fundData = {
    tenant: tenantId,
    name: 'Building Fund',
    slug: 'building-fund',
    description: 'Support the purchase and development of our community center.',
    zakatEligible: false,
    sortOrder: 0,
    active: true,
    suggestedAmounts: [{ amount: 25 }, { amount: 50 }, { amount: 100 }, { amount: 500 }],
  }
  const existingFund = await findOne<{ id: string | number }>(payload, 'donation-funds', {
    and: [{ slug: { equals: 'building-fund' } }, { tenant: { equals: tenantId } }],
  })
  if (!existingFund) {
    await payload.create({
      collection: 'donation-funds',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: fundData as any,
      overrideAccess: true,
      req: seedReq,
    })
    console.log('✓ Created Building Fund')
  } else {
    await payload.update({
      collection: 'donation-funds',
      id: existingFund.id,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: fundData as any,
      overrideAccess: true,
      req: seedReq,
    })
    console.log('✓ Updated Building Fund')
  }

  console.log('✓ MFLLCA seed complete')
  process.exit(0)
}

seed().catch((e) => {
  console.error(e)
  process.exit(1)
})
