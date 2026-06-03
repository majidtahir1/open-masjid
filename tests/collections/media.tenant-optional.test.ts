import { describe, it, expect } from 'vitest'
import { Media } from '@/collections/Media'

describe('Media tenant field', () => {
  it('is optional so platform-owned media (marketing/blog images) needs no tenant', () => {
    const tenant = (Media.fields as Array<{ name?: string; required?: boolean }>).find(
      (f) => f.name === 'tenant',
    )
    expect(tenant).toBeDefined()
    expect(tenant?.required).toBe(false)
  })
})
