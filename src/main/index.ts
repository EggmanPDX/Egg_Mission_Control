import { app, BrowserWindow, ipcMain, shell, protocol, Menu } from 'electron'
import { join } from 'path'
import { loadConfig } from './config'
import { handleAuthCallback, getStoredNotionToken, storeNotionToken, triggerReauth } from './auth.service'
import { isGoogleConfigured, triggerGoogleReauth, getConnectedGoogleAccounts } from './google-auth.service'
import { validateToken, archiveTask, completeTask, moveTask } from './notion.service'
import { startPolling, stopPolling, getLastResult, pollNotion, pollGraph } from './poll.coordinator'
import type { PollResult, TaskWorkspace } from '../shared/ipc-types'
import { setupAutoLaunch } from './auto-launch'

// Enforce single instance — second launch focuses the existing window instead
if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

app.setName('Mission Control')

let mainWindow: BrowserWindow | null = null
let isQuiting = false

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

  // Hide window instead of closing (keep app running in background); allow quit via Cmd+Q
  mainWindow.on('close', (event) => {
    if (isQuiting) return
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

// Register custom protocol for OAuth callback (all modes except mock)
if (process.env.MISSION_CONTROL_MOCK !== 'true') {
  protocol?.registerSchemesAsPrivileged([
    { scheme: 'missioncontrol', privileges: { secure: true, standard: true } },
  ])
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
  }
})

app.whenReady().then(() => {
  // Load config before creating window
  loadConfig()

  // Handle missioncontrol:// OAuth callback in all modes
  app.setAsDefaultProtocolClient('missioncontrol')
  app.on('open-url', (event, url) => {
    event.preventDefault()
    if (url.startsWith('missioncontrol://')) {
      handleAuthCallback(url).catch((err) => {
        console.error('[Main] handleAuthCallback failed:', err)
      })
      if (mainWindow) {
        mainWindow.show()
        mainWindow.focus()
      }
    }
  })

  // Rebuild app menu so macOS menu bar shows "Mission Control" instead of the bundle name "Electron"
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { role: 'appMenu' },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
  ]))

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
  isQuiting = true
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
    // Immediately fetch tasks so the dashboard populates without waiting for next poll cycle
    pollNotion().catch((err) => console.error('[Main] post-token pollNotion failed:', err))
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
    if (mainWindow) {
      mainWindow.show()
      mainWindow.focus()
    }
    // Immediately fetch fresh data now that we have a token
    pollGraph().catch((err) => console.error('[Main] post-reauth pollGraph failed:', err))
  } catch (err) {
    console.error('[Main] triggerReauth failed:', err)
    throw err
  }
})

ipcMain.handle('is-google-configured', async (): Promise<boolean> => {
  return isGoogleConfigured()
})

ipcMain.handle('get-connected-google-accounts', async (): Promise<string[]> => {
  return getConnectedGoogleAccounts()
})

ipcMain.handle('trigger-google-reauth', async (): Promise<{ ok: boolean; email?: string; error?: string }> => {
  try {
    const { email } = await triggerGoogleReauth()
    if (mainWindow) {
      mainWindow.show()
      mainWindow.focus()
    }
    // Immediately fetch Gmail so the dashboard populates without waiting for next poll cycle
    pollGraph().catch((err) => console.error('[Main] post-google-auth pollGraph failed:', err))
    return { ok: true, email }
  } catch (err) {
    console.error('[Main] triggerGoogleReauth failed:', err)
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
})

ipcMain.handle(
  'archive-notion-task',
  async (_event, taskId: string): Promise<{ ok: boolean; error?: string }> => {
    try {
      await archiveTask(taskId)
      pollNotion().catch((err) => console.error('[Main] post-archive pollNotion failed:', err))
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  }
)

ipcMain.handle(
  'complete-notion-task',
  async (_event, taskId: string, workspace: TaskWorkspace): Promise<{ ok: boolean; error?: string }> => {
    try {
      await completeTask(taskId, workspace)
      pollNotion().catch((err) => console.error('[Main] post-complete pollNotion failed:', err))
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  }
)

ipcMain.handle(
  'move-notion-task',
  async (
    _event,
    taskId: string,
    from: TaskWorkspace,
    to: TaskWorkspace
  ): Promise<{ ok: boolean; error?: string }> => {
    try {
      await moveTask(taskId, from, to)
      pollNotion().catch((err) => console.error('[Main] post-move pollNotion failed:', err))
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  }
)

// Setup auto-launch on login
setupAutoLaunch()
