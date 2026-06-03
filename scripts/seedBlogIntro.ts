/**
 * Seed (or update) the "Introducing OpenMasjid" marketing blog post.
 *
 * Idempotent: re-running upserts the post by slug and reuses the hero media by
 * filename, so it is safe to run against any environment.
 *
 *   Local:  node --env-file=.env       --import tsx scripts/seedBlogIntro.ts
 *   Prod:   node --env-file=.env.prod  --import tsx scripts/seedBlogIntro.ts
 *
 * IMPORTANT (prod): media files are stored on local disk (public/media), so run
 * this INSIDE the prod environment (e.g. the deployed container) — not from a
 * laptop pointed at the prod DB — or the uploaded file won't land in prod
 * storage. Requires the Posts collection to be deployed and migrated first.
 */
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import { getPayload } from 'payload'
import config from '../src/payload.config'

const SLUG = 'introducing-openmasjid'
const HERO_FILENAME = 'openmasjid-intro-hero.png'

const __dirname = dirname(fileURLToPath(import.meta.url))
const HERO_PATH = resolve(__dirname, 'seed-assets', HERO_FILENAME)

// ---- Lexical content builders (match scripts/seed.ts conventions) ----
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

const content = {
  root: {
    type: 'root', direction: null, format: '' as const, indent: 0, version: 1,
    children: [
      p(t("Every masjid runs on the quiet work of volunteers. Someone updates the prayer times each month. Someone posts the Jumu'ah announcement, sets up the fundraiser, and fixes the website when a plugin breaks the night before Ramadan. OpenMasjid exists to make that work lighter, and to make sure the masjid actually owns what it builds.")),
      h2('Why we built it'),
      p(t('Most masajid end up on one of two paths. The first is a pile of WordPress plugins held together by whoever last had time to look at it. It works until it does not. A plugin goes unmaintained, a vulnerability gets exploited, and a volunteer loses a weekend cleaning up spam instead of being with their family. The second path is a closed vendor that charges every month, keeps your data on their terms, and leaves you stuck the day you want to move.')),
      p(t('We thought the masjid deserved better than both. Prayer times are not a hard problem. Neither are events, donations, or a lobby screen. What is hard is doing all of it securely, keeping it simple enough for a rotating set of volunteers, and never holding the community’s own data hostage.')),
      h2('What it does'),
      p(t('OpenMasjid is a complete website and operations platform for a masjid. Prayer times with iqamah rules you set once for the year. Events and flyers with RSVPs and payments. Native donations through Stripe for Sadaqah, Zakat, and the building fund. Kiosk displays for the lobby that you pair in under a minute, where saving a change broadcasts it straight to the screen. Membership, forms, announcements, and full control of your branding: your colors, your logo, your font.')),
      h2('What makes it different'),
      lead('It is open source. ', 'The code is public, you can read every line, and if you ever want to leave the hosted version you can run the exact same software yourself for free. Nothing about your masjid is locked inside someone else’s account.'),
      lead('It is secure by design. ', 'There is no plugin marketplace and no sprawling attack surface to patch. Fewer moving parts means fewer ways for things to break or get compromised, which matters a great deal when the people maintaining it are volunteers and not a security team.'),
      lead('It is built by people who understand the work. ', 'We are Muslims who have set up the prayer schedule, chased down a donation receipt, and stood in the lobby wondering why the TV froze. The product is shaped by that, not by a feature list written from the outside.'),
      lead('It is built to be run with help. ', 'OpenMasjid is designed so you can manage it by talking to it. Updating prayer times, turning a flyer into an event, putting up an announcement: these can be done through an AI assistant that handles the tedious parts, so a volunteer with ten minutes can still get something done.'),
      h2('Where we are going'),
      p(t('This is the first of many posts. We will share product updates, the occasional technical write-up on how the platform is built, and practical notes for the brothers and sisters who keep our masajid running. If you want to try it, you can claim a free subdomain and have a real site up in an afternoon. If you would rather host it yourself, the code is waiting for you.')),
      p(t('May Allah accept the work of everyone who serves His houses, and make this a small means of easing it.')),
    ],
  },
}

async function run() {
  const payload = await getPayload({ config })

  // 1. Upsert the hero media (platform-owned, no tenant) by filename.
  const existingMedia = await payload.find({
    collection: 'media' as never,
    where: { filename: { equals: HERO_FILENAME } },
    limit: 1,
    overrideAccess: true,
  })
  let heroId: string | number
  if (existingMedia.docs[0]) {
    heroId = (existingMedia.docs[0] as { id: string | number }).id
    console.log('reusing existing hero media', heroId)
  } else {
    const data = readFileSync(HERO_PATH)
    const media = await payload.create({
      collection: 'media' as never,
      file: { data, mimetype: 'image/png', name: HERO_FILENAME, size: data.length },
      data: { alt: 'OpenMasjid logo' }, // no tenant — platform-owned
      overrideAccess: true,
    })
    heroId = (media as { id: string | number }).id
    console.log('created hero media', heroId)
  }

  // 2. Upsert the post by slug.
  const found = await payload.find({
    collection: 'posts' as never,
    where: { slug: { equals: SLUG } },
    limit: 1,
    overrideAccess: true,
  })

  const dataBase = {
    title: 'Introducing OpenMasjid',
    kind: 'article',
    author: 'OpenMasjid Team',
    tags: [{ tag: 'announcement' }, { tag: 'open source' }],
    heroImage: heroId,
    content,
    _status: 'published',
  }

  if (found.docs[0]) {
    const id = (found.docs[0] as { id: string | number }).id
    await payload.update({ collection: 'posts' as never, id, data: dataBase, overrideAccess: true })
    console.log('updated post', id, SLUG)
  } else {
    const created = await payload.create({
      collection: 'posts' as never,
      data: { ...dataBase, slug: SLUG },
      overrideAccess: true,
    })
    console.log('created post', (created as { id: string | number }).id, SLUG)
  }

  console.log('done.')
  process.exit(0)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
