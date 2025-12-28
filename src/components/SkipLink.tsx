import { useEffect, useState } from 'react'

export function SkipLink() {
  const [isFocused, setIsFocused] = useState(false)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        setIsFocused(true)
      }
    }

    const handleMouseDown = () => {
      setIsFocused(false)
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handleMouseDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handleMouseDown)
    }
  }, [])

  const handleSkip = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    const mainContent = document.getElementById('main-content')
    if (mainContent) {
      mainContent.focus()
      mainContent.scrollIntoView()
    }
  }

  if (!isFocused) return null

  return (
    <a
      href="#main-content"
      onClick={handleSkip}
      className="absolute top-0 left-0 z-[9999] bg-blue-600 text-white px-4 py-2 rounded-md transform -translate-y-full focus:translate-y-0 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 transition-transform duration-200"
    >
      Skip to main content
    </a>
  )
}
