import { PageStub } from '../../_components/PageStub'

export const metadata = { title: 'Blog — OpenMasjid' }

export default function BlogPage() {
  return (
    <PageStub
      current="/blog"
      title="Blog"
      sub="Quarterly product updates, migration playbooks, and notes on building open-source software for masajid. First posts coming soon."
    />
  )
}
