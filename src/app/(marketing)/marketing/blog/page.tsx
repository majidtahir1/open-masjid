import { PageStub } from '../../_components/PageStub'

const TITLE = 'Blog — OpenMasjid'
const DESCRIPTION =
  'Quarterly product updates, migration playbooks, and notes on building open-source software for masajid.'

export const metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/blog' },
  openGraph: { title: TITLE, description: DESCRIPTION, url: '/blog', type: 'website' },
  twitter: { title: TITLE, description: DESCRIPTION },
}

export default function BlogPage() {
  return (
    <PageStub
      current="/blog"
      title="Blog"
      sub="Quarterly product updates, migration playbooks, and notes on building open-source software for masajid. First posts coming soon."
    />
  )
}
