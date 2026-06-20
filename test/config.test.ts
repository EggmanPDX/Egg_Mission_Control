import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

// Helper to test the config loading logic with a custom path
function loadConfigWithPath(configPath: string): { config: any; error?: string } {
  const configDir = path.dirname(configPath)

  const DEFAULTS = {
    _meta: {
      registrationName: 'Mission Control (personal)',
      portalUrl: 'https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade',
      createdAt: new Date().toISOString(),
    },
    notion: {
      d8_tasks_db: 'ff6a202b-2ee2-4756-857e-f002bb15a953',
      egg_tasks_db: '052bcc79-ac77-40f0-a5ad-a99f8e868d30',
    },
    azure: {
      client_id: '',
      tenant_id: 'common',
    },
    refresh: {
      graph_interval_ms: 300000,
      notion_interval_ms: 600000,
      notification_lead_minutes: 15,
    },
  }

  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true })
  }

  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, JSON.stringify(DEFAULTS, null, 2), 'utf8')
    return { config: DEFAULTS }
  }

  try {
    const raw = fs.readFileSync(configPath, 'utf8')
    const config = { ...DEFAULTS, ...JSON.parse(raw) }
    return { config }
  } catch (e) {
    // Corrupt config — back it up and reset to defaults
    const bak = configPath + '.bak'
    fs.renameSync(configPath, bak)
    fs.writeFileSync(configPath, JSON.stringify(DEFAULTS, null, 2), 'utf8')
    return { config: DEFAULTS }
  }
}

describe('config', () => {
  const testDir = path.join(os.tmpdir(), 'mc-test-config-' + Date.now() + '-' + Math.random().toString(36).substring(7))
  const testPath = path.join(testDir, 'config.json')

  beforeEach(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true })
    }
  })

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true })
    }
  })

  it('creates default config if missing', () => {
    // Ensure config.json doesn't exist
    expect(fs.existsSync(testPath)).toBe(false)

    // Load config — should create defaults
    const result = loadConfigWithPath(testPath)

    // Verify file was created
    expect(fs.existsSync(testPath)).toBe(true)

    // Verify content contains expected defaults
    expect(result.config.notion.d8_tasks_db).toBe('ff6a202b-2ee2-4756-857e-f002bb15a953')
    expect(result.config.notion.egg_tasks_db).toBe('052bcc79-ac77-40f0-a5ad-a99f8e868d30')
    expect(result.config.azure.tenant_id).toBe('common')
    expect(result.config.refresh.graph_interval_ms).toBe(300000)

    // Verify file content is valid JSON and matches
    const fileContent = fs.readFileSync(testPath, 'utf8')
    const fileParsed = JSON.parse(fileContent)
    expect(fileParsed.notion.d8_tasks_db).toBe('ff6a202b-2ee2-4756-857e-f002bb15a953')
  })

  it('recovers from corrupt config and creates .bak', () => {
    // Write corrupt JSON
    fs.writeFileSync(testPath, '{ invalid json !!', 'utf8')
    expect(fs.existsSync(testPath)).toBe(true)

    // Load config — should handle corruption
    const result = loadConfigWithPath(testPath)

    // Verify .bak file was created
    const bakPath = testPath + '.bak'
    expect(fs.existsSync(bakPath)).toBe(true)

    // Verify original corrupted content is in .bak
    const bakContent = fs.readFileSync(bakPath, 'utf8')
    expect(bakContent).toBe('{ invalid json !!')

    // Verify new config.json exists and is valid
    expect(fs.existsSync(testPath)).toBe(true)
    const newContent = fs.readFileSync(testPath, 'utf8')
    const parsed = JSON.parse(newContent)
    expect(parsed).toBeDefined()
    expect(parsed.notion).toBeDefined()

    // Verify returned config has defaults
    expect(result.config.notion.d8_tasks_db).toBe('ff6a202b-2ee2-4756-857e-f002bb15a953')
  })

  it('merges loaded config with defaults', () => {
    // Write partial config (only notion section)
    const partialConfig = {
      notion: {
        d8_tasks_db: 'custom-db-id',
        egg_tasks_db: '052bcc79-ac77-40f0-a5ad-a99f8e868d30',
      },
    }
    fs.writeFileSync(testPath, JSON.stringify(partialConfig, null, 2), 'utf8')

    // Load config
    const result = loadConfigWithPath(testPath)

    // Verify partial values are kept
    expect(result.config.notion.d8_tasks_db).toBe('custom-db-id')

    // Verify defaults are filled in for missing sections
    expect(result.config.azure.tenant_id).toBe('common')
    expect(result.config.refresh.graph_interval_ms).toBe(300000)
  })
})
