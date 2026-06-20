import { contextBridge } from 'electron'

contextBridge.exposeInMainWorld('api', {
  // preload API will be added here
})
