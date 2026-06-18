// src/admin/shell/icons.tsx
import {
  LayoutDashboard, Clock, Globe, Calendar, Image, Megaphone, Tag, File,
  Monitor, Sparkles, Grid3x3, QrCode, FileText, Inbox, Users, Heart,
  GraduationCap, Building2, Settings, User, type LucideIcon,
} from 'lucide-react'
import type { IconName } from './nav-config'

const MAP: Record<IconName, LucideIcon> = {
  dashboard: LayoutDashboard, clock: Clock, globe: Globe, calendar: Calendar,
  image: Image, megaphone: Megaphone, tag: Tag, file: File, monitor: Monitor,
  sparkles: Sparkles, grid: Grid3x3, qr: QrCode, fileText: FileText, inbox: Inbox,
  users: Users, heart: Heart, graduation: GraduationCap, building: Building2,
  settings: Settings, user: User,
}

export function NavIcon({ name, size = 18 }: { name: IconName; size?: number }) {
  const Cmp = MAP[name] ?? File
  return <Cmp size={size} aria-hidden />
}
