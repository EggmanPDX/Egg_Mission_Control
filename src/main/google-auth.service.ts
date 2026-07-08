import { safeStorage, shell } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import * as http from 'http'
import { getConfig } from './config'

const MC_DIR = path.join(os.homedir(), '.mission-control')
const TOKEN_FILE = path.join(MC_DIR, '.google-tokens')

// gmail.readonly + gmail.send — Send is required for the "Accept & Send" draft-reply feature.
// Gmail has no separate "modify" scope needed here since we only read + send, never delete.
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
]

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const PROFILE_ENDPOINT = 'https://gmail.googleapis.com/gmail/v1/users/me/profile'
const EXPIRY_BUFFER_MS = 60000 // refresh 1 minute before actual expiry

interface StoredAccount {
  email: string
  access_token: string
  refresh_token: string
  expiry_date: number // epoch ms
}

/** Thrown when a valid Google token can't be obtained silently. Same contract as
 *  auth.service.ts's AuthRequiredError — background polls must catch this and leave the
 *  UI's re-authenticate affordance in place, never trigger the interactive browser flow
 *  themselves. The interactive flow only runs from an explicit user action. */
export class GoogleAuthRequiredError extends Error {
  constructor() {
    super('Google sign-in required — call triggerGoogleReauth() from a user action')
    this.name = 'GoogleAuthRequiredError'
  }
}

function ensureMcDir(): void {
  if (!fs.existsSync(MC_DIR)) fs.mkdirSync(MC_DIR, { recursive: true })
}

/** Collapses duplicate entries for the same email (case-insensitive — Google's own casing
 *  of an address can vary between OAuth round-trips), keeping the last occurrence. Also
 *  self-heals any duplicates already sitting in a previously-corrupted token file. */
function dedupeAccounts(accounts: StoredAccount[]): StoredAccount[] {
  const byEmail = new Map<string, StoredAccount>()
  for (const account of accounts) {
    byEmail.set(account.email.toLowerCase(), account)
  }
  return [...byEmail.values()]
}

function loadAccounts(): StoredAccount[] {
  try {
    if (!fs.existsSync(TOKEN_FILE)) return []
    const enc = fs.readFileSync(TOKEN_FILE)
    const decrypted = safeStorage.decryptString(enc)
    const parsed = JSON.parse(decrypted)
    // Back-compat: earlier version of this file stored a single account object, not an array.
    const accounts = Array.isArray(parsed) ? (parsed as StoredAccount[]) : [parsed as StoredAccount]
    const deduped = dedupeAccounts(accounts)
    if (deduped.length !== accounts.length) saveAccounts(deduped) // persist the self-heal
    return deduped
  } catch {
    try { fs.unlinkSync(TOKEN_FILE) } catch { /* ignore */ }
    return []
  }
}

function saveAccounts(accounts: StoredAccount[]): void {
  ensureMcDir()
  const enc = safeStorage.encryptString(JSON.stringify(accounts))
  fs.writeFileSync(TOKEN_FILE, enc)
}

function upsertAccount(account: StoredAccount): void {
  const accounts = loadAccounts()
  const idx = accounts.findIndex((a) => a.email.toLowerCase() === account.email.toLowerCase())
  if (idx === -1) accounts.push(account)
  else accounts[idx] = account
  saveAccounts(accounts)
}

async function refreshAccessToken(account: StoredAccount): Promise<StoredAccount> {
  const config = getConfig()
  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.google.client_id,
      client_secret: config.google.client_secret,
      refresh_token: account.refresh_token,
      grant_type: 'refresh_token',
    }),
  })

  if (!response.ok) {
    // Refresh token itself is invalid/revoked — full re-auth required for this account
    throw new GoogleAuthRequiredError()
  }

  const data = (await response.json()) as { access_token: string; expires_in: number }
  const updated: StoredAccount = {
    ...account,
    access_token: data.access_token,
    expiry_date: Date.now() + data.expires_in * 1000,
  }
  upsertAccount(updated)
  return updated
}

/** Returns a valid access token for the given connected Gmail account, refreshing if needed. */
export async function getGoogleAccessToken(email: string): Promise<string> {
  const account = loadAccounts().find((a) => a.email.toLowerCase() === email.toLowerCase())
  if (!account) throw new GoogleAuthRequiredError()

  if (Date.now() < account.expiry_date - EXPIRY_BUFFER_MS) {
    return account.access_token
  }

  const refreshed = await refreshAccessToken(account)
  return refreshed.access_token
}

export function getConnectedGoogleAccounts(): string[] {
  return loadAccounts().map((a) => a.email)
}

export function isGoogleConfigured(): boolean {
  return loadAccounts().length > 0
}

export function removeGoogleAccount(email: string): void {
  saveAccounts(loadAccounts().filter((a) => a.email.toLowerCase() !== email.toLowerCase()))
}

/** Runs the full interactive OAuth loopback flow: opens the system browser to Google's
 *  consent screen, listens on a locally-bound ephemeral port for the redirect, exchanges
 *  the resulting code for tokens, identifies which account it is, and adds it to the
 *  connected-accounts list (replacing that account's entry if reconnecting). Supports
 *  multiple Gmail accounts — each call adds/refreshes one account without disturbing others.
 *  Must only be called from an explicit user action (e.g. clicking "Connect Gmail"). */
export async function triggerGoogleReauth(): Promise<{ email: string }> {
  const config = getConfig()
  if (!config.google.client_id || !config.google.client_secret) {
    throw new Error('Google OAuth client not configured — add google.client_id/client_secret to config.json')
  }

  const { code, redirectUri } = await new Promise<{ code: string; redirectUri: string }>((resolve, reject) => {
    // Captured once the server starts listening — server.address() returns null after
    // server.close() is called, so the request handler below must reuse this rather than
    // re-deriving it from server.address() after closing.
    let redirectUri = ''

    const server = http.createServer((req, res) => {
      const url = new URL(req.url ?? '', 'http://localhost')
      const code = url.searchParams.get('code')
      const error = url.searchParams.get('error')

      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end(
        error
          ? '<html><body>Google sign-in failed. You can close this window.</body></html>'
          : '<html><body>Signed in — you can close this window and return to Mission Control.</body></html>'
      )

      server.close()
      if (error || !code) {
        reject(new Error(error ?? 'No authorization code returned'))
        return
      }
      resolve({ code, redirectUri })
    })

    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as { port: number }).port
      redirectUri = `http://localhost:${port}`
      const authUrl = new URL(AUTH_ENDPOINT)
      authUrl.searchParams.set('client_id', config.google.client_id)
      authUrl.searchParams.set('redirect_uri', redirectUri)
      authUrl.searchParams.set('response_type', 'code')
      authUrl.searchParams.set('scope', SCOPES.join(' '))
      authUrl.searchParams.set('access_type', 'offline')
      // consent forces refresh_token issuance every time; select_account forces Google's
      // account chooser even if only one session is active — required to connect a 2nd/3rd
      // Gmail account from the same browser instead of silently reusing the last one.
      authUrl.searchParams.set('prompt', 'consent select_account')
      shell.openExternal(authUrl.toString())
    })

    setTimeout(() => {
      server.close()
      reject(new Error('Google auth timeout after 5 minutes'))
    }, 5 * 60 * 1000)
  })

  const tokenResponse = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.google.client_id,
      client_secret: config.google.client_secret,
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })

  if (!tokenResponse.ok) {
    const body = await tokenResponse.text()
    throw new Error(`Google token exchange failed: ${tokenResponse.status} ${body}`)
  }

  const data = (await tokenResponse.json()) as {
    access_token: string
    refresh_token?: string
    expires_in: number
  }

  if (!data.refresh_token) {
    throw new Error('Google did not return a refresh token — try disconnecting the app at myaccount.google.com/permissions and reconnecting')
  }

  const profileResponse = await fetch(PROFILE_ENDPOINT, {
    headers: { Authorization: `Bearer ${data.access_token}` },
  })
  if (!profileResponse.ok) {
    throw new Error(`Could not identify the connected Gmail account: ${profileResponse.status}`)
  }
  const profile = (await profileResponse.json()) as { emailAddress: string }

  upsertAccount({
    email: profile.emailAddress,
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expiry_date: Date.now() + data.expires_in * 1000,
  })

  return { email: profile.emailAddress }
}
