import { useState, useEffect } from 'react'
import { Rocket, Zap, Calendar, RefreshCw, CheckCircle2, ChevronRight, ChevronLeft, X, Flame, Moon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import type { UserPreferences, EnergyLevel } from '@trackmind/core'

interface OnboardingWizardProps {
  open: boolean
  onClose: () => void
  onComplete: (options: OnboardingOptions) => void
  preferences: UserPreferences
  onUpdatePreferences: (prefs: UserPreferences) => void
}

interface OnboardingOptions {
  addSampleData: boolean
}

type WizardStep = 'welcome' | 'energy' | 'sample' | 'done'

const STEPS: WizardStep[] = ['welcome', 'energy', 'sample', 'done']

const energyOptions: { value: EnergyLevel; label: string; icon: React.ReactNode; description: string }[] = [
  { value: 'high', label: 'High Energy', icon: <Flame className="h-4 w-4 text-orange-500" />, description: 'Best for challenging tasks' },
  { value: 'medium', label: 'Medium Energy', icon: <Zap className="h-4 w-4 text-yellow-500" />, description: 'Good for regular work' },
  { value: 'low', label: 'Low Energy', icon: <Moon className="h-4 w-4 text-blue-400" />, description: 'For lighter, routine tasks' },
]

export function OnboardingWizard({
  open,
  onClose,
  onComplete,
  preferences,
  onUpdatePreferences,
}: OnboardingWizardProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>('welcome')
  const [addSampleData, setAddSampleData] = useState(true)

  // Simplified energy state - just morning/afternoon/evening
  const [morningEnergy, setMorningEnergy] = useState<EnergyLevel>('high')
  const [afternoonEnergy, setAfternoonEnergy] = useState<EnergyLevel>('medium')
  const [eveningEnergy, setEveningEnergy] = useState<EnergyLevel>('low')

  // Reset to first step when wizard opens
  useEffect(() => {
    if (open) {
      setCurrentStep('welcome')
      setAddSampleData(true)
    }
  }, [open])

  const currentStepIndex = STEPS.indexOf(currentStep)
  const progress = ((currentStepIndex + 1) / STEPS.length) * 100

  const handleNext = () => {
    const nextIndex = currentStepIndex + 1
    if (nextIndex < STEPS.length) {
      setCurrentStep(STEPS[nextIndex])
    }
  }

  const handleBack = () => {
    const prevIndex = currentStepIndex - 1
    if (prevIndex >= 0) {
      setCurrentStep(STEPS[prevIndex])
    }
  }

  const handleSkip = () => {
    // Mark as skipped in preferences
    const updatedPrefs: UserPreferences = {
      ...preferences,
      onboarding: {
        completed: false,
        skippedAt: new Date().toISOString(),
        sampleDataAdded: false,
      },
    }
    onUpdatePreferences(updatedPrefs)
    onClose()
  }

  const handleFinish = () => {
    // Apply energy patterns based on user selection
    const createEnergyPattern = (morning: EnergyLevel, afternoon: EnergyLevel, evening: EnergyLevel) => [
      { start: '08:00', end: '12:00', level: morning },
      { start: '12:00', end: '17:00', level: afternoon },
      { start: '17:00', end: '22:00', level: evening },
    ]

    const energyPattern = createEnergyPattern(morningEnergy, afternoonEnergy, eveningEnergy)

    const updatedPrefs: UserPreferences = {
      ...preferences,
      energy_patterns: {
        monday: energyPattern,
        tuesday: energyPattern,
        wednesday: energyPattern,
        thursday: energyPattern,
        friday: energyPattern,
        saturday: energyPattern,
        sunday: energyPattern,
      },
      onboarding: {
        completed: true,
        completedAt: new Date().toISOString(),
        sampleDataAdded: addSampleData,
      },
    }

    onUpdatePreferences(updatedPrefs)
    onComplete({ addSampleData })
    onClose()
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 'welcome':
        return (
          <div className="space-y-6 py-4">
            <div className="text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Rocket className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Welcome to TrackMind!</h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                A smart task manager that schedules your work based on your energy patterns
                throughout the day.
              </p>
            </div>

            <div className="grid gap-4 max-w-md mx-auto">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <Zap className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <h4 className="font-medium">Energy-Based Scheduling</h4>
                  <p className="text-sm text-muted-foreground">
                    Tasks are scheduled when your energy matches their difficulty
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <Calendar className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <h4 className="font-medium">Smart Planning</h4>
                  <p className="text-sm text-muted-foreground">
                    Automatic scheduling based on priorities and deadlines
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <RefreshCw className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <h4 className="font-medium">Habit Tracking</h4>
                  <p className="text-sm text-muted-foreground">
                    Build routines with recurring tasks and streak tracking
                  </p>
                </div>
              </div>
            </div>

            <p className="text-center text-sm text-muted-foreground">
              Let's set up TrackMind in just a few steps!
            </p>
          </div>
        )

      case 'energy':
        return (
          <div className="space-y-6 py-4">
            <div className="text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Zap className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold mb-2">When are you most productive?</h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                TrackMind schedules demanding tasks when your energy is high,
                and easier tasks when it's low.
              </p>
            </div>

            <div className="space-y-4 max-w-sm mx-auto">
              {/* Morning */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Morning (8am - 12pm)
                </Label>
                <Select value={morningEnergy} onValueChange={(v) => setMorningEnergy(v as EnergyLevel)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {energyOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex items-center gap-2">
                          {option.icon}
                          <span>{option.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Afternoon */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Afternoon (12pm - 5pm)
                </Label>
                <Select value={afternoonEnergy} onValueChange={(v) => setAfternoonEnergy(v as EnergyLevel)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {energyOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex items-center gap-2">
                          {option.icon}
                          <span>{option.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Evening */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Evening (5pm - 10pm)
                </Label>
                <Select value={eveningEnergy} onValueChange={(v) => setEveningEnergy(v as EnergyLevel)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {energyOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex items-center gap-2">
                          {option.icon}
                          <span>{option.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <p className="text-center text-sm text-muted-foreground">
              You can fine-tune these in Settings → Energy Patterns later
            </p>
          </div>
        )

      case 'sample':
        return (
          <div className="space-y-6 py-4">
            <div className="text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <RefreshCw className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Ready to try it out?</h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                We can add some example data to help you see how TrackMind works.
              </p>
            </div>

            <div className="max-w-sm mx-auto space-y-4">
              <div
                className={cn(
                  "p-4 rounded-lg border-2 cursor-pointer transition-all",
                  addSampleData
                    ? "border-primary bg-primary/5"
                    : "border-muted hover:border-muted-foreground/30"
                )}
                onClick={() => setAddSampleData(true)}
              >
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={addSampleData}
                    onCheckedChange={() => setAddSampleData(true)}
                    className="mt-1"
                  />
                  <div>
                    <h4 className="font-medium">Add sample data (Recommended)</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      Creates a "Getting Started" project with example tasks and a sample habit.
                      Click "Reschedule" to see the smart scheduling in action!
                    </p>
                  </div>
                </div>
              </div>

              <div
                className={cn(
                  "p-4 rounded-lg border-2 cursor-pointer transition-all",
                  !addSampleData
                    ? "border-primary bg-primary/5"
                    : "border-muted hover:border-muted-foreground/30"
                )}
                onClick={() => setAddSampleData(false)}
              >
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={!addSampleData}
                    onCheckedChange={() => setAddSampleData(false)}
                    className="mt-1"
                  />
                  <div>
                    <h4 className="font-medium">Start fresh</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      Begin with an empty workspace and create everything from scratch.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {addSampleData && (
              <div className="max-w-sm mx-auto p-3 bg-muted/50 rounded-lg">
                <h5 className="font-medium text-sm mb-2">Sample data includes:</h5>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-3 w-3 text-primary" />
                    Project: "Getting Started with TrackMind"
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-3 w-3 text-primary" />
                    4 tasks with different priorities & energy levels
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-3 w-3 text-primary" />
                    1 daily habit example (weekdays at 9:00 AM)
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-3 w-3 text-primary" />
                    1 goal linked to the project, tasks, and habit
                  </li>
                </ul>
              </div>
            )}
          </div>
        )

      case 'done':
        return (
          <div className="space-y-6 py-4">
            <div className="text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mb-4">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              </div>
              <h2 className="text-2xl font-bold mb-2">You're all set!</h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                TrackMind is ready to help you stay productive.
              </p>
            </div>

            <div className="max-w-md mx-auto space-y-3">
              <div className="p-3 rounded-lg bg-muted/50">
                <h4 className="font-medium text-sm">Quick tips to get started:</h4>
                <ul className="text-sm text-muted-foreground mt-2 space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-bold">1.</span>
                    {addSampleData
                      ? 'Click "Reschedule" in Today view to see smart scheduling'
                      : 'Create a project and add some tasks'}
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-bold">2.</span>
                    Use Quick Capture to add tasks with natural language
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-bold">3.</span>
                    Click the help button (?) in the bottom-right for interactive help
                  </li>
                </ul>
              </div>

              <p className="text-center text-sm text-muted-foreground">
                Access this wizard anytime from Settings → Help
              </p>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleSkip()}>
      <DialogContent className="sm:max-w-lg" hideCloseButton>
        <DialogHeader className="sr-only">
          <DialogTitle>Setup Wizard</DialogTitle>
          <DialogDescription>Configure your TrackMind preferences</DialogDescription>
        </DialogHeader>

        {/* Progress bar */}
        <div className="absolute top-0 left-0 right-0 h-1">
          <Progress value={progress} className="h-1 rounded-none" />
        </div>

        {/* Skip button */}
        <button
          onClick={handleSkip}
          className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Skip setup</span>
        </button>

        {/* Step indicators */}
        <div className="flex justify-center gap-2 pt-4">
          {STEPS.map((step, index) => (
            <div
              key={step}
              className={cn(
                "w-2 h-2 rounded-full transition-colors",
                index <= currentStepIndex ? "bg-primary" : "bg-muted"
              )}
            />
          ))}
        </div>

        {/* Content */}
        {renderStepContent()}

        {/* Navigation */}
        <div className="flex justify-between pt-4 border-t">
          {currentStep !== 'welcome' ? (
            <Button variant="ghost" onClick={handleBack}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          ) : (
            <Button variant="ghost" onClick={handleSkip}>
              Skip Setup
            </Button>
          )}

          {currentStep !== 'done' ? (
            <Button onClick={handleNext}>
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleFinish}>
              Get Started
              <Rocket className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
