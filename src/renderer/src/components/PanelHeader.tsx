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
    <div className="flex items-center justify-between px-4 h-11 bg-mc-canvas-alt border-b border-mc-canvas-border flex-shrink-0">
      <span className="text-mc-xs uppercase font-mono tracking-widest text-mc-ink-muted font-semibold">
        <span className="hidden sm:inline">{label}</span>
        <span className="sm:hidden">{shortLabel ?? label}</span>
      </span>
      <div className="flex items-center gap-1.5">
        {staleLabel && (
          <span className="text-mc-sm text-[#92620a] bg-[#fdf1dc] px-1.5 py-0.5 rounded-mc-sm">
            ⬤ {staleLabel}
          </span>
        )}
        <StatusDot state={dotState} flash={flashDot} />
      </div>
    </div>
  )
}
