import { useEffect, useState } from 'react'
import { Sparkles, Award } from 'lucide-react'
import type { Badge } from '@/types'

interface XPNotificationProps {
  xpEarned: number
  newLevel?: number
  newBadges?: Badge[]
  onClose: () => void
}

export function XPNotification({ xpEarned, newLevel, newBadges = [], onClose }: XPNotificationProps) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false)
      setTimeout(onClose, 300) // Wait for fade animation
    }, 3000)

    return () => clearTimeout(timer)
  }, [onClose])

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 transition-all duration-300 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      }`}
    >
      <div className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-lg shadow-lg p-4 min-w-[200px]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="font-bold text-lg">+{xpEarned} XP</div>
            {newLevel && (
              <div className="text-sm opacity-90">Level up! Now level {newLevel}</div>
            )}
          </div>
        </div>

        {newBadges.length > 0 && (
          <div className="mt-3 pt-3 border-t border-white/20">
            <div className="text-sm font-medium flex items-center gap-1 mb-2">
              <Award className="h-4 w-4" />
              New Badge{newBadges.length > 1 ? 's' : ''}!
            </div>
            {newBadges.map((badge) => (
              <div key={badge.type} className="text-sm opacity-90">
                🏆 {badge.name}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default XPNotification
