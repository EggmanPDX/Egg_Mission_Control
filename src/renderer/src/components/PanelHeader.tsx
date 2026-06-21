import { StatusDot } from './StatusDot'

interface PanelHeaderProps {
  label: string
  shortLabel?: string
  dotState: 'ok' | 'stale' | 'error' | 'loading' | 'not-configured'
  staleLabel?: string
  flashDot?: boolean
}

export function PanelHeader({ label, shortLabel, dotState, staleLabel, flashDot }: PanelHeaderProps) {
  return (
    <div className="flex items-center justify-between px-3 h-9 bg-mc-surface-raised border-b border-mc-border flex-shrink-0">
      <span className="text-mc-xs uppercase font-mono tracking-widest text-mc-text-label">
        <span className="hidden sm:inline">{label}</span>
        <span className="sm:hidden">{shortLabel ?? label}</span>
      </span>
      <div className="flex items-center gap-1.5">
        {staleLabel && (
          <span className="text-mc-sm text-mc-stale bg-mc-D8-bg px-1.5 py-0.5 rounded-mc-sm">
            ⬤ {staleLabel}
          </span>
        )}
        <StatusDot state={dotState} flash={flashDot} />
      </div>
    </div>
  )
}
