'use client'

import { useRouter } from 'next/navigation'

import { IdentityStep, type IdentityInitial } from './IdentityStep'

type Props = {
  initial: IdentityInitial
  tenantName: string
  publicUrl: string
}

export default function IdentityStandalone({ initial, tenantName, publicUrl }: Props) {
  const router = useRouter()

  return (
    <IdentityStep
      initial={initial}
      tenantName={tenantName}
      publicUrl={publicUrl}
      mode="standalone"
      markCompleteOnSave={false}
      onClose={() => router.push('/admin')}
      onSaved={() => router.refresh()}
    />
  )
}
