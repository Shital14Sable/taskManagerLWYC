interface PieChartSegment {
  value: number
  color: string
  label: string
}

interface PieChartProps {
  segments: PieChartSegment[]
  size?: number
  innerRadius?: number
  showLegend?: boolean
  centerLabel?: string
  centerValue?: string
}

export function PieChart({
  segments,
  size = 200,
  innerRadius = 60,
  showLegend = true,
  centerLabel,
  centerValue
}: PieChartProps) {
  const total = segments.reduce((sum, s) => sum + s.value, 0)
  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={(size - 20) / 2}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth={size / 2 - innerRadius}
          />
        </svg>
        <p className="text-sm text-muted-foreground mt-2">No data</p>
      </div>
    )
  }

  const radius = (size - 20) / 2
  const center = size / 2

  let currentAngle = -90 // Start from top

  const paths = segments.map((segment, index) => {
    if (segment.value === 0) return null

    const percentage = segment.value / total
    const angle = percentage * 360
    const startAngle = currentAngle
    const endAngle = currentAngle + angle
    currentAngle = endAngle

    const startRad = (startAngle * Math.PI) / 180
    const endRad = (endAngle * Math.PI) / 180

    const x1 = center + radius * Math.cos(startRad)
    const y1 = center + radius * Math.sin(startRad)
    const x2 = center + radius * Math.cos(endRad)
    const y2 = center + radius * Math.sin(endRad)

    const innerX1 = center + innerRadius * Math.cos(startRad)
    const innerY1 = center + innerRadius * Math.sin(startRad)
    const innerX2 = center + innerRadius * Math.cos(endRad)
    const innerY2 = center + innerRadius * Math.sin(endRad)

    const largeArc = angle > 180 ? 1 : 0

    const d = [
      `M ${x1} ${y1}`,
      `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
      `L ${innerX2} ${innerY2}`,
      `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${innerX1} ${innerY1}`,
      'Z'
    ].join(' ')

    return (
      <path
        key={index}
        d={d}
        fill={segment.color}
        className="transition-all hover:opacity-80"
      >
        <title>{`${segment.label}: ${segment.value} (${(percentage * 100).toFixed(1)}%)`}</title>
      </path>
    )
  })

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {paths}
        </svg>
        {(centerLabel || centerValue) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {centerValue && (
              <span className="text-3xl font-bold">{centerValue}</span>
            )}
            {centerLabel && (
              <span className="text-sm text-muted-foreground">{centerLabel}</span>
            )}
          </div>
        )}
      </div>
      {showLegend && (
        <div className="flex flex-wrap justify-center gap-3">
          {segments.map((segment, index) => (
            <div key={index} className="flex items-center gap-1.5 text-sm">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: segment.color }}
              />
              <span className="text-muted-foreground">{segment.label}</span>
              <span className="font-medium">{segment.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
