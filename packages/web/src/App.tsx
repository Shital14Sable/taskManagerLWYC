import { Dashboard } from '@/pages/Dashboard'
import { useApp } from '@/context/AppContext'
import { HelpModeProvider } from '@/context/HelpModeContext'
import { HelpOverlay } from '@/components/HelpOverlay'
import { FloatingHelpButton } from '@/components/FloatingHelpButton'

function App() {
  const { isInitialized, initError } = useApp()

  if (initError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center p-8">
          <h1 className="text-2xl font-bold text-destructive mb-4">Initialization Error</h1>
          <p className="text-muted-foreground">{initError}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading TrackMind...</p>
        </div>
      </div>
    )
  }

  return (
    <HelpModeProvider>
      <Dashboard />
      <HelpOverlay />
      <FloatingHelpButton />
    </HelpModeProvider>
  )
}

export default App
