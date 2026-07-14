import { useState } from 'react'
import { PanelHeader } from '../components/PanelHeader'
import { SkeletonBars } from '../components/SkeletonBars'
import type { PanelState, ProjectRollupEntry, ProjectHealth } from '../types'

const HEALTH_STYLE: Record<ProjectHealth, { text: string; bg: string; dot: string }> = {
  'On Track': { text: 'text-mc-d8', bg: 'bg-mc-pill-blue-bg', dot: 'bg-mc-d8' },
  'At Risk': { text: 'text-[#92620a]', bg: 'bg-[#fdf1dc]', dot: 'bg-[#e0a30c]' },
  'Off Track': { text: 'text-mc-error', bg: 'bg-mc-error bg-opacity-10', dot: 'bg-mc-error' },
}

const WORKSPACE_LABEL: Record<string, string> = { D8: 'D8', BGC: 'BGC', EGG: 'Egg' }

function formatLastTouched(iso: string): string {
  const parsed = new Date(iso)
  if (isNaN(parsed.getTime())) return iso
  const days = Math.round((Date.now() - parsed.getTime()) / 86400000)
  if (days < 1) return 'today'
  if (days === 1) return 'yesterday'
  return `${days}d ago`
}

interface ProjectCardProps {
  project: ProjectRollupEntry
}

function ProjectCard({ project }: ProjectCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [context, setContext] = useState<string | null>(null)
  const [contextLoading, setContextLoading] = useState(false)

  async function handleToggle() {
    const next = !expanded
    setExpanded(next)
    if (next && project.tier === 'rich' && context === null && !contextLoading) {
      setContextLoading(true)
      const result = await window.api.getProjectContext(project.id)
      setContextLoading(false)
      setContext(result.ok ? (result.context ?? '') : '')
    }
  }

  const health = project.tier === 'rich' ? HEALTH_STYLE[project.healthStatus!] : null
  const showRisks = project.tier === 'rich' && !!project.gateDate && !!project.risks
  const hasDeps = project.tier === 'rich' && ((project.dependsOn?.length ?? 0) > 0 || (project.blocks?.length ?? 0) > 0)

  return (
    <div className="rounded-mc-md border border-mc-canvas-border bg-mc-canvas p-3.5">
      <button onClick={handleToggle} className="w-full text-left focus:outline-none">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-mc-body font-semibold text-mc-ink truncate">{project.title}</div>
            <div className="text-mc-sm text-mc-ink-muted">
              {project.status} · Last touched {formatLastTouched(project.lastEditedTime)}
            </div>
          </div>
          {health && (
            <span className={`flex-shrink-0 text-mc-xs font-bold uppercase tracking-widest px-2 py-0.5 rounded-mc-sm ${health.bg} ${health.text}`}>
              {project.healthStatus}
            </span>
          )}
        </div>

        {project.nextAction && (
          <p className="text-mc-sm text-mc-ink mt-2">→ {project.nextAction}</p>
        )}

        {showRisks && (
          <p className="text-mc-sm text-mc-error mt-1.5">⚠ {project.risks}</p>
        )}

        {project.tier === 'rich' && project.nextGate && (
          <p className="text-mc-xs text-mc-ink-faint mt-1.5 uppercase tracking-widest">
            Next gate: {project.nextGate}{project.gateDate ? ` — ${project.gateDate}` : ''}
          </p>
        )}

        {hasDeps && (
          <p className="text-mc-xs text-mc-ink-faint mt-1.5">
            {(project.dependsOn?.length ?? 0) > 0 && `Blocked by ${project.dependsOn!.map((d) => d.title).join(', ')}`}
            {(project.dependsOn?.length ?? 0) > 0 && (project.blocks?.length ?? 0) > 0 && ' · '}
            {(project.blocks?.length ?? 0) > 0 && `Blocking ${project.blocks!.map((d) => d.title).join(', ')}`}
          </p>
        )}
      </button>

      {expanded && project.tier === 'rich' && (
        <div className="mt-3 pt-3 border-t border-mc-canvas-border text-mc-sm text-mc-ink-muted whitespace-pre-wrap">
          {contextLoading ? 'Loading…' : (context || 'No additional context written on this project yet.')}
        </div>
      )}
    </div>
  )
}

interface ProjectRollupPanelProps {
  panel: PanelState<ProjectRollupEntry[]>
}

export function ProjectRollupPanel({ panel }: ProjectRollupPanelProps) {
  const { status } = panel

  const dotState = status.state === 'error' ? 'error'
    : status.state === 'stale' ? 'stale'
    : status.state === 'loading' ? 'loading'
    : status.state === 'not-configured' ? 'not-configured'
    : 'ok'

  const grouped: Record<string, ProjectRollupEntry[]> = { D8: [], BGC: [], EGG: [] }
  for (const p of panel.data ?? []) grouped[p.workspace]?.push(p)

  return (
    <section role="region" aria-label="Project Rollup" className="flex flex-col h-full bg-mc-canvas">
      <PanelHeader label="PROJECT ROLLUP" shortLabel="PROJECTS" dotState={dotState} />

      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-4">
        {status.state === 'loading' && <SkeletonBars count={4} />}

        {status.state === 'not-configured' && (
          <div className="flex items-center justify-center h-full text-mc-ink-muted text-mc-sm">
            Connect Notion to see the project rollup.
          </div>
        )}

        {(status.state === 'ok' || status.state === 'stale' || status.state === 'empty') && (
          (['D8', 'BGC', 'EGG'] as const).map((workspace) => (
            <div key={workspace}>
              <div className="text-mc-xs font-bold uppercase tracking-widest text-mc-ink-faint mb-2">
                {WORKSPACE_LABEL[workspace]}
              </div>
              {grouped[workspace].length === 0 ? (
                <div className="text-mc-sm text-mc-ink-muted">No projects tracked yet.</div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {grouped[workspace].map((p) => <ProjectCard key={p.id} project={p} />)}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </section>
  )
}
