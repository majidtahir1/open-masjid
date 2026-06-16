import { describe, it, expect } from 'vitest'
import { mapRegistrationFields } from '@/hooks/createStudentFromRegistration'

// The real submission `data` field is a flat Record<string, unknown> keyed by
// form field name — not an array of { field, value } pairs.

describe('mapRegistrationFields', () => {
  it('maps submission data object to Student data', () => {
    const data: Record<string, unknown> = {
      firstName: 'Aisha',
      lastName: 'Khan',
      age: '7',
      guardianName: 'Sara Khan',
      guardianPhone: '555-1212',
      guardianEmail: 'sara@example.com',
      allergies: 'peanuts',
    }
    expect(mapRegistrationFields(data, 9)).toEqual({
      tenant: 9,
      firstName: 'Aisha',
      lastName: 'Khan',
      age: 7,
      allergiesNotes: 'peanuts',
      status: 'active',
      guardians: [
        { name: 'Sara Khan', phone: '555-1212', email: 'sara@example.com', isPrimary: true },
      ],
    })
  })

  it('returns null when required name fields are absent', () => {
    expect(mapRegistrationFields({ age: '7' }, 9)).toBeNull()
  })

  it('omits optional fields when not present in data', () => {
    const result = mapRegistrationFields({ firstName: 'Ali', lastName: 'Hassan' }, 9)
    expect(result).not.toBeNull()
    expect(result).toMatchObject({ firstName: 'Ali', lastName: 'Hassan', tenant: 9, status: 'active' })
    expect(result).not.toHaveProperty('age')
    expect(result).not.toHaveProperty('allergiesNotes')
    expect(result).not.toHaveProperty('guardians')
  })

  it('handles numeric age value (not just string)', () => {
    const result = mapRegistrationFields({ firstName: 'Zara', lastName: 'Ali', age: 8 }, 9)
    expect(result?.age).toBe(8)
  })
})
