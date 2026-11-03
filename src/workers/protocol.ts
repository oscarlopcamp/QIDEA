import type { QiskitRuntimeEntry, RuntimeEvent, RuntimeLock, RunOutcome } from '@/services/runtimes/types'

/** Messages main thread -> Python worker. Every request carries an id echoed in the reply. */
export type WorkerRequest =
  | {
      id: number
      type: 'load'
      indexURL: string
      wheelsURL: string
      qiskitVersion: string
      entry: QiskitRuntimeEntry
    }
  | { id: number; type: 'run'; code: string }

/** Messages Python worker -> main thread. */
export type WorkerResponse =
  | { id: number; type: 'event'; event: RuntimeEvent }
  | { id: number; type: 'loaded'; lock: RuntimeLock }
  | { id: number; type: 'ran'; outcome: RunOutcome }
  | { id: number; type: 'failed'; error: string }

/** A request before the client assigns its id (distributes Omit over the union). */
export type WorkerRequestBody = WorkerRequest extends infer R ? (R extends WorkerRequest ? Omit<R, 'id'> : never) : never
