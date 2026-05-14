'use client'

import React from 'react'
import IslamicContentDisplay from './IslamicContentDisplay'

const IslamicContentSlide: React.FC = () => {
  return (
    <div className="w-full h-full bg-slate-900 flex items-center justify-center relative">
      {/* Islamic Pattern Background */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60' viewBox='0 0 60 60'%3E%3Cg fill-opacity='0.15' fill='%2314b8a6'%3E%3Cpath d='M30 5 L55 20 L55 40 L30 55 L5 40 L5 20 Z' fill='none' stroke='%2314b8a6' stroke-width='1'/%3E%3C/g%3E%3C/svg%3E")`,
          backgroundSize: '60px 60px',
        }}
      />

      {/* Main Content */}
      <div className="relative z-10 w-full h-full flex items-center justify-center p-8">
        <IslamicContentDisplay />
      </div>
    </div>
  )
}

export default IslamicContentSlide
