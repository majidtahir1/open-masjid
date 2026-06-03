/**
 * Seed (or update) the "Meet Ansari" marketing blog post.
 *
 * Idempotent: upserts by title, so re-running fixes an existing post with the
 * same title (e.g. one pasted by hand) rather than creating a duplicate, and
 * normalises its slug to `meet-ansari`. No hero image.
 *
 *   Local:  node --env-file=.env --import tsx scripts/seedAnsariPost.ts
 *   Prod:   run inside the migrate container (see PR description / README).
 */
import { getPayload } from 'payload'
import config from '../src/payload.config'

const TITLE = 'Meet Ansari: run your masjid by talking to it'
const SLUG = 'meet-ansari'

// ---- Lexical builders (match scripts/seedBlogIntro.ts) ----
const t = (text: string, format = 0) => ({
  type: 'text', text, detail: 0, format, mode: 'normal', style: '', version: 1,
})
const p = (...children: ReturnType<typeof t>[]) => ({
  type: 'paragraph', children, direction: null, format: '' as const, indent: 0, version: 1,
})
const h2 = (text: string) => ({
  type: 'heading', tag: 'h2', children: [t(text)], direction: null, format: '' as const, indent: 0, version: 1,
})
const ul = (...texts: string[]) => ({
  type: 'list', listType: 'bullet' as const, start: 1, tag: 'ul' as const,
  direction: null, format: '' as const, indent: 0, version: 1,
  children: texts.map((txt, i) => ({
    type: 'listitem', children: [t(txt)], direction: null, format: '' as const,
    indent: 0, version: 1, value: i + 1,
  })),
})

const content = {
  root: {
    type: 'root', direction: null, format: '' as const, indent: 0, version: 1,
    children: [
      p(t("Most masjid software hands you a dashboard and wishes you luck. You learn where the prayer times live, which tab hides the announcements, how to schedule an event, and then you hope the next volunteer learns it too. Ansari is our answer to that. It is an AI assistant built into OpenMasjid, and it lets you run the masjid by simply asking.")),

      h2('If you can say it, Ansari can do it'),
      p(t('Tell Ansari what you want in plain language and it does the work:')),
      ul(
        '"Push Fajr iqamah to 5:45 starting tomorrow." Ansari shows you the exact change, you confirm, and it is live.',
        '"Put up a notice: Janazah after Dhuhr today, main hall." It posts to your website and your lobby screens, sets a sensible expiry, and asks if that looks right.',
        '"Turn this flyer into an event." Hand it an image and it reads the date, time, and details and builds the event for you.',
        '"How many new members joined this month?" or "How is the building fund doing?" It answers from your real data, not a guess.',
      ),
      p(t('There is no menu to hunt through and no manual to read.')),

      h2('Why this is different'),
      p(t('Plenty of products have bolted a chatbot onto their settings page. Most of them can only talk: they explain where a button is, then leave you to click it. Ansari is not that. It is wired into the actual platform, with the same permissions and guardrails as the admin, so it can carry a task all the way to done.')),
      p(t('That is the real differentiator. Other masjid websites turn a volunteer into a part-time software operator. Ansari removes that job. A board member with ten minutes between maghrib and isha can update the schedule, post a janazah notice, or check the month’s numbers without ever learning an interface. The barrier to helping drops to nearly zero, which matters when the people running the masjid are volunteers with day jobs and families.')),

      h2('It watches the masjid so you do not have to'),
      p(t('Ansari does not only wait for instructions. It keeps an eye on things and speaks up before they become problems. If your prayer schedule only covers through the end of the month, it tells you while there is still time to fix it. You hear about issues early, not from a confused congregant after Fajr.')),

      h2('Safe by design'),
      p(t('Letting an assistant make changes only works if you trust it, so Ansari is built to keep you in control. It shows you the exact change before it applies anything and waits for your confirmation. It works within scoped permissions, so it only touches what you allow. Nothing happens behind your back. You get the speed of just asking, without giving up oversight.')),

      h2('The point'),
      p(t('Running a masjid should not require a course in someone’s software. Prayer times change, a brother passes away and the janazah has to be announced within the hour, the youth program needs a flyer turned into a sign-up. Ansari lets a volunteer handle all of it in the time it takes to send a text message. That is time given back to the community, which is where it belonged all along.')),
    ],
  },
}

async function run() {
  const payload = await getPayload({ config })

  const found = await payload.find({
    collection: 'posts' as never,
    where: { title: { equals: TITLE } },
    limit: 1,
    overrideAccess: true,
  })

  const data = {
    title: TITLE,
    slug: SLUG,
    kind: 'article',
    author: 'OpenMasjid Team',
    tags: [{ tag: 'ansari' }, { tag: 'ai' }, { tag: 'features' }],
    content,
    _status: 'published',
  }

  if (found.docs[0]) {
    const id = (found.docs[0] as { id: string | number }).id
    await payload.update({ collection: 'posts' as never, id, data, overrideAccess: true })
    console.log('updated post', id, SLUG)
  } else {
    const created = await payload.create({ collection: 'posts' as never, data, overrideAccess: true })
    console.log('created post', (created as { id: string | number }).id, SLUG)
  }
  console.log('done.')
  process.exit(0)
}

run().catch((err) => { console.error(err); process.exit(1) })
