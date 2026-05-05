/**
 * Renders Organization + SoftwareApplication JSON-LD for the OpenMasjid
 * marketing site. Mirrors the inline-script pattern from
 * `src/app/(site)/_components/MosqueJsonLd.tsx`.
 *
 * Intended for use only on the marketing homepage.
 */
const SITE_URL = 'https://openmasjid.app'
const LOGO_URL = `${SITE_URL}/brand/openmasjid-favicon.svg`
const DESCRIPTION =
  "The masjid website platform that's secure, beautifully designed, and yours to keep. Hosted from $49/mo, or self-host free. Open-source."

export default function OpenMasjidJsonLd() {
  const organization = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'OpenMasjid',
    url: SITE_URL,
    logo: LOGO_URL,
    email: 'hello@openmasjid.app',
    sameAs: ['https://github.com/majidtahir1/open-masjid'],
  }

  const softwareApplication = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'OpenMasjid',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    url: SITE_URL,
    description: DESCRIPTION,
    offers: {
      '@type': 'Offer',
      price: '49',
      priceCurrency: 'USD',
      unitText: 'MONTH',
      url: `${SITE_URL}/pricing`,
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organization) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplication) }}
      />
    </>
  )
}
