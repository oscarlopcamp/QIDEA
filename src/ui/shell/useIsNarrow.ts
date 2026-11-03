import { useSyncExternalStore } from 'react'

const query = '(max-width: 767px)'

export function useIsNarrow(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = matchMedia(query)
      mq.addEventListener('change', cb)
      return () => mq.removeEventListener('change', cb)
    },
    () => matchMedia(query).matches,
  )
}
