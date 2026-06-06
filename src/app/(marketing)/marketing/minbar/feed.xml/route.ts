import { fetchPosts, extractExcerpt } from '@/lib/blog'
import { getRequestOrigin } from '@/lib/seo'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export async function GET() {
  const { origin } = await getRequestOrigin()
  const posts = await fetchPosts({ kind: 'article', limit: 50 })

  const items = posts
    .map((p) => {
      const url = `${origin}/minbar/${p.slug ?? ''}`
      const parsed = p.publishedAt ? new Date(p.publishedAt) : null
      const date = parsed && !Number.isNaN(parsed.getTime()) ? parsed.toUTCString() : ''
      return `    <item>
      <title>${escapeXml(p.title ?? '')}</title>
      <link>${escapeXml(url)}</link>
      <guid isPermaLink="true">${escapeXml(url)}</guid>
      ${date ? `<pubDate>${date}</pubDate>` : ''}
      <description>${escapeXml(extractExcerpt(p.content))}</description>
    </item>`
    })
    .join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>The Minbar — OpenMasjid</title>
    <link>${escapeXml(`${origin}/minbar`)}</link>
    <description>Thoughts on OpenMasjid, tech, and the Ummah.</description>
${items}
  </channel>
</rss>`

  return new Response(xml, {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
  })
}
