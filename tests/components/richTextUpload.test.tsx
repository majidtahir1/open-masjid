import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import RichText from '@/components/RichText'

describe('RichText upload nodes', () => {
  it('renders an <img> for a populated upload node', () => {
    const data = {
      root: {
        children: [
          {
            type: 'upload',
            relationTo: 'media',
            value: { url: '/media/photo.jpg', alt: 'A masjid', width: 800, height: 600 },
          },
        ],
      },
    }
    const html = renderToStaticMarkup(<RichText data={data} />)
    expect(html).toContain('<img')
    expect(html).toContain('src="/media/photo.jpg"')
    expect(html).toContain('alt="A masjid"')
  })

  it('skips an unpopulated upload node (id only) without crashing', () => {
    const data = { root: { children: [{ type: 'upload', value: 123 }] } }
    const html = renderToStaticMarkup(<RichText data={data} />)
    expect(html).not.toContain('<img')
  })

  it('still renders paragraphs (no regression)', () => {
    const data = {
      root: { children: [{ type: 'paragraph', children: [{ type: 'text', text: 'Hello' }] }] },
    }
    const html = renderToStaticMarkup(<RichText data={data} />)
    expect(html).toContain('Hello')
  })
})
