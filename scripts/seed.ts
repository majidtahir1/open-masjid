import { getPayload } from 'payload'
import config from '../src/payload.config'

const richText = (text: string) => ({
  root: {
    type: 'root',
    children: [
      {
        type: 'paragraph',
        children: [{ type: 'text', text, version: 1 }],
        direction: null,
        format: '',
        indent: 0,
        version: 1,
      },
    ],
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

  // 1. Platform owner user
  const platformEmail = 'platform@openmasjid.app'
  const existingPlatform = await findOne<{ id: string | number }>(
    payload,
    'users',
    { email: { equals: platformEmail } },
  )
  if (!existingPlatform) {
    await payload.create({
      collection: 'users',
      data: {
        email: platformEmail,
        password: 'platform-dev-password',
        role: 'platformOwner',
      },
      overrideAccess: true,
      req: seedReq,
    })
    console.log('✓ Created platform owner')
  } else {
    console.log('✓ Platform owner exists')
  }

  // 2. ICP tenant
  let icp = await findOne<{ id: string | number }>(payload, 'tenants', {
    slug: { equals: 'icp' },
  })
  const icpData = {
    name: 'Islamic Center of Prosper',
    slug: 'icp',
    customDomains: [{ domain: 'icprosper.org' }],
    siteType: 'masjid' as const,
    branding: {
      primaryColor: '#0F1E4A',
      secondaryColor: '#28A0B4',
      accentColor: '#F0C88C',
      displayFont: 'Fraunces' as const,
    },
    contactInfo: {
      phone: '+1 (469) 491-0825',
      email: 'info@icpcmasjid.org',
      address: '861 N Coleman St, Suite 190, Prosper, TX 75078',
    },
    socialLinks: [
      { platform: 'facebook' as const, url: 'https://www.facebook.com/icprosper' },
      { platform: 'instagram' as const, url: 'https://www.instagram.com/icprosper' },
      { platform: 'youtube' as const, url: 'https://www.youtube.com/@icprosper' },
    ],
    donationConfig: {
      mode: 'external' as const,
      externalUrl: 'https://icpcmasjid.org/donate',
    },
    footerTagline: 'A community built on knowledge, tarbiya, and prayer',
  }
  if (!icp) {
    icp = (await payload.create({
      collection: 'tenants',
      data: icpData,
      overrideAccess: true,
      req: seedReq,
    })) as { id: string | number }
    console.log('✓ Created ICP tenant')
  } else {
    icp = (await payload.update({
      collection: 'tenants',
      id: icp.id,
      data: icpData,
      overrideAccess: true,
      req: seedReq,
    })) as { id: string | number }
    console.log('✓ Updated ICP tenant')
  }
  const tenantId = icp.id

  // 3. Admin user
  const adminEmail = 'admin@icprosper.org'
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
      },
      overrideAccess: true,
      req: seedReq,
    })
    console.log('✓ Created admin user')
  } else {
    console.log('✓ Admin user exists')
  }

  // 4. Services — delete all, recreate
  await deleteAll(payload, 'services', tenantId)
  const services = [
    {
      title: 'New Muslims (Ansar)',
      icon: 'hand-heart',
      description: 'Mentorship and resources for new Muslims navigating their journey.',
    },
    {
      title: 'Funeral Services',
      icon: 'heart',
      description: 'Complete janazah support including ghusl, shrouding, and burial coordination.',
    },
    {
      title: 'Nikah',
      icon: 'users',
      description: 'Marriage officiation and pre-marital counseling by the imam.',
    },
    {
      title: 'Medical Aid',
      icon: 'stethoscope',
      description: 'Connecting community members with medical care and resources.',
    },
    {
      title: 'Legal Aid',
      icon: 'scale',
      description: 'Referrals to volunteer attorneys for community members in need.',
    },
    {
      title: 'Financial Aid',
      icon: 'hand-coins',
      description: 'Zakat and sadaqah-funded support for families facing hardship.',
    },
  ]
  for (let i = 0; i < services.length; i++) {
    await payload.create({
      collection: 'services',
      data: { ...services[i], sortOrder: i + 1, tenant: tenantId },
      overrideAccess: true,
      req: seedReq,
    })
  }
  console.log(`✓ Created ${services.length} services`)

  // 5. Hero slides — delete all, recreate
  await deleteAll(payload, 'hero-slides', tenantId)
  const heroSlides = [
    {
      eyebrow: 'Islamic Center of Prosper',
      title: 'A community built on knowledge, tarbiya, and prayer.',
      body: 'Young, growing, rooted. Serving Muslim families in Prosper and Celina, Texas since 2021.',
      accent: 'cream' as const,
      ctas: [
        { label: 'About us', linkType: 'page' as const, page: '/about', primary: true },
        { label: 'Events', linkType: 'page' as const, page: '/events' },
      ],
      sortOrder: 1,
    },
    {
      eyebrow: 'Weekly class',
      title: 'Evidences of Islam',
      body: 'Strengthen your Iman with a weekly study of the evidences of our faith.',
      accent: 'teal' as const,
      meta: 'Mondays after Isha',
      ctas: [
        { label: 'Learn more', linkType: 'page' as const, page: '/events', primary: true },
      ],
      sortOrder: 2,
    },
    {
      eyebrow: 'Giving',
      title: 'Zakat & Sadaqah',
      body: 'Your giving keeps our doors open.',
      accent: 'gold' as const,
      ctas: [
        { label: 'Give now', linkType: 'page' as const, page: '/donate', primary: true },
      ],
      sortOrder: 3,
    },
  ]
  for (const slide of heroSlides) {
    await payload.create({
      collection: 'hero-slides',
      data: { ...slide, tenant: tenantId },
      overrideAccess: true,
      req: seedReq,
    })
  }
  console.log(`✓ Created ${heroSlides.length} hero slides`)

  // 6. Events
  await deleteAll(payload, 'events', tenantId)
  const events = [
    {
      title: 'Evidences of Islam',
      slug: 'evidences-of-islam',
      shortDescription: 'A weekly class exploring the evidences of our deen.',
      tag: 'weekly-class' as const,
      when: 'Mondays after Isha',
      displayMode: 'text' as const,
      location: 'Main prayer hall',
      audience: ['families' as const, 'all' as const],
    },
    {
      title: 'Community Iftar',
      slug: 'community-iftar',
      shortDescription: 'Break your fast with the community every Wednesday during Ramadan.',
      tag: 'ramadan' as const,
      when: 'Every Wed · 7:30 pm',
      displayMode: 'template' as const,
      templateVariant: 'navy' as const,
      location: 'Main hall',
      audience: ['families' as const, 'all' as const],
    },
    {
      title: 'Sisters Halaqa',
      slug: 'sisters-halaqa',
      shortDescription: 'Weekly sisters-only gathering for learning and community.',
      tag: 'sisters' as const,
      when: 'Saturdays 11am',
      displayMode: 'text' as const,
      location: "Sisters' hall",
      audience: ['sisters' as const],
    },
    {
      title: 'Youth Game Night',
      slug: 'youth-game-night',
      shortDescription: 'Board games, snacks, and good company for the youth.',
      tag: 'youth' as const,
      when: 'Fri Nov 8, 7pm',
      displayMode: 'text' as const,
      location: 'Community room',
      audience: ['youth' as const],
    },
  ]
  for (const ev of events) {
    await payload.create({
      collection: 'events',
      data: {
        ...ev,
        description: richText(ev.shortDescription),
        status: 'published' as const,
        tenant: tenantId,
      },
      overrideAccess: true,
      req: seedReq,
    })
  }
  console.log(`✓ Created ${events.length} events`)

  // 7. Prayer times — 7 days starting today
  await deleteAll(payload, 'prayer-times', tenantId)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  for (let d = 0; d < 7; d++) {
    const date = new Date(today)
    date.setDate(today.getDate() + d)
    await payload.create({
      collection: 'prayer-times',
      data: {
        date: date.toISOString(),
        fajrAdhan: '5:30 AM',
        fajrIqamah: '5:45 AM',
        zuhrAdhan: '1:30 PM',
        zuhrIqamah: '1:45 PM',
        asrAdhan: '5:00 PM',
        asrIqamah: '5:15 PM',
        maghribAdhan: 'at sunset',
        maghribIqamah: 'sunset + 5 min',
        ishaAdhan: '9:15 PM',
        ishaIqamah: '9:30 PM',
        jummahTimes: [{ time: '12:45 PM' }, { time: '1:30 PM' }, { time: '2:15 PM' }],
        notes: d === 0 ? 'Taraweeh 9:45pm' : undefined,
        source: 'manual' as const,
        tenant: tenantId,
      },
      overrideAccess: true,
      req: seedReq,
    })
  }
  console.log('✓ Created 7 days of prayer times')

  console.log('✓ Seed complete')
  process.exit(0)
}

seed().catch((e) => {
  console.error(e)
  process.exit(1)
})
