import { contextBridge, ipcRenderer } from 'electron'
import type { PollResult } from '../shared/ipc-types'

contextBridge.exposeInMainWorld('api', {
  getPollResult: (): Promise<PollResult> =>
    ipcRenderer.invoke('get-poll-result'),

  saveNotionToken: (token: string): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke('save-notion-token', token),

  validateNotionToken: (token: string): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke('validate-notion-token', token),

  isNotionConfigured: (): Promise<boolean> =>
    ipcRenderer.invoke('is-notion-configured'),

  triggerReauth: (): Promise<void> =>
    ipcRenderer.invoke('trigger-reauth'),

  onPollUpdate: (callback: (data: PollResult) => void) => {
    ipcRenderer.on('poll-update', (_event, data) => callback(data))
    return () => ipcRenderer.removeAllListeners('poll-update')
  },

  onAuthStateChange: (callback: (state: { msGraphAuthed: boolean; notionConfigured: boolean }) => void) => {
    ipcRenderer.on('auth-state-change', (_event, state) => callback(state))
    return () => ipcRenderer.removeAllListeners('auth-state-change')
  },
})

declare global {
  interface Window {
    api: {
      getPollResult: () => Promise<PollResult>
      saveNotionToken: (token: string) => Promise<{ ok: boolean; error?: string }>
      validateNotionToken: (token: string) => Promise<{ ok: boolean; error?: string }>
      isNotionConfigured: () => Promise<boolean>
      triggerReauth: () => Promise<void>
      onPollUpdate: (cb: (data: PollResult) => void) => () => void
      onAuthStateChange: (cb: (state: { msGraphAuthed: boolean; notionConfigured: boolean }) => void) => () => void
    }
  }
}
