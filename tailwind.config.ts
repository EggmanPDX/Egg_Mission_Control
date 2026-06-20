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
