'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'

interface CarouselErrorBoundaryState {
  hasError: boolean
  error?: Error
  errorInfo?: ErrorInfo
}

interface CarouselErrorBoundaryProps {
  children: ReactNode
}

class CarouselErrorBoundary extends Component<CarouselErrorBoundaryProps, CarouselErrorBoundaryState> {
  constructor(props: CarouselErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): CarouselErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Carousel Error Boundary caught an error:', error)
    console.error('Error Info:', errorInfo)

    this.setState({
      error,
      errorInfo,
    })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="w-full h-full flex flex-col items-center justify-center p-8 relative"
          style={{ background: 'linear-gradient(135deg, #0f766e, #134e4a)' }}
        >
          {/* Islamic Pattern Background Overlay */}
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 40 40'%3E%3Cg fill-opacity='0.1'%3E%3Cpath d='M20 20c0 5.5-4.5 10-10 10s-10-4.5-10-10 4.5-10 10-10 10 4.5 10 10zm10 0c0 5.5-4.5 10-10 10s-10-4.5-10-10 4.5-10 10-10 10 4.5 10 10z' fill='%23ffffff'/%3E%3C/g%3E%3C/svg%3E")`,
              backgroundSize: '40px 40px',
            }}
          />

          <div className="relative z-10 text-center text-white max-w-2xl">
            <h1
              className="font-bold mb-6"
              style={{ fontSize: 'clamp(2rem, 5vw, 5rem)' }}
            >
              Display Temporarily Unavailable
            </h1>

            <p className="mb-8 opacity-90" style={{ fontSize: 'clamp(1rem, 2.5vw, 2.5rem)' }}>
              We&apos;re experiencing a technical issue with the display system. The system will automatically recover
              shortly.
            </p>

            <div className="bg-white/10 backdrop-blur rounded-lg p-6 mb-8">
              <p className="opacity-75" style={{ fontSize: 'clamp(0.875rem, 2vw, 2rem)' }}>
                For immediate assistance, please contact the office.
              </p>
            </div>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-8 text-left bg-red-900/50 p-4 rounded">
                <summary className="cursor-pointer text-sm font-bold mb-2">Development Error Details</summary>
                <pre className="text-xs whitespace-pre-wrap break-words overflow-auto max-h-40">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}
          </div>

          {/* Footer */}
          <div className="absolute bottom-0 left-0 right-0 bg-black/80 backdrop-blur text-white p-4" />
        </div>
      )
    }

    return this.props.children
  }
}

export default CarouselErrorBoundary
