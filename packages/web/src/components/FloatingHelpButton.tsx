import { X } from 'lucide-react'
import { useHelpMode } from '@/context/HelpModeContext'
import { cn } from '@/lib/utils'

export function FloatingHelpButton() {
  const { isHelpModeActive, toggleHelpMode } = useHelpMode()

  return (
    <div className="fixed bottom-6 right-6 z-[9990] group">
      <button
        onClick={toggleHelpMode}
        className={cn(
          "h-10 w-10 rounded-full shadow-lg transition-all duration-200",
          "hover:scale-105 hover:shadow-xl flex items-center justify-center",
          "bg-blue-600 hover:bg-blue-700"
        )}
        title={isHelpModeActive ? "Exit Help Mode (Shift+?)" : "Enter Help Mode (Shift+?)"}
      >
        {isHelpModeActive ? (
          <X className="h-4 w-4 text-white" strokeWidth={2.5} />
        ) : (
          <span className="text-white text-lg font-bold">?</span>
        )}
      </button>

      {/* Label that appears on hover - positioned above the button */}
      <div className="absolute bottom-full right-0 mb-2 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
        <div className="bg-popover text-popover-foreground text-xs rounded-md px-2 py-1 shadow-md whitespace-nowrap">
          {isHelpModeActive ? "Exit Help Mode" : "Help Mode"}
          <span className="ml-1 text-muted-foreground">(Shift+?)</span>
        </div>
      </div>
    </div>
  )
}
