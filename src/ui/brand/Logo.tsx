/**
 * QIDEA mark: a Bloch sphere whose state vector forms the tail of the "Q".
 * The wordmark is the mark followed by "IDEA" — Q + IDE + A = QIDEA.
 */
interface MarkProps {
  size?: number
  animate?: boolean
  className?: string
}

export function QideaMark({ size = 24, animate = false, className }: MarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 30 30"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path d="M15 4.5 V24.5" stroke="var(--muted)" strokeWidth="1" strokeDasharray="1.5 2" opacity=".7" />
      <ellipse cx="15" cy="14.5" rx="9.5" ry="3" stroke="var(--muted)" strokeWidth="1" opacity=".7" />
      <circle cx="15" cy="14.5" r="9.5" stroke="var(--accent)" strokeWidth="2.4" />
      <g className={animate ? 'qidea-vector-animate' : undefined}>
        <path d="M15 14.5 L24.6 24.1" stroke="var(--accent)" strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="26" cy="25.5" r="2.6" fill="var(--accent)" />
      </g>
      <circle cx="15" cy="14.5" r="1.7" fill="var(--accent)" />
    </svg>
  )
}

interface WordmarkProps {
  size?: number
  animate?: boolean
}

export function QideaWordmark({ size = 24, animate = false }: WordmarkProps) {
  return (
    <span
      className="inline-flex items-center font-semibold text-text"
      style={{ fontSize: size * 0.92, letterSpacing: '0.04em', gap: size * 0.06 }}
      role="img"
      aria-label="QIDEA"
    >
      <QideaMark size={size * 1.15} animate={animate} />
      <span aria-hidden="true">IDEA</span>
    </span>
  )
}
