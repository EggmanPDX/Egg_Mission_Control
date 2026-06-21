import { app } from 'electron'

export function setupAutoLaunch(): void {
  app.setLoginItemSettings({
    openAtLogin: true,
    openAsHidden: false,
    name: 'Mission Control',
  })
}
