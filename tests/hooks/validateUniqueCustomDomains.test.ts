import { describe, it, expect, vi } from 'vitest'
import { validateUniqueCustomDomains } from '@/hooks/validateUniqueCustomDomains'

function call(args: {
  data: Record<string, unknown>
  originalDoc?: Record<string, unknown>
  findResult?: Array<Record<string, unknown>>
}) {
  const find = vi.fn().mockResolvedValue({ docs: args.findResult ?? [] })
  const promise = validateUniqueCustomDomains({
    data: args.data,
    originalDoc: args.originalDoc,
    operation: 'update',
    req: { payload: { find } } as never,
  } as never)
  return { promise, find }
}

describe('validateUniqueCustomDomains', () => {
  it('returns data untouched and skips the query when no custom domains are submitted', async () => {
    const { promise, find } = call({ data: { name: 'Masjid A' } })
    await expect(promise).resolves.toEqual({ name: 'Masjid A' })
    expect(find).not.toHaveBeenCalled()
  })

  it('allows a domain no other tenant has claimed', async () => {
    const data = { customDomains: [{ domain: 'masjida.org' }] }
    const { promise } = call({ data, originalDoc: { id: 1 }, findResult: [] })
    await expect(promise).resolves.toEqual(data)
  })

  it('rejects a domain already claimed by another tenant', async () => {
    const { promise } = call({
      data: { customDomains: [{ domain: 'masjida.org' }] },
      originalDoc: { id: 1 },
      findResult: [{ id: 2, name: 'Masjid B' }],
    })
    await expect(promise).rejects.toThrow(/masjida\.org/)
  })

  it('treats www and apex variants as the same claim (queries both)', async () => {
    const { promise, find } = call({
      data: { customDomains: [{ domain: 'www.masjida.org' }] },
      originalDoc: { id: 1 },
    })
    await promise
    const where = JSON.stringify(find.mock.calls[0][0].where)
    expect(where).toContain('masjida.org')
    expect(where).toContain('www.masjida.org')
  })

  it('excludes the tenant being edited from the conflict query', async () => {
    const { promise, find } = call({
      data: { customDomains: [{ domain: 'masjida.org' }] },
      originalDoc: { id: 7 },
    })
    await promise
    const where = find.mock.calls[0][0].where as { and?: Array<Record<string, unknown>> }
    expect(JSON.stringify(where)).toContain('"not_equals":7')
  })

  it('rejects duplicate domains within the same submission (after normalization)', async () => {
    const { promise, find } = call({
      data: { customDomains: [{ domain: 'Masjida.org' }, { domain: 'www.masjida.org' }] },
      originalDoc: { id: 1 },
    })
    await expect(promise).rejects.toThrow(/masjida\.org/)
    expect(find).not.toHaveBeenCalled()
  })
})
