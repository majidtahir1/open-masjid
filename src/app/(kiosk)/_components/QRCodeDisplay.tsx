'use client'

import React, { useState } from 'react'
import { QrCode } from 'lucide-react'

interface QRCodeDisplayProps {
  url: string
  onLoad?: () => void
  onError?: () => void
  className?: string
  size?: 'xsmall' | 'small' | 'medium' | 'large'
}

const QRCodeDisplay: React.FC<QRCodeDisplayProps> = ({
  url,
  onLoad,
  onError,
  className = '',
  size = 'medium',
}) => {
  const [loading, setLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  // Size mappings for TV viewing
  const sizeClasses = {
    xsmall: 'w-48 h-48 p-4',
    small: 'w-64 h-64 p-6',
    medium: 'w-72 h-72 p-8',
    large: 'w-[27rem] h-[27rem] p-10',
  }

  const handleLoad = () => {
    setLoading(false)
    onLoad?.()
  }

  const handleError = () => {
    setLoading(false)
    setHasError(true)
    onError?.()
  }

  const sizeParts = sizeClasses[size].split(' ')
  const qrSize = sizeParts.slice(0, 2).join(' ')
  const padding = sizeParts[2]

  if (hasError) {
    return (
      <div className={`bg-white rounded-2xl shadow-2xl ${padding} ${className}`}>
        <div
          className={`${qrSize} bg-gray-100 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300`}
        >
          <div className="text-center text-gray-500">
            <QrCode className="w-12 h-12 mx-auto mb-2" />
            <div className="text-tv-sm">QR Code</div>
            <div className="text-tv-xs mt-1 opacity-75">Unable to load</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-white rounded-2xl shadow-2xl ${padding} ${className}`}>
      {loading && (
        <div className={`${qrSize} bg-gray-100 rounded-lg flex items-center justify-center animate-pulse`}>
          <div className="text-center text-gray-400">
            <QrCode className="w-10 h-10 mx-auto mb-2 animate-pulse" />
            <div className="text-tv-sm">Loading...</div>
          </div>
        </div>
      )}
      <img
        src={url}
        alt="QR Code"
        className={`${qrSize} object-contain rounded-lg ${loading ? 'hidden' : 'block'}`}
        onLoad={handleLoad}
        onError={handleError}
        loading="eager"
        crossOrigin="anonymous"
      />
    </div>
  )
}

export default QRCodeDisplay
