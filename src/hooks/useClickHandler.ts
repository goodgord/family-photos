import { useRef, useCallback } from 'react'

interface UseClickHandlerOptions {
  onSingleClick?: () => void
  onDoubleClick?: (event: { clientX: number; clientY: number }) => void
  delay?: number
  touchMoveThreshold?: number
}

interface TouchInfo {
  startX: number
  startY: number
  startTime: number
  moved: boolean
}

export function useClickHandler({
  onSingleClick,
  onDoubleClick,
  delay = 300,
  touchMoveThreshold = 10
}: UseClickHandlerOptions) {
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const clickCountRef = useRef(0)
  const firstClickTimeRef = useRef(0)
  
  // Touch-specific state
  const touchInfoRef = useRef<TouchInfo | null>(null)
  const scrollingRef = useRef(false)

  // Desktop mouse click handler
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
        clickCountRef.current = 0
      } else {
        // Too slow, treat as a new single click
        if (clickTimeoutRef.current) {
          clearTimeout(clickTimeoutRef.current)
        }
        
        clickCountRef.current = 1
        firstClickTimeRef.current = now
        
        clickTimeoutRef.current = setTimeout(() => {
          onSingleClick?.()
          clickCountRef.current = 0
          clickTimeoutRef.current = null
        }, delay)
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

  // Touch start handler
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0]
      touchInfoRef.current = {
        startX: touch.clientX,
        startY: touch.clientY,
        startTime: Date.now(),
        moved: false
      }
      scrollingRef.current = false
    }
  }, [])

  // Touch move handler - detect if user is scrolling
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchInfoRef.current || e.touches.length !== 1) return

    const touch = e.touches[0]
    const deltaX = Math.abs(touch.clientX - touchInfoRef.current.startX)
    const deltaY = Math.abs(touch.clientY - touchInfoRef.current.startY)
    const totalMovement = Math.sqrt(deltaX * deltaX + deltaY * deltaY)

    if (totalMovement > touchMoveThreshold) {
      touchInfoRef.current.moved = true
      scrollingRef.current = true
    }
  }, [touchMoveThreshold])

  // Touch end handler
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    // If user was scrolling or moved significantly, don't treat as tap
    if (scrollingRef.current || !touchInfoRef.current) {
      touchInfoRef.current = null
      return
    }

    // If touch moved too much, don't treat as tap
    if (touchInfoRef.current.moved) {
      touchInfoRef.current = null
      return
    }

    // Valid tap - convert to click-like behavior
    if (e.changedTouches.length > 0) {
      const touch = e.changedTouches[0]
      const now = Date.now()
      
      // Prevent default touch behavior to avoid double-firing
      e.preventDefault()
      
      clickCountRef.current += 1

      if (clickCountRef.current === 1) {
        // First tap - start timer
        firstClickTimeRef.current = now
        
        clickTimeoutRef.current = setTimeout(() => {
          if (clickCountRef.current === 1) {
            onSingleClick?.()
          }
          clickCountRef.current = 0
          clickTimeoutRef.current = null
        }, delay)
      } else if (clickCountRef.current === 2) {
        // Second tap - check timing
        const timeDiff = now - firstClickTimeRef.current
        
        if (timeDiff <= delay) {
          // Double tap confirmed
          if (clickTimeoutRef.current) {
            clearTimeout(clickTimeoutRef.current)
            clickTimeoutRef.current = null
          }
          
          onDoubleClick?.({ 
            clientX: touch.clientX, 
            clientY: touch.clientY 
          })
          clickCountRef.current = 0
        } else {
          // Too slow, treat as new single tap
          if (clickTimeoutRef.current) {
            clearTimeout(clickTimeoutRef.current)
          }
          
          clickCountRef.current = 1
          firstClickTimeRef.current = now
          
          clickTimeoutRef.current = setTimeout(() => {
            onSingleClick?.()
            clickCountRef.current = 0
            clickTimeoutRef.current = null
          }, delay)
        }
      } else {
        // More than 2 taps, reset
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
    }

    touchInfoRef.current = null
  }, [onSingleClick, onDoubleClick, delay])

  // Cleanup on unmount
  const cleanup = useCallback(() => {
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current)
      clickTimeoutRef.current = null
    }
    clickCountRef.current = 0
    touchInfoRef.current = null
    scrollingRef.current = false
  }, [])

  return {
    onClick: handleClick,
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
    cleanup
  }
}