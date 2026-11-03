import { useSyncExternalStore } from 'react'
import type { ContributionKind, ContributionMap } from './api'
import { ExtensionHost } from './host'

/** The single extension host of the app. */
export const host = new ExtensionHost()

/** Re-render when contributions change and return the current list of one kind. */
export function useContributions<K extends ContributionKind>(kind: K): ContributionMap[K][] {
  useSyncExternalStore(host.subscribe, host.getVersion)
  return host.get(kind)
}

export function useExtensions() {
  useSyncExternalStore(host.subscribe, host.getVersion)
  return host.extensions()
}
