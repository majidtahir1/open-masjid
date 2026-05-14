'use client'
import React from 'react'

type Entry = {
  day: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'
  time: string
  name: string
  location?: string | null
  audience?: string | null
}

type WeeklyEventsSlideData = {
  id: string
  title?: string | null
  entries?: Entry[] | null
}

interface Props { slide: WeeklyEventsSlideData }

const DAY_LABEL: Record<Entry['day'], string> = {
  mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday',
  thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday',
}
const DAY_ORDER: Entry['day'][] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

export default function WeeklyEventsSlide({ slide }: Props) {
  const entries = Array.isArray(slide.entries) ? slide.entries : []
  const byDay = DAY_ORDER
    .map(day => ({ day, items: entries.filter(e => e.day === day) }))
    .filter(group => group.items.length > 0)

  return (
    <div className="w-full h-full bg-slate-900 text-white p-12 flex flex-col">
      <h1
        style={{ fontSize: 'clamp(2.5rem, 5vw, 5rem)' }}
        className="font-bold mb-8 text-center"
      >
        {slide.title || 'This Week at the Masjid'}
      </h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1 overflow-hidden">
        {byDay.map(({ day, items }) => (
          <div key={day} className="bg-slate-800/60 rounded-lg p-6">
            <div
              style={{ fontSize: 'clamp(1.25rem, 2vw, 1.75rem)' }}
              className="font-semibold text-emerald-300 mb-3"
            >
              {DAY_LABEL[day]}
            </div>
            <ul className="space-y-2">
              {items.map((item, i) => (
                <li key={i} className="flex justify-between items-baseline gap-4">
                  <div className="flex-1">
                    <div style={{ fontSize: 'clamp(1.1rem, 1.6vw, 1.5rem)' }}>{item.name}</div>
                    {(item.location || item.audience) && (
                      <div className="opacity-70 text-sm">
                        {[item.location, item.audience].filter(Boolean).join(' • ')}
                      </div>
                    )}
                  </div>
                  <div
                    style={{ fontSize: 'clamp(1rem, 1.4vw, 1.4rem)' }}
                    className="opacity-80 whitespace-nowrap"
                  >
                    {item.time}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
