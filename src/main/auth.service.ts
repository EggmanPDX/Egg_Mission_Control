import { app, safeStorage, shell } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { PublicClientApplication, InteractionRequiredAuthError } from '@azure/msal-node'
import { getConfig } from './config'

const MC_DIR = path.join(os.homedir(), '.mission-control')
const TOKEN_FILE = path.join(MC_DIR, '.tokens')
const NOTION_KEY_FILE = path.join(MC_DIR, '.notion-key')

const SCOPES = ['Calendars.Read', 'Mail.Read', 'Chat.Read', 'User.Read']
const REDIRECT_URI =
  process.env.NODE_ENV === 'development'
    ? 'http://localhost:3000/auth'
    : 'missioncontrol://auth'

let _msalApp: PublicClientApplication | null = null
let _authed = false
let _pendingAuthResolve: ((token: string) => void) | null = null
let _pendingAuthReject: ((err: Error) => void) | null = null

function ensureMcDir(): void {
  if (!fs.existsSync(MC_DIR)) {
    fs.mkdirSync(MC_DIR, { recursive: true })
  }
}

function getMsalApp(): PublicClientApplication {
  if (_msalApp) return _msalApp

  const config = getConfig()

  _msalApp = new PublicClientApplication({
    auth: {
      clientId: config.azure.client_id,
      authority: `https://login.microsoftonline.com/${config.azure.tenant_id}`,
    },
    cache: {
      cachePlugin: {
        beforeCacheAccess: async (ctx) => {
          ensureMcDir()
          if (fs.existsSync(TOKEN_FILE)) {
            try {
              const enc = fs.readFileSync(TOKEN_FILE)
              const serialized = safeStorage.decryptString(enc)
              ctx.tokenCache.deserialize(serialized)
            } catch {
              // Token unreadable (e.g., after Electron version upgrade) — clear and force re-auth
              try { fs.unlinkSync(TOKEN_FILE) } catch { /* ignore */ }
            }
          }
        },
        afterCacheAccess: async (ctx) => {
          if (ctx.cacheHasChanged) {
            ensureMcDir()
            const serialized = ctx.tokenCache.serialize()
            const enc = safeStorage.encryptString(serialized)
            fs.writeFileSync(TOKEN_FILE, enc)
          }
        },
      },
    },
  })

  return _msalApp
}

async function triggerReauthAndWait(): Promise<string> {
  const msalApp = getMsalApp()
  const url = await msalApp.getAuthCodeUrl({
    scopes: SCOPES,
    redirectUri: REDIRECT_URI,
  })
  await shell.openExternal(url)

  return new Promise<string>((resolve, reject) => {
    _pendingAuthResolve = resolve
    _pendingAuthReject = reject
    setTimeout(
      () => {
        _pendingAuthResolve = null
        _pendingAuthReject = null
        reject(new Error('Auth timeout after 5 minutes'))
      },
      5 * 60 * 1000
    )
  })
}

export async function getAccessToken(): Promise<string> {
  const msalApp = getMsalApp()
  const accounts = await msalApp.getTokenCache().getAllAccounts()

  if (accounts.length > 0) {
    try {
      const result = await msalApp.acquireTokenSilent({
        scopes: SCOPES,
        account: accounts[0],
      })
      _authed = true
      return result.accessToken
    } catch (err) {
      if (err instanceof InteractionRequiredAuthError) {
        const token = await triggerReauthAndWait()
        return token
      }
      throw err
    }
  }

  return triggerReauthAndWait()
}

export async function handleAuthCallback(callbackUrl: string): Promise<void> {
  const msalApp = getMsalApp()
  let code: string | null = null
  try {
    const urlObj = new URL(callbackUrl)
    code = urlObj.searchParams.get('code')
  } catch {
    _pendingAuthReject?.(new Error('Invalid callback URL: ' + callbackUrl))
    _pendingAuthResolve = null
    _pendingAuthReject = null
    return
  }

  if (!code) {
    _pendingAuthReject?.(new Error('No auth code in callback URL'))
    _pendingAuthResolve = null
    _pendingAuthReject = null
    return
  }

  try {
    const result = await msalApp.acquireTokenByCode({
      code,
      scopes: SCOPES,
      redirectUri: REDIRECT_URI,
    })
    _authed = true
    _pendingAuthResolve?.(result.accessToken)
  } catch (err) {
    _pendingAuthReject?.(err instanceof Error ? err : new Error(String(err)))
  } finally {
    _pendingAuthResolve = null
    _pendingAuthReject = null
  }
}

export function isAuthed(): boolean {
  return _authed
}

export async function triggerReauth(): Promise<void> {
  _authed = false
  // Clear cached MSAL app so it re-initializes with fresh cache
  _msalApp = null
  await triggerReauthAndWait()
}

export function getStoredNotionToken(): string | null {
  try {
    if (!fs.existsSync(NOTION_KEY_FILE)) return null
    const enc = fs.readFileSync(NOTION_KEY_FILE)
    return safeStorage.decryptString(enc)
  } catch {
    // Decrypt failed (e.g., after Electron upgrade) — clear stored token
    try { fs.unlinkSync(NOTION_KEY_FILE) } catch { /* ignore */ }
    return null
  }
}

export function storeNotionToken(token: string): void {
  ensureMcDir()
  const enc = safeStorage.encryptString(token)
  fs.writeFileSync(NOTION_KEY_FILE, enc)
}
