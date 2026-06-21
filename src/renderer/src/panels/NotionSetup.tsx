import { useState } from 'react'

interface NotionSetupProps {
  onSuccess: () => void
  onSkip: () => void
}

export function NotionSetup({ onSuccess, onSkip }: NotionSetupProps) {
  const [token, setToken] = useState('')
  const [state, setState] = useState<'idle' | 'validating' | 'error'>('idle')
  const [error, setError] = useState('')

  async function handleConnect() {
    if (!token.trim()) return
    setState('validating')
    setError('')

    const validation = await window.api.validateNotionToken(token.trim())
    if (!validation.ok) {
      setState('error')
      setError('Token is invalid or lacks access to Notion. Check the integration and try again.')
      return
    }

    const save = await window.api.saveNotionToken(token.trim())
    if (!save.ok) {
      setState('error')
      setError(save.error ?? 'Failed to save token.')
      return
    }

    onSuccess()
  }

  return (
    <div className="flex flex-col h-full items-center justify-center bg-mc-base px-8">
      <div className="w-full max-w-sm bg-mc-surface rounded-mc-lg border border-mc-border p-6 flex flex-col gap-5">
        {/* Header */}
        <div>
          <div className="text-mc-xs uppercase font-bold text-mc-egg mb-1 tracking-widest">MISSION CONTROL</div>
          <div className="text-mc-body font-bold text-mc-text-primary">Connect your Notion workspace</div>
          <div className="text-mc-sm text-mc-text-muted mt-1">
            Paste your Notion integration token to see D8 and Egg tasks.
          </div>
        </div>

        {/* Token input */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-mc-xs uppercase text-mc-text-muted tracking-widest">Integration Token</label>
            <a
              href="https://www.notion.so/my-integrations"
              target="_blank"
              rel="noreferrer"
              className="text-mc-xs text-mc-egg hover:underline"
              onClick={e => { e.preventDefault(); window.open('https://www.notion.so/my-integrations', '_blank') }}
            >
              Get token ↗
            </a>
          </div>
          <input
            type="password"
            value={token}
            onChange={e => setToken(e.target.value)}
            placeholder="secret_..."
            className="w-full bg-mc-surface-raised border border-mc-border-subtle rounded-mc-md px-3 py-2 text-mc-base font-mono text-mc-text-primary placeholder-mc-text-faint focus:outline-none focus:ring-1 focus:ring-mc-egg"
            disabled={state === 'validating'}
          />
          <div className="text-mc-xs text-mc-text-faint">
            Create an integration at notion.so/my-integrations and share your D8 and Egg databases with it.
          </div>
          {state === 'error' && (
            <div className="text-mc-sm text-mc-error">{error}</div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <button
            onClick={onSkip}
            className="text-mc-sm text-mc-text-faint hover:text-mc-text-muted focus:outline-none"
          >
            Skip for now
          </button>
          <button
            onClick={handleConnect}
            disabled={state === 'validating' || !token.trim()}
            className="text-mc-sm bg-mc-egg-bg text-mc-egg border border-mc-egg-border rounded-mc-md px-4 py-1.5 disabled:opacity-50 hover:brightness-110 focus:outline-none focus:ring-1 focus:ring-mc-egg"
          >
            {state === 'validating' ? 'Connecting…' : 'Connect Notion →'}
          </button>
        </div>
      </div>
    </div>
  )
}
