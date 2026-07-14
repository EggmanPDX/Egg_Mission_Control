import { contextBridge, ipcRenderer } from 'electron'
import type { PollResult, TaskWorkspace } from '../shared/ipc-types'

type MutationResult = { ok: boolean; error?: string }

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

  isGoogleConfigured: (): Promise<boolean> =>
    ipcRenderer.invoke('is-google-configured'),

  getConnectedGoogleAccounts: (): Promise<string[]> =>
    ipcRenderer.invoke('get-connected-google-accounts'),

  triggerGoogleReauth: (): Promise<{ ok: boolean; email?: string; error?: string }> =>
    ipcRenderer.invoke('trigger-google-reauth'),

  archiveTask: (taskId: string): Promise<MutationResult> =>
    ipcRenderer.invoke('archive-notion-task', taskId),

  completeTask: (taskId: string, workspace: TaskWorkspace): Promise<MutationResult> =>
    ipcRenderer.invoke('complete-notion-task', taskId, workspace),

  moveTask: (taskId: string, from: TaskWorkspace, to: TaskWorkspace): Promise<MutationResult> =>
    ipcRenderer.invoke('move-notion-task', taskId, from, to),

  getProjectContext: (pageId: string): Promise<{ ok: boolean; context?: string; error?: string }> =>
    ipcRenderer.invoke('get-project-context', pageId),

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
      isGoogleConfigured: () => Promise<boolean>
      getConnectedGoogleAccounts: () => Promise<string[]>
      triggerGoogleReauth: () => Promise<{ ok: boolean; email?: string; error?: string }>
      archiveTask: (taskId: string) => Promise<MutationResult>
      completeTask: (taskId: string, workspace: TaskWorkspace) => Promise<MutationResult>
      moveTask: (taskId: string, from: TaskWorkspace, to: TaskWorkspace) => Promise<MutationResult>
      getProjectContext: (pageId: string) => Promise<{ ok: boolean; context?: string; error?: string }>
      onPollUpdate: (cb: (data: PollResult) => void) => () => void
      onAuthStateChange: (cb: (state: { msGraphAuthed: boolean; notionConfigured: boolean }) => void) => () => void
    }
  }
}
