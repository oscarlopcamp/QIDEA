const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

/** Does a keyboard event match a binding like `mod+shift+p`? `mod` = Cmd on macOS, Ctrl elsewhere. */
export function matchesKeybinding(e: KeyboardEvent, binding: string): boolean {
  const parts = binding.toLowerCase().split('+')
  const key = parts.pop()!
  const want = new Set(parts)
  const mod = isMac ? e.metaKey : e.ctrlKey
  if (want.has('mod') !== mod) return false
  if (want.has('shift') !== e.shiftKey) return false
  if (want.has('alt') !== e.altKey) return false
  // Ctrl on macOS / Meta elsewhere are not used by our bindings.
  if ((isMac ? e.ctrlKey : e.metaKey) && !want.has('ctrl') && !want.has('meta')) return false
  const pressed = e.key.toLowerCase()
  return pressed === key || (key === 'enter' && pressed === 'enter') || e.code.toLowerCase() === `key${key}`
}

/** Human-readable label for a binding, using macOS symbols on macOS. */
export function formatKeybinding(binding: string): string {
  return binding
    .split('+')
    .map((p) => {
      const k = p.toLowerCase()
      if (k === 'mod') return isMac ? '⌘' : 'Ctrl'
      if (k === 'shift') return isMac ? '⇧' : 'Shift'
      if (k === 'alt') return isMac ? '⌥' : 'Alt'
      if (k === 'enter') return isMac ? '↩' : 'Enter'
      return k.length === 1 ? k.toUpperCase() : k.toUpperCase()
    })
    .join(isMac ? '' : '+')
}
