import React from 'react'
import { describe, it, expect } from 'vitest'
import Page from '@/app/(payload)/admin/login/page'
import LoginView from '@/admin/LoginView'

// The login page is an async Server Component (Next 16: searchParams is a
// Promise). Invoking it directly returns the element tree, letting us assert
// how the `redirect` search param is threaded into LoginView.

const render = (searchParams: { redirect?: string | string[] }) =>
  Page({ searchParams: Promise.resolve(searchParams) })

describe('admin login page — redirect param handling', () => {
  it('passes a string redirect param through to LoginView', async () => {
    const el = (await render({ redirect: '/admin/billing' })) as React.ReactElement<{
      redirectTo?: string
    }>
    expect(el.type).toBe(LoginView)
    expect(el.props.redirectTo).toBe('/admin/billing')
  })

  it('drops an array-valued redirect param (?redirect=a&redirect=b)', async () => {
    const el = (await render({
      redirect: ['/admin/billing', '//evil.com'],
    })) as React.ReactElement<{ redirectTo?: string }>
    expect(el.props.redirectTo).toBeUndefined()
  })

  it('passes undefined when no redirect param is present', async () => {
    const el = (await render({})) as React.ReactElement<{ redirectTo?: string }>
    expect(el.props.redirectTo).toBeUndefined()
  })
})
