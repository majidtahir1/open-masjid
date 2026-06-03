/**
 * BlogPosting JSON-LD for a single marketing blog post. Mirrors the
 * inline-script pattern in OpenMasjidJsonLd.tsx.
 */
export default function PostJsonLd({
  title,
  description,
  url,
  imageUrl,
  datePublished,
  dateModified,
  author,
}: {
  title: string
  description: string
  url: string
  imageUrl?: string | null
  datePublished?: string | null
  dateModified?: string | null
  author?: string | null
}) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: title,
    description,
    url,
    mainEntityOfPage: url,
    ...(imageUrl ? { image: imageUrl } : {}),
    ...(datePublished ? { datePublished } : {}),
    ...(dateModified ? { dateModified } : {}),
    author: { '@type': 'Organization', name: author || 'OpenMasjid' },
    publisher: {
      '@type': 'Organization',
      name: 'OpenMasjid',
      logo: {
        '@type': 'ImageObject',
        url: 'https://openmasjid.app/brand/openmasjid-favicon.svg',
      },
    },
  }
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}
