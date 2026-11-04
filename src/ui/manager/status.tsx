import { Circle, CircleCheck, CircleDot, Eye } from 'lucide-react'
import type { ItemStatus } from '@/core/model/manager'

/** Status is always icon + label, never colour alone. */
export function StatusIcon({ status, size = 13 }: { status: ItemStatus; size?: number }) {
  const common = { size, strokeWidth: 2, className: 'shrink-0', 'aria-hidden': true }
  switch (status) {
    case 'todo':
      return <Circle {...common} className="shrink-0 text-muted" />
    case 'doing':
      return <CircleDot {...common} className="shrink-0 text-accent" />
    case 'review':
      return <Eye {...common} className="shrink-0 text-classical" />
    case 'done':
      return <CircleCheck {...common} className="shrink-0 text-integration" />
  }
}

export const LANE_VAR = {
  classical: 'var(--lane-classical)',
  quantum: 'var(--lane-quantum)',
  integration: 'var(--lane-integration)',
} as const
