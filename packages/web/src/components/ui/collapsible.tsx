import * as React from "react"
import { cn } from "@/lib/utils"

interface CollapsibleProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
  className?: string
}

interface CollapsibleTriggerProps {
  asChild?: boolean
  children: React.ReactNode
  className?: string
}

interface CollapsibleContentProps {
  children: React.ReactNode
  className?: string
}

const CollapsibleContext = React.createContext<{
  open: boolean
  onOpenChange: (open: boolean) => void
}>({ open: false, onOpenChange: () => {} })

const Collapsible = React.forwardRef<HTMLDivElement, CollapsibleProps>(
  ({ open = false, onOpenChange, children, className }, ref) => {
    const [internalOpen, setInternalOpen] = React.useState(open)
    const isOpen = onOpenChange ? open : internalOpen
    const handleOpenChange = onOpenChange || setInternalOpen

    return (
      <CollapsibleContext.Provider value={{ open: isOpen, onOpenChange: handleOpenChange }}>
        <div ref={ref} className={cn(className)}>
          {children}
        </div>
      </CollapsibleContext.Provider>
    )
  }
)
Collapsible.displayName = "Collapsible"

const CollapsibleTrigger = React.forwardRef<HTMLDivElement, CollapsibleTriggerProps>(
  ({ asChild, children, className }, ref) => {
    const { open, onOpenChange } = React.useContext(CollapsibleContext)

    const handleClick = () => {
      onOpenChange(!open)
    }

    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children as React.ReactElement<{ onClick?: () => void; className?: string }>, {
        onClick: handleClick,
        className: cn((children as React.ReactElement<{ className?: string }>).props.className, className),
      })
    }

    return (
      <div
        ref={ref}
        className={cn("cursor-pointer", className)}
        onClick={handleClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            handleClick()
          }
        }}
      >
        {children}
      </div>
    )
  }
)
CollapsibleTrigger.displayName = "CollapsibleTrigger"

const CollapsibleContent = React.forwardRef<HTMLDivElement, CollapsibleContentProps>(
  ({ children, className }, ref) => {
    const { open } = React.useContext(CollapsibleContext)

    if (!open) return null

    return (
      <div
        ref={ref}
        className={cn("overflow-hidden", className)}
      >
        {children}
      </div>
    )
  }
)
CollapsibleContent.displayName = "CollapsibleContent"

export { Collapsible, CollapsibleTrigger, CollapsibleContent }
