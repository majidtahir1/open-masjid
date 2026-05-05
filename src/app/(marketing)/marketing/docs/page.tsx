import { PageStub } from '../../_components/PageStub'

const TITLE = 'Docs — OpenMasjid'
const DESCRIPTION =
  'Setup, admin guide, branding, custom domain, and self-hosting. Living documentation, edited in the open on GitHub.'

export const metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/docs' },
  openGraph: { title: TITLE, description: DESCRIPTION, url: '/docs', type: 'website' },
  twitter: { title: TITLE, description: DESCRIPTION },
}

export default function DocsPage() {
  return (
    <PageStub
      current="/docs"
      title="Docs"
      sub="Setup, admin guide, branding, custom domain, self-hosting. Living documentation, edited in the open on GitHub."
    />
  )
}
