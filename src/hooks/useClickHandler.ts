import { useRef, useCallback } from 'react'

interface UseClickHandlerOptions {
  onSingleClick?: () => void
  onDoubleClick?: (event: { clientX: number; clientY: number }) => void
  delay?: number
}

export function useClickHandler({
  onSingleClick,
  onDoubleClick,
  delay = 300
}: UseClickHandlerOptions) {
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const clickCountRef = useRef(0)
  const firstClickTimeRef = useRef(0)

  const handleClick = useCallback((e: React.MouseEvent) => {
    const now = Date.now()
    const clientX = e.clientX
    const clientY = e.clientY

    clickCountRef.current += 1

    if (clickCountRef.current === 1) {
      // First click - start timer
      firstClickTimeRef.current = now
      
      clickTimeoutRef.current = setTimeout(() => {
        // Single click confirmed
        if (clickCountRef.current === 1) {
          onSingleClick?.()
        }
        // Reset
        clickCountRef.current = 0
        clickTimeoutRef.current = null
      }, delay)
    } else if (clickCountRef.current === 2) {
      // Second click - check if it's within the delay window
      const timeDiff = now - firstClickTimeRef.current
      
      if (timeDiff <= delay) {
        // Double click confirmed
        if (clickTimeoutRef.current) {
          clearTimeout(clickTimeoutRef.current)
          clickTimeoutRef.current = null
        }
        
        // Prevent the single click from firing
        e.preventDefault()
        e.stopPropagation()
        
        onDoubleClick?.({ clientX, clientY })
      } else {
        // Too slow, treat as a new single click
        if (clickTimeoutRef.current) {
          clearTimeout(clickTimeoutRef.current)
        }
        
        clickTimeoutRef.current = setTimeout(() => {
          onSingleClick?.()
          clickCountRef.current = 0
          clickTimeoutRef.current = null
        }, delay)
      }
      
      // Reset counter after handling
      if (timeDiff <= delay) {
        clickCountRef.current = 0
      } else {
        clickCountRef.current = 1
        firstClickTimeRef.current = now
      }
    } else {
      // More than 2 clicks, reset
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current)
        clickTimeoutRef.current = null
      }
      clickCountRef.current = 1
      firstClickTimeRef.current = now
      
      clickTimeoutRef.current = setTimeout(() => {
        onSingleClick?.()
        clickCountRef.current = 0
        clickTimeoutRef.current = null
      }, delay)
    }
  }, [onSingleClick, onDoubleClick, delay])

  // Handle touch events for mobile
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    // Convert touch event to mouse-like event
    if (e.changedTouches.length > 0) {
      const touch = e.changedTouches[0]
      const syntheticEvent = {
        clientX: touch.clientX,
        clientY: touch.clientY,
        preventDefault: () => e.preventDefault(),
        stopPropagation: () => e.stopPropagation()
      } as React.MouseEvent

      handleClick(syntheticEvent)
    }
  }, [handleClick])

  // Cleanup on unmount
  const cleanup = useCallback(() => {
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current)
      clickTimeoutRef.current = null
    }
    clickCountRef.current = 0
  }, [])

  return {
    onClick: handleClick,
    onTouchEnd: handleTouchEnd,
    cleanup
  }
}