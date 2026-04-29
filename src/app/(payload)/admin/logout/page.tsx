/**
 * Custom admin logout route.
 *
 * Replaces Payload's built-in `/admin/logout` view because the default does
 * a soft client navigation (router.push) after clearing the auth cookie.
 * That leaves Next.js's Router Cache populated with the prior user's RSC
 * payloads, so pressing back / re-navigating to /admin/* surfaces stale
 * "logged in" UI even though the session is gone — and trying to log in as
 * a different user immediately afterward shows "already logged in" because
 * the cached client state hasn't been busted.
 *
 * This route:
 *   1. Calls Payload's logout server action server-side, which emits the
 *      Set-Cookie header that clears `payload-token`.
 *   2. Revalidates the admin layout so any cached RSC for this user is
 *      invalidated.
 *   3. Forces a hard browser navigation (`window.location.replace`) to
 *      `/admin/login` from a tiny client component, which evicts the
 *      Router Cache and any in-memory React state.
 *
 * A file-system route at `/admin/logout` takes precedence over Payload's
 * `[[...segments]]` catch-all, so this page wins.
 */

import { logout } from '@payloadcms/next/auth'
import { revalidatePath } from 'next/cache'

import config from '@payload-config'

import LogoutHardRedirect from './LogoutHardRedirect'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata = {
  title: 'Signing out — OpenMasjid',
}

export default async function LogoutPage() {
  await logout({ config })
  revalidatePath('/admin', 'layout')
  return <LogoutHardRedirect to="/admin/login" />
}
