'use client'

import {
  Type,
  Mail,
  Phone,
  AlignLeft,
  Hash,
  Calendar,
  ChevronDown,
  Circle,
  CheckSquare,
  LayoutList,
  Shield,
  SeparatorHorizontal,
} from 'lucide-react'
import type { FieldTypeId } from '@/lib/form-schema'

interface FieldTypeIconProps {
  type: FieldTypeId
  size?: number
  className?: string
}

export default function FieldTypeIcon({ type, size = 16, className }: FieldTypeIconProps) {
  const props = { size, className }
  switch (type) {
    case 'short-text':
      return <Type {...props} />
    case 'email':
      return <Mail {...props} />
    case 'phone':
      return <Phone {...props} />
    case 'long-text':
      return <AlignLeft {...props} />
    case 'number':
      return <Hash {...props} />
    case 'date':
      return <Calendar {...props} />
    case 'dropdown':
      return <ChevronDown {...props} />
    case 'radio':
      return <Circle {...props} />
    case 'multiselect':
      return <CheckSquare {...props} />
    case 'checkbox-group':
      return <LayoutList {...props} />
    case 'consent':
      return <Shield {...props} />
    case 'page-break':
      return <SeparatorHorizontal {...props} />
    default:
      return <Type {...props} />
  }
}
