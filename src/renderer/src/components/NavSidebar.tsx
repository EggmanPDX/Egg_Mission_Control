import type { NavPanelId } from '../types'

interface NavItem {
  id: NavPanelId
  label: string
  icon: JSX.Element
}

// Simple inline stroke icons — no icon library dependency, matches the app's existing
// minimal-glyph aesthetic rather than pulling in a new package for six icons.
const ICON_PROPS = { viewBox: '0 0 20 20', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

const CalendarIcon = () => (
  <svg {...ICON_PROPS} className="w-[18px] h-[18px]">
    <rect x="3" y="4" width="14" height="13" rx="1.5" />
    <path d="M3 8h14M7 2.5v3M13 2.5v3" />
  </svg>
)
const MailIcon = () => (
  <svg {...ICON_PROPS} className="w-[18px] h-[18px]">
    <rect x="2.5" y="4.5" width="15" height="11" rx="1.5" />
    <path d="M3 5.5l7 5.5 7-5.5" />
  </svg>
)
const CheckCircleIcon = () => (
  <svg {...ICON_PROPS} className="w-[18px] h-[18px]">
    <circle cx="10" cy="10" r="7.25" />
    <path d="M6.75 10.25l2 2 4.5-4.5" />
  </svg>
)
const LayersIcon = () => (
  <svg {...ICON_PROPS} className="w-[18px] h-[18px]">
    <path d="M10 3l7 3.5-7 3.5-7-3.5L10 3z" />
    <path d="M3 10.5l7 3.5 7-3.5M3 14l7 3.5L17 14" />
  </svg>
)
const LeafIcon = () => (
  <svg {...ICON_PROPS} className="w-[18px] h-[18px]">
    <path d="M4 16c-.5-6 3-11.5 12-12 .5 6-3 11.5-12 12z" />
    <path d="M5 15c3-3 6-6 10-11" />
  </svg>
)
const RadarIcon = () => (
  <svg {...ICON_PROPS} className="w-[18px] h-[18px]">
    <circle cx="10" cy="10" r="7.25" />
    <circle cx="10" cy="10" r="3.75" />
    <circle cx="10" cy="10" r="0.75" fill="currentColor" />
  </svg>
)
const GearIcon = () => (
  <svg {...ICON_PROPS} className="w-[16px] h-[16px]">
    <circle cx="10" cy="10" r="2.75" />
    <path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.75 4.75l1.4 1.4M13.85 13.85l1.4 1.4M4.75 15.25l1.4-1.4M13.85 6.15l1.4-1.4" />
  </svg>
)

const NAV_ITEMS: NavItem[] = [
  { id: 'meeting', label: 'Meeting Brief', icon: <CalendarIcon /> },
  { id: 'inbox', label: 'Inbox Pulse', icon: <MailIcon /> },
  { id: 'd8', label: 'D8 Tasks', icon: <CheckCircleIcon /> },
  { id: 'bgc', label: 'BGC Tasks', icon: <LayersIcon /> },
  { id: 'egg', label: 'Egg Tasks', icon: <LeafIcon /> },
  { id: 'jobRadar', label: 'Job Radar', icon: <RadarIcon /> },
]

interface NavSidebarProps {
  active: NavPanelId
  onSelect: (id: NavPanelId) => void
  onOpenSettings: () => void
}

export function NavSidebar({ active, onSelect, onOpenSettings }: NavSidebarProps) {
  return (
    <nav
      role="navigation"
      aria-label="Mission Control pages"
      className="w-14 flex-shrink-0 h-full bg-mc-sidebar border-r border-mc-sidebar-border flex flex-col items-center py-3"
    >
      <div className="flex flex-col items-center gap-1">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            title={item.label}
            aria-label={item.label}
            aria-current={active === item.id ? 'page' : undefined}
            onClick={() => onSelect(item.id)}
            className={`w-9 h-9 flex items-center justify-center rounded-mc-md focus:outline-none focus:ring-1 focus:ring-mc-d8 transition-colors
              ${active === item.id
                ? 'bg-mc-sidebar-active text-white'
                : 'text-mc-text-muted hover:text-mc-text-secondary hover:bg-white/5'}`}
          >
            {item.icon}
          </button>
        ))}
      </div>

      <div className="flex-1" />

      <button
        title="Notion setup"
        aria-label="Notion setup"
        onClick={onOpenSettings}
        className="w-9 h-9 flex items-center justify-center rounded-mc-md text-mc-text-muted hover:text-mc-text-secondary hover:bg-white/5 focus:outline-none focus:ring-1 focus:ring-mc-d8"
      >
        <GearIcon />
      </button>
    </nav>
  )
}
