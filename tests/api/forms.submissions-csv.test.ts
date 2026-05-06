import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---- Mocks ---------------------------------------------------------------

const payloadAuth = vi.fn()
const payloadFind = vi.fn()

vi.mock('payload', () => ({
  getPayload: async () => ({
    auth: payloadAuth,
    find: payloadFind,
  }),
}))

vi.mock('@payload-config', () => ({ default: {} }))

// next/headers — return a Headers-like object the route can read
let currentHeaders: Headers
vi.mock('next/headers', () => ({
  headers: async () => currentHeaders,
}))

// Mock getCurrentTenant
vi.mock('@/lib/tenant-server', () => ({
  getCurrentTenant: vi.fn(),
}))

// Import the mock after the vi.mock() call so we can control it in tests
import { getCurrentTenant } from '@/lib/tenant-server'
const getCurrentTenantMock = getCurrentTenant as ReturnType<typeof vi.fn>

// ---- Import under test (after mocks) -------------------------------------
import { GET } from '@/app/api/forms/[slug]/submissions.csv/route'

// ---- Helpers -------------------------------------------------------------

const TENANT = { id: 10, slug: 'test-masjid' }

const FORM_SCHEMA = {
  steps: [
    {
      id: 's1',
      fields: [
        { type: 'text', name: 'full_name', label: 'Full Name', required: true },
        { type: 'email', name: 'email', label: 'Email', required: true },
      ],
    },
  ],
}

const FORM = { id: 42, slug: 'eid-rsvp', schema: FORM_SCHEMA, tenant: { id: 10 } }

const SUBMISSION_1 = {
  submittedAt: '2026-05-01T10:00:00.000Z',
  status: 'new',
  paymentStatus: 'na',
  submitterEmail: 'alice@example.com',
  data: { full_name: 'Alice Smith', email: 'alice@example.com' },
  amountCents: null,
  currency: null,
}

const SUBMISSION_2 = {
  submittedAt: '2026-05-02T12:00:00.000Z',
  status: 'reviewed',
  paymentStatus: 'paid',
  submitterEmail: 'bob@example.com',
  data: { full_name: 'Bob Jones', email: 'bob@example.com' },
  amountCents: 1000,
  currency: 'usd',
}

function makeParams(slug: string) {
  return { params: Promise.resolve({ slug }) }
}

// ---- Tests ---------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
  currentHeaders = new Headers({ host: 'test-masjid.openmasjid.app' })
})

describe('GET /api/forms/[slug]/submissions.csv', () => {
  it('returns 401 when no Payload session', async () => {
    payloadAuth.mockResolvedValueOnce({ user: null })

    const res = await GET(new Request('http://localhost'), makeParams('eid-rsvp'))
    expect(res.status).toBe(401)
  })

  it('returns 401 when getCurrentTenant returns null', async () => {
    payloadAuth.mockResolvedValueOnce({ user: { id: 1, role: 'admin' } })
    getCurrentTenantMock.mockResolvedValueOnce(null)

    const res = await GET(new Request('http://localhost'), makeParams('eid-rsvp'))
    expect(res.status).toBe(401)
  })

  it('returns 404 when form not found for slug+tenant', async () => {
    payloadAuth.mockResolvedValueOnce({ user: { id: 1, role: 'admin' } })
    getCurrentTenantMock.mockResolvedValueOnce(TENANT)
    // first find (forms) returns empty
    payloadFind.mockResolvedValueOnce({ docs: [] })

    const res = await GET(new Request('http://localhost'), makeParams('nonexistent'))
    expect(res.status).toBe(404)
  })

  it('returns 200 with text/csv content-type and correct filename header', async () => {
    payloadAuth.mockResolvedValueOnce({ user: { id: 1, role: 'admin' } })
    getCurrentTenantMock.mockResolvedValueOnce(TENANT)
    // forms find
    payloadFind.mockResolvedValueOnce({ docs: [FORM] })
    // submissions find
    payloadFind.mockResolvedValueOnce({ docs: [SUBMISSION_1, SUBMISSION_2] })

    const today = new Date().toISOString().slice(0, 10)
    const res = await GET(new Request('http://localhost'), makeParams('eid-rsvp'))

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('text/csv; charset=utf-8')
    expect(res.headers.get('content-disposition')).toBe(
      `attachment; filename="eid-rsvp-submissions-${today}.csv"`,
    )
  })

  it('returns CSV body with a header row and one row per submission', async () => {
    payloadAuth.mockResolvedValueOnce({ user: { id: 1, role: 'admin' } })
    getCurrentTenantMock.mockResolvedValueOnce(TENANT)
    payloadFind.mockResolvedValueOnce({ docs: [FORM] })
    payloadFind.mockResolvedValueOnce({ docs: [SUBMISSION_1, SUBMISSION_2] })

    const res = await GET(new Request('http://localhost'), makeParams('eid-rsvp'))
    const body = await res.text()
    const lines = body.trim().split('\n')

    // header row + 2 submission rows
    expect(lines).toHaveLength(3)
    // header contains expected column names
    expect(lines[0]).toContain('Submitted at')
    expect(lines[0]).toContain('Email')
    expect(lines[0]).toContain('Full Name')
    // first data row has alice's email
    expect(lines[1]).toContain('alice@example.com')
    // second data row has bob's email
    expect(lines[2]).toContain('bob@example.com')
  })

  it('queries submissions scoped to the resolved form id', async () => {
    payloadAuth.mockResolvedValueOnce({ user: { id: 1, role: 'admin' } })
    getCurrentTenantMock.mockResolvedValueOnce(TENANT)
    payloadFind.mockResolvedValueOnce({ docs: [FORM] })
    payloadFind.mockResolvedValueOnce({ docs: [] })

    await GET(new Request('http://localhost'), makeParams('eid-rsvp'))

    // Second call to payload.find should query form-submissions with form: 42
    const submissionsCall = payloadFind.mock.calls[1][0]
    expect(submissionsCall.collection).toBe('form-submissions')
    expect(submissionsCall.where.form.equals).toBe(42)
    expect(submissionsCall.limit).toBe(10000)
    expect(submissionsCall.overrideAccess).toBe(false)
  })
})
