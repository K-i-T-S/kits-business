import { useEffect, useRef } from 'react'

interface ScreenReaderAnnouncerProps {
  message?: string
  politeness?: 'polite' | 'assertive' | 'off'
}

export function ScreenReaderAnnouncer({ message, politeness = 'polite' }: ScreenReaderAnnouncerProps) {
  const announcerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (message && announcerRef.current) {
      announcerRef.current.textContent = message
      
      // Clear the message after it's announced
      const timer = setTimeout(() => {
        if (announcerRef.current) {
          announcerRef.current.textContent = ''
        }
      }, 1000)

      return () => clearTimeout(timer)
    }
  }, [message])

  return (
    <div
      ref={announcerRef}
      aria-live={politeness}
      aria-atomic="true"
      className="sr-only"
    />
  )
}

// Hook for announcing screen reader messages
export function useScreenReaderAnnouncer() {
  const announcerRef = useRef<{ announce: (message: string, politeness?: 'polite' | 'assertive') => void }>()

  useEffect(() => {
    // Create a global announcer function
    announcerRef.current = {
      announce: (message: string, politeness = 'polite') => {
        const announcer = document.createElement('div')
        announcer.setAttribute('aria-live', politeness)
        announcer.setAttribute('aria-atomic', 'true')
        announcer.className = 'sr-only'
        announcer.textContent = message
        
        document.body.appendChild(announcer)
        
        // Remove after announcement
        setTimeout(() => {
          document.body.removeChild(announcer)
        }, 1000)
      }
    }
  }, [])

  return announcerRef.current
}
