import type { Metadata } from 'next'

import { MarketingShell } from '../../_components/MarketingShell'
import RichText from '@/components/RichText'
import { fetchPosts, type PostRecord } from '@/lib/blog'

const TITLE = 'Changelog — OpenMasjid'
const DESCRIPTION = "What's new in OpenMasjid — features, fixes, and improvements as they ship."

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/changelog' },
  openGraph: { title: TITLE, description: DESCRIPTION, url: '/changelog', type: 'website' },
  twitter: { title: TITLE, description: DESCRIPTION },
}

function formatDate(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

export default async function ChangelogPage() {
  const entries = await fetchPosts({ kind: 'changelog' })

  return (
    <MarketingShell current="/changelog">
      <section className="om-section-lg">
        <div className="om-container om-blog-article">
          <p className="om-eyebrow">Changelog</p>
          <h1 className="om-h">What&apos;s new</h1>
          <p className="om-lede">{DESCRIPTION}</p>

          {entries.length === 0 ? (
            <p className="om-blog-empty">No changelog entries yet.</p>
          ) : (
            <div style={{ marginTop: 40 }}>
              {entries.map((entry) => (
                <ChangelogEntry key={String(entry.id)} entry={entry} />
              ))}
            </div>
          )}
        </div>
      </section>
    </MarketingShell>
  )
}

function ChangelogEntry({ entry }: { entry: PostRecord }) {
  return (
    <div className="om-changelog-entry">
      <div className="om-blog-meta">
        <span>{formatDate(entry.publishedAt)}</span>
        {entry.version ? <span className="om-changelog-ver">{entry.version}</span> : null}
      </div>
      <h2 className="om-blog-card-title" style={{ marginTop: 6 }}>{entry.title}</h2>
      <RichText data={entry.content} className="om-prose" />
    </div>
  )
}
