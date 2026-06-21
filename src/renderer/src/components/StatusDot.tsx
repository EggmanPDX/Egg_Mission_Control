interface StatusDotProps {
  state: 'ok' | 'stale' | 'error' | 'loading' | 'not-configured'
  flash?: boolean
}

export function StatusDot({ state, flash }: StatusDotProps) {
  const color = {
    ok: 'bg-mc-ok',
    stale: 'bg-mc-stale',
    error: 'bg-mc-error',
    loading: 'bg-mc-text-faint animate-pulse',
    'not-configured': 'bg-mc-text-faint',
  }[state]

  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${color} ${flash ? 'animate-ping' : ''}`}
      aria-hidden="true"
    />
  )
}
