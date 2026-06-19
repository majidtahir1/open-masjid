'use client'
import React, { useEffect, useState } from 'react'
import { CommandPalette } from './CommandPalette'

// Mounted as a global admin provider so ⌘K works on every page.
export default function CommandPaletteProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen((o) => !o) }
    }
    window.addEventListener('keydown', onKey)
    // Allow the top bar's search affordance to open the palette.
    const openHandler = () => setOpen(true)
    window.addEventListener('om:open-palette', openHandler)
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('om:open-palette', openHandler) }
  }, [])
  return (<>{children}<CommandPalette open={open} onClose={() => setOpen(false)} /></>)
}
