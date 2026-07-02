import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/renderer/**/*.{ts,tsx}', './src/renderer/index.html'],
  theme: {
    extend: {
      colors: {
        mc: {
          base:             '#0a0a0a',
          surface:          '#111111',
          'surface-raised': '#151515',
          border:           '#1e1e1e',
          'border-subtle':  '#2a2a2a',
          d8:               '#5b9cf6',
          'D8-bg':          '#1a3a6b',
          'D8-border':      '#2a4a7b',
          egg:              '#5bc45b',
          'egg-bg':         '#1a3a1a',
          'egg-border':     '#2a4a2a',
          bgc:              '#e0a13c',
          'bgc-bg':         '#4a3a1a',
          'bgc-border':     '#6b552a',
          ok:               '#28c840',
          stale:            '#febc2e',
          error:            '#ff5f57',
          'priority-p1':    '#ff5f57',
          'priority-p2':    '#febc2e',
          'priority-p3':    '#444444',
          'text-primary':   '#e2e2e2',
          'text-secondary': '#bbbbbb',
          'text-muted':     '#666666',
          'text-faint':     '#444444',
          'text-label':     '#555555',

          // Light-canvas theme (nav sidebar stays dark; canvas content area is light) —
          // introduced for the left-nav redesign per design team mockups.
          sidebar:          '#0f1a2e',
          'sidebar-active': '#1e3a6b',
          'sidebar-border': '#1c2b46',
          canvas:           '#ffffff',
          'canvas-alt':     '#f6f7f9',
          'canvas-border':  '#e5e7eb',
          ink:              '#111827',
          'ink-muted':      '#6b7280',
          'ink-faint':      '#9ca3af',
          'pill-blue-bg':   '#dbeafe',
          'pill-blue-text': '#1e40af',
          'pill-red-bg':    '#fee2e2',
          'pill-red-text':  '#b91c1c',
          'pill-gray-bg':   '#f3f4f6',
          'pill-gray-text': '#4b5563',
        }
      },
      borderRadius: {
        'mc-sm': '4px',
        'mc-md': '6px',
        'mc-lg': '10px',
      },
      fontSize: {
        'mc-xs':   ['10px', { lineHeight: '1.4', letterSpacing: '0.1em' }],
        'mc-sm':   ['11px', { lineHeight: '1.4' }],
        'mc-base': ['12px', { lineHeight: '1.4' }],
        'mc-body': ['13px', { lineHeight: '1.4' }],
        'mc-lg':   ['20px', { lineHeight: '1.2' }],
        'mc-xl':   ['32px', { lineHeight: '1', fontVariantNumeric: 'tabular-nums' }],
      }
    }
  },
  plugins: []
}

export default config
