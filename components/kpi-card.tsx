import { Card, CardContent } from '@/components/ui/card'
import { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface KPICardProps {
  label: string
  value: string | number
  unit?: string
  icon?: LucideIcon
  trend?: {
    value: number
    isPositive: boolean
  }
  className?: string
}

export function KPICard({
  label,
  value,
  unit,
  icon: Icon,
  trend,
  className,
}: KPICardProps) {
  return (
    <Card className={cn('bg-card border-border', className)}>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-foreground">{value}</span>
              {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
            </div>
            {trend && (
              <div className="mt-2 text-xs font-medium">
                <span className={cn(
                  trend.isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                )}>
                  {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
                </span>
              </div>
            )}
          </div>
          {Icon && (
            <div className="flex-shrink-0">
              <Icon className="w-8 h-8 text-primary/60" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
