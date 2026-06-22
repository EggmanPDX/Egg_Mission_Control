import { app, BrowserWindow, ipcMain, shell, protocol } from 'electron'
import { join } from 'path'
import { loadConfig } from './config'
import { handleAuthCallback, getStoredNotionToken, storeNotionToken, triggerReauth } from './auth.service'
import { validateToken } from './notion.service'
import { startPolling, stopPolling, getLastResult } from './poll.coordinator'
import type { PollResult } from '../shared/ipc-types'
import { setupAutoLaunch } from './auto-launch'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 720,
    backgroundColor: '#0a0a0a',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true,
    },
    titleBarStyle: 'hiddenInset',
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  // Hide window instead of closing (keep app running in background)
  mainWindow.on('close', (event) => {
    event.preventDefault()
    mainWindow?.hide()
  })

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Load the app
  if (process.env['ELECTRON_RENDERER_URL']) {
    // Dev mode: Vite dev server
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    // Prod mode: bundled HTML
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // Start polling on window creation
  startPolling(mainWindow).catch((err) => {
    console.error('[Main] startPolling failed:', err)
  })
}

// Register custom protocol for OAuth callback (production, non-mock only)
if (process.env.NODE_ENV !== 'development' && process.env.MISSION_CONTROL_MOCK !== 'true') {
  protocol?.registerSchemesAsPrivileged([
    { scheme: 'missioncontrol', privileges: { secure: true, standard: true } },
  ])
}

app.whenReady().then(() => {
  // Load config before creating window
  loadConfig()

  // Register custom protocol handler for OAuth
  if (process.env.NODE_ENV !== 'development') {
    app.on('open-url', (event, url) => {
      event.preventDefault()
      handleAuthCallback(url).catch((err) => {
        console.error('[Main] handleAuthCallback failed:', err)
      })
      // Show window after successful auth
      if (mainWindow) {
        mainWindow.show()
        mainWindow.focus()
      }
    })
  }

  // Also register for dev mode (localhost redirect)
  if (process.env.NODE_ENV === 'development') {
    app.on('open-url', (event, url) => {
      event.preventDefault()
      if (url.startsWith('http://localhost')) {
        handleAuthCallback(url).catch((err) => {
          console.error('[Main] handleAuthCallback (dev) failed:', err)
        })
        if (mainWindow) {
          mainWindow.show()
          mainWindow.focus()
        }
      }
    })
  }

  createWindow()

  app.on('activate', () => {
    // On macOS, re-create window when dock icon is clicked
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
    else mainWindow?.show()
  })
})

// Quit app when all windows closed (except on macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    stopPolling()
    app.quit()
  }
})

// Stop polling when app is about to quit
app.on('before-quit', () => {
  stopPolling()
})

// IPC Handlers
ipcMain.handle('get-poll-result', async (): Promise<PollResult | null> => {
  return getLastResult()
})

ipcMain.handle('is-notion-configured', async (): Promise<boolean> => {
  const token = getStoredNotionToken()
  if (!token) return false
  try {
    return await validateToken(token)
  } catch {
    return false
  }
})

ipcMain.handle('save-notion-token', async (_event, token: string): Promise<{ ok: boolean; error?: string }> => {
  try {
    const isValid = await validateToken(token)
    if (!isValid) {
      return { ok: false, error: 'Invalid token — unable to authenticate with Notion' }
    }
    storeNotionToken(token)
    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, error: message }
  }
})

ipcMain.handle('validate-notion-token', async (_event, token: string): Promise<{ ok: boolean; error?: string }> => {
  try {
    const isValid = await validateToken(token)
    return { ok: isValid }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, error: message }
  }
})

ipcMain.handle('trigger-reauth', async (): Promise<void> => {
  try {
    await triggerReauth()
    // Show window after successful auth
    if (mainWindow) {
      mainWindow.show()
      mainWindow.focus()
    }
  } catch (err) {
    console.error('[Main] triggerReauth failed:', err)
    throw err
  }
})

// Setup auto-launch on login
setupAutoLaunch()
