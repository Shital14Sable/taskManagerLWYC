interface BarData {
  label: string
  value: number
  color?: string
}

interface BarChartProps {
  data: BarData[]
  height?: number
  showValues?: boolean
  horizontal?: boolean
  maxValue?: number
}

export function BarChart({
  data,
  height = 200,
  showValues = true,
  horizontal = false,
  maxValue: customMax
}: BarChartProps) {
  const maxValue = customMax || Math.max(...data.map(d => d.value), 1)

  if (horizontal) {
    return (
      <div className="space-y-3">
        {data.map((item, index) => (
          <div key={index} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground truncate max-w-[150px]">{item.label}</span>
              {showValues && <span className="font-medium">{item.value}</span>}
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${(item.value / maxValue) * 100}%`,
                  backgroundColor: item.color || 'hsl(var(--primary))'
                }}
              />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="flex items-end gap-2" style={{ height }}>
      {data.map((item, index) => {
        const barHeight = (item.value / maxValue) * (height - 40)
        return (
          <div key={index} className="flex-1 flex flex-col items-center gap-1">
            {showValues && (
              <span className="text-xs font-medium">{item.value}</span>
            )}
            <div
              className="w-full rounded-t transition-all duration-500 hover:opacity-80"
              style={{
                height: Math.max(barHeight, 4),
                backgroundColor: item.color || 'hsl(var(--primary))',
                minHeight: 4
              }}
              title={`${item.label}: ${item.value}`}
            />
            <span className="text-xs text-muted-foreground truncate max-w-full text-center">
              {item.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}
