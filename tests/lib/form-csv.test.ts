import { describe, it, expect } from 'vitest'
import { submissionsToCsv } from '@/lib/form-csv'
import type { FormSchema } from '@/lib/form-schema'

const makeSchema = (fields: Array<{ type: string; name: string; label: string }>): FormSchema => ({
  steps: [
    {
      id: 'step1',
      fields: fields.map((f) => ({
        id: `id_${f.name}`,
        required: false,
        ...f,
      })) as FormSchema['steps'][0]['fields'],
    },
  ],
})

const baseSubmission = {
  submittedAt: '2024-01-15T10:00:00.000Z',
  status: 'complete',
  paymentStatus: 'paid',
  submitterEmail: 'test@example.com',
  data: {} as Record<string, unknown>,
}

describe('submissionsToCsv', () => {
  it('header includes fixed leading columns in correct order', () => {
    const schema = makeSchema([{ type: 'short-text', name: 'name', label: 'Name' }])
    const csv = submissionsToCsv(schema, [])
    const header = csv.split('\n')[0]
    const cols = header.split(',')
    expect(cols[0]).toBe('Submitted at')
    expect(cols[1]).toBe('Email')
    expect(cols[2]).toBe('Status')
    expect(cols[3]).toBe('Payment')
    expect(cols[4]).toBe('Amount')
    expect(cols[5]).toBe('Currency')
  })

  it('column order matches schema field order', () => {
    const schema = makeSchema([
      { type: 'short-text', name: 'first_name', label: 'First Name' },
      { type: 'short-text', name: 'last_name', label: 'Last Name' },
      { type: 'email', name: 'email_addr', label: 'Email Address' },
    ])
    const csv = submissionsToCsv(schema, [])
    const header = csv.split('\n')[0]
    const cols = header.split(',')
    // Fixed cols: 0-5, then field cols starting at 6
    expect(cols[6]).toBe('First Name')
    expect(cols[7]).toBe('Last Name')
    expect(cols[8]).toBe('Email Address')
  })

  it('page-break fields are skipped in column generation', () => {
    const schema: FormSchema = {
      steps: [
        {
          id: 'step1',
          fields: [
            { id: 'id1', type: 'short-text', name: 'field_a', label: 'Field A', required: false },
            { id: 'pb1', type: 'page-break', name: 'pb1' },
            { id: 'id2', type: 'short-text', name: 'field_b', label: 'Field B', required: false },
          ],
        },
      ],
    }
    const csv = submissionsToCsv(schema, [])
    const header = csv.split('\n')[0]
    expect(header).toContain('Field A')
    expect(header).toContain('Field B')
    // page-break has no label in base fields but let's just confirm col count
    const cols = header.split(',')
    // 6 fixed + 2 fields (page-break skipped)
    expect(cols).toHaveLength(8)
  })

  it('arrays render as semicolon-space joined', () => {
    const schema = makeSchema([{ type: 'short-text', name: 'items', label: 'Items' }])
    const submission = {
      ...baseSubmission,
      data: { items: ['a', 'b', 'c'] },
    }
    const csv = submissionsToCsv(schema, [submission])
    const dataRow = csv.split('\n')[1]
    expect(dataRow).toContain('a; b; c')
  })

  it('quotes, commas and newlines are escaped', () => {
    const schema = makeSchema([
      { type: 'short-text', name: 'msg', label: 'Message' },
      { type: 'short-text', name: 'greeting', label: 'Greeting' },
    ])
    const submission = {
      ...baseSubmission,
      data: {
        msg: 'Hello, "world"',
        greeting: 'line1\nline2',
      },
    }
    const csv = submissionsToCsv(schema, [submission])
    // The CSV contains a multiline field so split('\n')[1] won't give full row
    // Instead check that the full CSV output contains the correctly escaped values
    expect(csv).toContain('"Hello, ""world"""')
    expect(csv).toContain('"line1\nline2"')
  })

  it('booleans render as "yes" for true and empty string for false', () => {
    const schema = makeSchema([
      { type: 'short-text', name: 'consented', label: 'Consented' },
      { type: 'short-text', name: 'opted_out', label: 'Opted Out' },
    ])
    const submission = {
      ...baseSubmission,
      data: { consented: true, opted_out: false },
    }
    const csv = submissionsToCsv(schema, [submission])
    const dataRow = csv.split('\n')[1]
    const cols = dataRow.split(',')
    // consented is col 6, opted_out is col 7
    expect(cols[6]).toBe('yes')
    expect(cols[7]).toBe('')
  })

  it('empty, null and undefined cells render as empty string', () => {
    const schema = makeSchema([
      { type: 'short-text', name: 'a', label: 'A' },
      { type: 'short-text', name: 'b', label: 'B' },
      { type: 'short-text', name: 'c', label: 'C' },
    ])
    const submission = {
      ...baseSubmission,
      data: { a: '', b: null, c: undefined },
    }
    const csv = submissionsToCsv(schema, [submission])
    const dataRow = csv.split('\n')[1]
    const cols = dataRow.split(',')
    expect(cols[6]).toBe('')
    expect(cols[7]).toBe('')
    expect(cols[8]).toBe('')
  })

  it('amountCents is formatted as decimal and currency included', () => {
    const schema = makeSchema([{ type: 'short-text', name: 'name', label: 'Name' }])
    const submission = {
      ...baseSubmission,
      amountCents: 1500,
      currency: 'usd',
      data: { name: 'Alice' },
    }
    const csv = submissionsToCsv(schema, [submission])
    const dataRow = csv.split('\n')[1]
    const cols = dataRow.split(',')
    expect(cols[4]).toBe('15.00')
    expect(cols[5]).toBe('usd')
  })

  it('null amountCents and currency render as empty string', () => {
    const schema = makeSchema([{ type: 'short-text', name: 'name', label: 'Name' }])
    const submission = {
      ...baseSubmission,
      amountCents: null,
      currency: null,
      data: { name: 'Bob' },
    }
    const csv = submissionsToCsv(schema, [submission])
    const dataRow = csv.split('\n')[1]
    const cols = dataRow.split(',')
    expect(cols[4]).toBe('')
    expect(cols[5]).toBe('')
  })
})
