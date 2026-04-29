'use client'

import { useRouter } from 'next/navigation'

import { BrandingStep, type BrandingInitial } from './BrandingStep'

type Props = {
  initial: BrandingInitial
  tenantName: string
  publicUrl: string
}

export default function BrandingStandalone({ initial, tenantName, publicUrl }: Props) {
  const router = useRouter()

  return (
    <BrandingStep
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
