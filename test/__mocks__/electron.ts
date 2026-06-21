export const app = {
  getPath: () => '/tmp/mc-test',
  setLoginItemSettings: () => {},
  show: () => {},
  on: () => {},
  setAsDefaultProtocolClient: () => {},
  whenReady: () => Promise.resolve(),
}
export const safeStorage = {
  encryptString: (s: string) => Buffer.from(s),
  decryptString: (b: Buffer) => b.toString(),
  isEncryptionAvailable: () => true,
}
export const ipcMain = { handle: () => {}, on: () => {} }
export const ipcRenderer = { invoke: () => Promise.resolve(), on: () => {}, removeAllListeners: () => {} }
export const contextBridge = { exposeInMainWorld: () => {} }
export const shell = { openExternal: () => Promise.resolve() }
export const BrowserWindow = class {}
export const Notification = class { on() {}; show() {} }
export const powerMonitor = { on: () => {} }
export const protocol = { registerHttpProtocol: () => {} }
