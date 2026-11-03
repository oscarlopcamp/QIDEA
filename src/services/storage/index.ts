import { IndexedDbStorage } from './IndexedDbStorage'
import type { StorageProvider } from './types'

/** The active storage implementation. Swap here for a server-backed provider. */
export const storage: StorageProvider = new IndexedDbStorage()
export type { StorageProvider }
