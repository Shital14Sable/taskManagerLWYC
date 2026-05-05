import { useEffect, useState, useCallback } from 'react'
import { X } from 'lucide-react'
import { useHelpMode, type HelpAnnotation } from '@/context/HelpModeContext'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface AnnotationPosition {
  top: number
  left: number
  width: number
  height: number
}

interface VisibleAnnotation {
  annotation: HelpAnnotation
  position: AnnotationPosition
  element: Element
}

export function HelpOverlay() {
  const { isHelpModeActive, disableHelpMode, getAnnotationsForView, currentView } = useHelpMode()
  const [visibleAnnotations, setVisibleAnnotations] = useState<VisibleAnnotation[]>([])

  const findElements = useCallback(() => {
    if (!isHelpModeActive) {
      setVisibleAnnotations([])
      return
    }

    const annotations = getAnnotationsForView(currentView)
    const visible: VisibleAnnotation[] = []

    annotations.forEach((annotation) => {
      const element = document.querySelector(annotation.selector)
      if (element) {
        const rect = element.getBoundingClientRect()
        // Only include visible elements
        if (rect.width > 0 && rect.height > 0) {
          visible.push({
            annotation,
            position: {
              top: rect.top + window.scrollY,
              left: rect.left + window.scrollX,
              width: rect.width,
              height: rect.height,
            },
            element,
          })
        }
      }
    })

    setVisibleAnnotations(visible)
  }, [isHelpModeActive, getAnnotationsForView, currentView])

  useEffect(() => {
    findElements()

    // Re-calculate on resize or scroll
    const handleUpdate = () => findElements()
    window.addEventListener('resize', handleUpdate)
    window.addEventListener('scroll', handleUpdate, true)

    // Also update when help mode changes
    const observer = new MutationObserver(handleUpdate)
    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      window.removeEventListener('resize', handleUpdate)
      window.removeEventListener('scroll', handleUpdate, true)
      observer.disconnect()
    }
  }, [findElements])

  if (!isHelpModeActive) {
    return null
  }

  const getTooltipPosition = (
    annotation: HelpAnnotation,
    position: AnnotationPosition
  ): React.CSSProperties => {
    const tooltipWidth = 280
    const tooltipHeight = 120 // Approximate
    const offset = 12

    switch (annotation.position || 'bottom') {
      case 'top':
        return {
          top: position.top - tooltipHeight - offset,
          left: position.left + position.width / 2 - tooltipWidth / 2,
        }
      case 'bottom':
        return {
          top: position.top + position.height + offset,
          left: position.left + position.width / 2 - tooltipWidth / 2,
        }
      case 'left':
        return {
          top: position.top + position.height / 2 - tooltipHeight / 2,
          left: position.left - tooltipWidth - offset,
        }
      case 'right':
        return {
          top: position.top + position.height / 2 - tooltipHeight / 2,
          left: position.left + position.width + offset,
        }
      default:
        return {
          top: position.top + position.height + offset,
          left: position.left + position.width / 2 - tooltipWidth / 2,
        }
    }
  }

  return (
    <>
      {/* Semi-transparent overlay - muted, still allows interaction */}
      <div
        className="fixed inset-0 bg-background/40 backdrop-blur-[1px] z-[9998] pointer-events-none"
        aria-hidden="true"
      />

      {/* Close button and instructions */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[10001] pointer-events-auto">
        <div className="bg-primary text-primary-foreground rounded-lg px-4 py-2 shadow-lg flex items-center gap-4">
          <span className="text-sm font-medium">
            Help Mode Active - Click anywhere or press Esc to exit
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={disableHelpMode}
            className="h-7"
          >
            <X className="h-4 w-4 mr-1" />
            Exit
          </Button>
        </div>
      </div>

      {/* Highlight rings around annotated elements */}
      {visibleAnnotations.map(({ annotation, position }) => (
        <div
          key={annotation.id}
          className="fixed border-2 border-primary rounded-lg z-[9999] pointer-events-none animate-pulse"
          style={{
            top: position.top - 4,
            left: position.left - 4,
            width: position.width + 8,
            height: position.height + 8,
          }}
        />
      ))}

      {/* Tooltip cards */}
      {visibleAnnotations.map(({ annotation, position }) => {
        const tooltipStyle = getTooltipPosition(annotation, position)

        return (
          <div
            key={`tooltip-${annotation.id}`}
            className={cn(
              "fixed z-[10000] w-[280px] bg-card border border-border rounded-lg shadow-xl p-4",
              "pointer-events-auto"
            )}
            style={tooltipStyle}
          >
            {/* Arrow indicator */}
            <div
              className={cn(
                "absolute w-3 h-3 bg-card border-border rotate-45",
                annotation.position === 'bottom' && "-top-1.5 left-1/2 -translate-x-1/2 border-t border-l",
                annotation.position === 'top' && "-bottom-1.5 left-1/2 -translate-x-1/2 border-b border-r",
                annotation.position === 'left' && "-right-1.5 top-1/2 -translate-y-1/2 border-t border-r",
                annotation.position === 'right' && "-left-1.5 top-1/2 -translate-y-1/2 border-b border-l",
                (!annotation.position || annotation.position === 'bottom') && "-top-1.5 left-1/2 -translate-x-1/2 border-t border-l"
              )}
            />
            <h4 className="font-semibold text-sm mb-1">{annotation.title}</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {annotation.description}
            </p>
          </div>
        )
      })}

      {/* Click anywhere to dismiss */}
      <div
        className="fixed inset-0 z-[9997] cursor-pointer"
        onClick={disableHelpMode}
        aria-label="Click to exit help mode"
      />
    </>
  )
}
