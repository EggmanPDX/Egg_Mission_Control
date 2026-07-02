import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

export interface AppConfig {
  _meta: {
    registrationName: string
    portalUrl: string
    createdAt: string
  }
  notion: {
    d8_tasks_db: string
    egg_tasks_db: string
    bgc_tasks_db: string
  }
  azure: {
    client_id: string
    tenant_id: string
  }
  refresh: {
    graph_interval_ms: number
    notion_interval_ms: number
    notification_lead_minutes: number
  }
}

const CONFIG_DIR = path.join(os.homedir(), '.mission-control')
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json')

const DEFAULTS: AppConfig = {
  _meta: {
    registrationName: 'Mission Control (personal)',
    portalUrl: 'https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade',
    createdAt: new Date().toISOString(),
  },
  notion: {
    d8_tasks_db: 'ff6a202b-2ee2-4756-857e-f002bb15a953',
    egg_tasks_db: '814d208b-fc6b-4515-9d8f-29da8bd459f7',
    bgc_tasks_db: '',
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

let _config: AppConfig | null = null

export function loadConfig(): AppConfig {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true })
  }

  if (!fs.existsSync(CONFIG_PATH)) {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULTS, null, 2), 'utf8')
    _config = DEFAULTS
    return _config
  }

  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8')
    _config = { ...DEFAULTS, ...JSON.parse(raw) }
    return _config
  } catch {
    // Corrupt config — back it up and reset to defaults
    const bak = CONFIG_PATH + '.bak'
    fs.renameSync(CONFIG_PATH, bak)
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULTS, null, 2), 'utf8')
    _config = DEFAULTS
    return _config
  }
}

export function getConfig(): AppConfig {
  if (!_config) throw new Error('Config not loaded — call loadConfig() first')
  return _config
}
