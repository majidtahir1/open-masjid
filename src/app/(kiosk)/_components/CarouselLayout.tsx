'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import CarouselErrorBoundary from './CarouselErrorBoundary'

export interface CarouselSlide {
  id: string
  durationMs: number
  type: string
  payload: any
}

interface CarouselLayoutProps {
  slides: CarouselSlide[]
  renderSlide: (slide: CarouselSlide) => React.ReactNode
  onSlideAdvance?: () => void
  onSlideChange?: (slide: CarouselSlide, index: number) => void
  children?: React.ReactNode
}

const CarouselLayout: React.FC<CarouselLayoutProps> = ({
  slides,
  renderSlide,
  onSlideAdvance,
  onSlideChange,
  children,
}) => {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0)
  const [isPlaying] = useState(true)
  const [isDevMode, setIsDevMode] = useState(false)
  const transitionDuration = 1000

  // Fire onSlideChange ONLY when the active slide identity actually changes.
  // The slides array reference changes every poll (5s) because the parent
  // recreates it; without a stable key check we'd report on every poll.
  const lastReportedKeyRef = useRef<string | null>(null)
  useEffect(() => {
    if (slides.length === 0) return
    const slide = slides[currentSlideIndex]
    if (!slide) return
    const key = `${slide.type}:${slide.id}:${currentSlideIndex}`
    if (lastReportedKeyRef.current === key) return
    lastReportedKeyRef.current = key
    onSlideChange?.(slide, currentSlideIndex)
  }, [currentSlideIndex, slides, onSlideChange])

  // Auto-progression logic
  useEffect(() => {
    if (!isPlaying || slides.length === 0) return

    const currentSlide = slides[currentSlideIndex]
    if (!currentSlide) return

    const timer = setTimeout(() => {
      setCurrentSlideIndex((prev) => (prev + 1) % slides.length)
      onSlideAdvance?.()
    }, currentSlide.durationMs)

    return () => clearTimeout(timer)
  }, [currentSlideIndex, isPlaying, slides, onSlideAdvance])

  // Keyboard shortcuts for dev mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight':
          setCurrentSlideIndex((prev) => (prev + 1) % slides.length)
          onSlideAdvance?.()
          break
        case 'ArrowLeft':
          setCurrentSlideIndex((prev) => (prev === 0 ? slides.length - 1 : prev - 1))
          break
        case 'd':
          setIsDevMode((prev) => !prev)
          break
        default:
          break
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [slides.length, onSlideAdvance])

  const goToSlide = useCallback(
    (index: number) => {
      if (index >= 0 && index < slides.length) {
        setCurrentSlideIndex(index)
      }
    },
    [slides.length],
  )

  // Handle empty slides
  if (slides.length === 0) {
    return (
      <div className="w-full h-full bg-slate-900 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-teal-500 mx-auto mb-4" />
          <p className="text-2xl">Loading Content...</p>
        </div>
      </div>
    )
  }

  const currentSlide = slides[currentSlideIndex]

  return (
    <CarouselErrorBoundary>
      <div className="relative w-full h-full overflow-hidden bg-slate-900">
        {/* Slide Container with Fade Transition */}
        <div className="absolute inset-0">
          {slides.map((slide, index) => (
            <div
              key={`${slide.type}:${slide.id}`}
              className="absolute inset-0 transition-opacity ease-in-out"
              style={{
                opacity: index === currentSlideIndex ? 1 : 0,
                transitionDuration: `${transitionDuration}ms`,
                pointerEvents: index === currentSlideIndex ? 'auto' : 'none',
              }}
            >
              <CarouselErrorBoundary>{renderSlide(slide)}</CarouselErrorBoundary>
            </div>
          ))}
        </div>

        {/* Children overlay (e.g. PrayerTimesSlide pinned permanently) */}
        {children}

        {/* Dev Mode Controls */}
        {isDevMode && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/80 text-white p-4 rounded-lg z-50">
            <div className="flex items-center space-x-4 mb-2">
              <button
                onClick={() => setCurrentSlideIndex((prev) => (prev === 0 ? slides.length - 1 : prev - 1))}
                className="px-3 py-1 bg-white/20 rounded hover:bg-white/30"
              >
                ← Prev
              </button>
              <button
                onClick={() => {
                  setCurrentSlideIndex((prev) => (prev + 1) % slides.length)
                  onSlideAdvance?.()
                }}
                className="px-3 py-1 bg-white/20 rounded hover:bg-white/30"
              >
                Next →
              </button>
            </div>
            <div className="text-center text-sm">
              Slide {currentSlideIndex + 1} of {slides.length}
              {currentSlide && ` (${currentSlide.type})`}
            </div>
            <div className="flex justify-center mt-2 space-x-1">
              {slides.map((_, index) => (
                <button
                  key={index}
                  onClick={() => goToSlide(index)}
                  className={`w-2 h-2 rounded-full ${index === currentSlideIndex ? 'bg-white' : 'bg-white/40'}`}
                />
              ))}
            </div>
          </div>
        )}

        {/* Dev Mode Indicator */}
        {isDevMode && (
          <div className="absolute top-4 right-4 bg-black/80 text-white px-3 py-1 rounded text-sm z-50">
            Dev Mode (Press &apos;D&apos; to toggle)
          </div>
        )}
      </div>
    </CarouselErrorBoundary>
  )
}

export default CarouselLayout
