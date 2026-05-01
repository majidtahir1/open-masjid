import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import DonateForm from '@/components/DonateForm'

describe('DonateForm smoke render', () => {
  it('renders the fund picker, amount picker, and submit button', () => {
    const html = renderToStaticMarkup(
      <DonateForm
        funds={[
          {
            id: 1,
            name: 'General Fund',
            description: 'Operating expenses',
            zakatEligible: false,
            suggestedAmounts: [{ amount: 25 }, { amount: 50 }, { amount: 100 }],
          },
          {
            id: 2,
            name: 'Zakat',
            zakatEligible: true,
            suggestedAmounts: [{ amount: 100 }],
          },
        ]}
      />,
    )
    expect(html).toContain('Choose a fund')
    expect(html).toContain('General Fund')
    expect(html).toContain('Zakat')
    expect(html).toContain('Choose an amount')
    expect(html).toContain('Frequency')
    expect(html).toContain('One-time')
    expect(html).toContain('Monthly')
    expect(html).toContain('Give $')
  })

  it('renders default suggested amounts when fund has none', () => {
    const html = renderToStaticMarkup(
      <DonateForm funds={[{ id: 1, name: 'General' }]} />,
    )
    expect(html).toContain('$25')
    expect(html).toContain('$50')
    expect(html).toContain('$100')
  })
})
