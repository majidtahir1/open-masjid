'use client'

import React, { useState, useEffect } from 'react'
import { getRandomIslamicContent, type IslamicContent } from '../_lib/constants/islamicContent'

const IslamicContentDisplay: React.FC = () => {
  const [currentContent, setCurrentContent] = useState<IslamicContent | null>(null)
  const [fadeClass, setFadeClass] = useState('opacity-100')

  // Rotate Islamic content every 15 seconds
  useEffect(() => {
    // Set initial content
    setCurrentContent(getRandomIslamicContent())

    const interval = setInterval(() => {
      // Fade out
      setFadeClass('opacity-0')

      // After fade out, change content and fade in
      setTimeout(() => {
        setCurrentContent(getRandomIslamicContent())
        setFadeClass('opacity-100')
      }, 500)
    }, 15000)

    return () => clearInterval(interval)
  }, [])

  if (!currentContent) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-teal-500"></div>
      </div>
    )
  }

  return (
    <div
      className={`w-full h-full flex flex-col items-center justify-center text-center px-8 transition-opacity duration-500 ${fadeClass}`}
    >
      {/* Arabic Text */}
      <div className="mb-8 w-full max-w-[90%]">
        <p
          className="leading-relaxed text-teal-400"
          style={{
            fontFamily: 'serif',
            fontSize: currentContent.type === 'ayah' ? 'clamp(2rem, 4vw, 5rem)' : 'clamp(1.5rem, 3vw, 4rem)',
            direction: 'rtl',
          }}
        >
          {currentContent.arabic}
        </p>
      </div>

      {/* English Translation */}
      <div className="mb-6 w-full max-w-[90%]">
        <p
          className="leading-relaxed text-white"
          style={{
            fontSize: currentContent.type === 'ayah' ? 'clamp(1rem, 2vw, 2.5rem)' : 'clamp(0.875rem, 1.8vw, 2rem)',
          }}
        >
          &ldquo;{currentContent.english}&rdquo;
        </p>
      </div>

      {/* Reference/Source */}
      <div className="flex flex-col items-center space-y-4">
        <p className="font-semibold text-teal-400" style={{ fontSize: 'clamp(0.875rem, 1.5vw, 1.75rem)' }}>
          {currentContent.type === 'ayah' ? currentContent.reference : `— ${currentContent.source}`}
        </p>
      </div>
    </div>
  )
}

export default IslamicContentDisplay
