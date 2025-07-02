'use client'

import { useRef, useCallback } from 'react'

interface UseDoubleTapOptions {
  onSingleTap?: (event: React.MouseEvent | React.TouchEvent) => void
  onDoubleTap?: (event: React.MouseEvent | React.TouchEvent) => void
  delay?: number
  threshold?: number
}

export function useDoubleTap({
  onSingleTap,
  onDoubleTap,
  delay = 300,
  threshold = 10
}: UseDoubleTapOptions) {
  const clickCountRef = useRef(0)
  const clickTimerRef = useRef<NodeJS.Timeout | null>(null)
  const lastTapRef = useRef<{ x: number; y: number; time: number } | null>(null)

  const getEventCoordinates = (event: React.MouseEvent | React.TouchEvent) => {
    if ('touches' in event && event.touches.length > 0) {
      return { x: event.touches[0].clientX, y: event.touches[0].clientY }
    } else if ('clientX' in event) {
      return { x: event.clientX, y: event.clientY }
    }
    return { x: 0, y: 0 }
  }

  const handleTap = useCallback((event: React.MouseEvent | React.TouchEvent) => {
    const now = Date.now()
    const coords = getEventCoordinates(event)

    // Check if this is a potential double tap
    if (lastTapRef.current) {
      const timeDiff = now - lastTapRef.current.time
      const distance = Math.sqrt(
        Math.pow(coords.x - lastTapRef.current.x, 2) + 
        Math.pow(coords.y - lastTapRef.current.y, 2)
      )

      // If within time threshold and close enough, it's a double tap
      if (timeDiff < delay && distance < threshold) {
        // Clear any pending single tap
        if (clickTimerRef.current) {
          clearTimeout(clickTimerRef.current)
          clickTimerRef.current = null
        }
        
        // Reset for next potential double tap
        lastTapRef.current = null
        clickCountRef.current = 0
        
        // Trigger double tap
        onDoubleTap?.(event)
        return
      }
    }

    // Store this tap for potential double tap detection
    lastTapRef.current = { x: coords.x, y: coords.y, time: now }
    clickCountRef.current++

    // Clear any existing timer
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current)
    }

    // Set timer for single tap
    clickTimerRef.current = setTimeout(() => {
      if (clickCountRef.current === 1) {
        onSingleTap?.(event)
      }
      clickCountRef.current = 0
      lastTapRef.current = null
      clickTimerRef.current = null
    }, delay)
  }, [onSingleTap, onDoubleTap, delay, threshold])

  const handlers = {
    onClick: (event: React.MouseEvent) => {
      event.preventDefault()
      handleTap(event)
    },
    onTouchEnd: (event: React.TouchEvent) => {
      event.preventDefault()
      handleTap(event)
    }
  }

  return handlers
}

// Hook specifically for heart reactions with animation
export function useHeartReaction(onHeartReaction: () => void, preventSingleTap?: boolean) {

  const showHeartAnimation = useCallback((event: React.MouseEvent | React.TouchEvent) => {
    const coords = event.type.includes('touch') 
      ? { x: (event as React.TouchEvent).changedTouches[0].clientX, y: (event as React.TouchEvent).changedTouches[0].clientY }
      : { x: (event as React.MouseEvent).clientX, y: (event as React.MouseEvent).clientY }

    // Create heart animation element
    const heart = document.createElement('div')
    heart.innerHTML = '❤️'
    heart.className = 'fixed pointer-events-none z-50 text-2xl animate-ping'
    heart.style.left = `${coords.x - 12}px`
    heart.style.top = `${coords.y - 12}px`
    heart.style.animation = 'heartPop 1s ease-out forwards'

    // Add custom animation keyframes if not already added
    if (!document.querySelector('#heart-animation-styles')) {
      const style = document.createElement('style')
      style.id = 'heart-animation-styles'
      style.textContent = `
        @keyframes heartPop {
          0% {
            transform: scale(0) rotate(0deg);
            opacity: 1;
          }
          50% {
            transform: scale(1.2) rotate(-10deg);
            opacity: 1;
          }
          100% {
            transform: scale(0.8) rotate(0deg) translateY(-20px);
            opacity: 0;
          }
        }
      `
      document.head.appendChild(style)
    }

    document.body.appendChild(heart)

    // Remove heart after animation
    setTimeout(() => {
      if (document.body.contains(heart)) {
        document.body.removeChild(heart)
      }
    }, 1000)
  }, [])

  const doubleTapHandlers = useDoubleTap({
    onSingleTap: preventSingleTap ? undefined : () => {
      // Allow single tap to bubble up (e.g., to open modal)
    },
    onDoubleTap: (event) => {
      event.stopPropagation()
      showHeartAnimation(event)
      onHeartReaction()
    }
  })

  return doubleTapHandlers
}