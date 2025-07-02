'use client'

import { useState } from 'react'
import { type ReactionSummary as ReactionSummaryType } from '@/lib/reactions'

interface ReactionSummaryProps {
  reactions: ReactionSummaryType[]
  size?: 'sm' | 'md' | 'lg'
  layout?: 'horizontal' | 'compact'
  showTooltip?: boolean
  maxDisplay?: number
}

interface TooltipProps {
  reactions: ReactionSummaryType[]
  show: boolean
  position: { x: number; y: number }
}

function ReactionTooltip({ reactions, show, position }: TooltipProps) {
  if (!show || reactions.length === 0) return null

  return (
    <div
      className="fixed z-50 bg-gray-900 text-white text-xs rounded-lg p-2 shadow-lg max-w-xs"
      style={{
        left: position.x,
        top: position.y - 10,
        transform: 'translateX(-50%) translateY(-100%)'
      }}
    >
      <div className="space-y-1">
        {reactions.map((reaction) => (
          <div key={reaction.emoji} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <span>{reaction.emoji}</span>
              <span className="font-medium">{reaction.count}</span>
            </div>
            <div className="text-gray-300 text-xs">
              {reaction.users.slice(0, 3).map(user => user.user_email).join(', ')}
              {reaction.users.length > 3 && ` +${reaction.users.length - 3} more`}
            </div>
          </div>
        ))}
      </div>
      {/* Arrow */}
      <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-2 border-r-2 border-t-2 border-transparent border-t-gray-900"></div>
    </div>
  )
}

export default function ReactionSummary({ 
  reactions, 
  size = 'md', 
  layout = 'horizontal',
  showTooltip = true,
  maxDisplay = 5
}: ReactionSummaryProps) {
  const [showTooltipState, setShowTooltipState] = useState(false)
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 })

  if (!reactions || reactions.length === 0) {
    return null
  }

  const handleMouseEnter = (event: React.MouseEvent) => {
    if (showTooltip) {
      const rect = event.currentTarget.getBoundingClientRect()
      setTooltipPosition({
        x: rect.left + rect.width / 2,
        y: rect.top
      })
      setShowTooltipState(true)
    }
  }

  const handleMouseLeave = () => {
    setShowTooltipState(false)
  }

  const displayedReactions = reactions.slice(0, maxDisplay)
  const hasMore = reactions.length > maxDisplay
  const totalCount = reactions.reduce((sum, r) => sum + r.count, 0)

  const sizeClasses = {
    sm: {
      emoji: 'text-sm',
      count: 'text-xs',
      spacing: 'gap-1',
      padding: 'px-1.5 py-0.5'
    },
    md: {
      emoji: 'text-base',
      count: 'text-sm',
      spacing: 'gap-2',
      padding: 'px-2 py-1'
    },
    lg: {
      emoji: 'text-lg',
      count: 'text-base',
      spacing: 'gap-3',
      padding: 'px-3 py-1.5'
    }
  }

  const classes = sizeClasses[size]

  if (layout === 'compact') {
    return (
      <>
        <div
          className={`
            inline-flex items-center bg-gray-100 hover:bg-gray-200 
            rounded-full transition-colors duration-200 cursor-pointer
            ${classes.padding} ${classes.spacing}
          `}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <div className="flex items-center -space-x-1">
            {displayedReactions.map((reaction) => (
              <span key={reaction.emoji} className={classes.emoji}>
                {reaction.emoji}
              </span>
            ))}
          </div>
          <span className={`font-medium text-gray-700 ${classes.count}`}>
            {totalCount}
          </span>
          {hasMore && (
            <span className={`text-gray-500 ${classes.count}`}>
              +{reactions.length - maxDisplay}
            </span>
          )}
        </div>
        
        {showTooltip && (
          <ReactionTooltip 
            reactions={reactions}
            show={showTooltipState}
            position={tooltipPosition}
          />
        )}
      </>
    )
  }

  // Horizontal layout (default)
  return (
    <>
      <div className={`flex items-center flex-wrap ${classes.spacing}`}>
        {displayedReactions.map((reaction) => (
          <div
            key={reaction.emoji}
            className={`
              inline-flex items-center bg-gray-100 hover:bg-gray-200 
              rounded-full transition-colors duration-200 cursor-pointer
              ${classes.padding} gap-1
            `}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <span className={classes.emoji}>{reaction.emoji}</span>
            <span className={`font-medium text-gray-700 ${classes.count}`}>
              {reaction.count}
            </span>
          </div>
        ))}
        
        {hasMore && (
          <div
            className={`
              inline-flex items-center bg-gray-100 hover:bg-gray-200 
              rounded-full transition-colors duration-200 cursor-pointer
              ${classes.padding}
            `}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <span className={`text-gray-500 ${classes.count}`}>
              +{reactions.length - maxDisplay} more
            </span>
          </div>
        )}
      </div>
      
      {showTooltip && (
        <ReactionTooltip 
          reactions={reactions}
          show={showTooltipState}
          position={tooltipPosition}
        />
      )}
    </>
  )
}