import { describe, expect, it } from 'vitest'
import { canonical, diffLock, makeLock, parseLock, runRecordPath, sameResults, serializeLock, snapshotFiles } from '../runs'

const lock = { pyodide: '314.0.7', python: '3.14.2', packages: { qiskit: '2.6.1', numpy: '2.4.6' } }

describe('lock file', () => {
  it('round-trips and sorts packages', () => {
    const l = makeLock(lock, new Date('2026-11-03T10:00:00Z'))
    expect(Object.keys(l.packages)).toEqual(['numpy', 'qiskit'])
    expect(parseLock(serializeLock(l))).toEqual(l)
    expect(parseLock('not json')).toBeNull()
    expect(parseLock('{"packages":{}}')).toBeNull()
  })

  it('lists every version difference', () => {
    const actual = { ...lock, packages: { qiskit: '2.5.2', numpy: '2.4.6', qidea: '0.1.0' } }
    expect(diffLock(lock, actual)).toEqual([
      { name: 'qidea', locked: undefined, actual: '0.1.0' },
      { name: 'qiskit', locked: '2.6.1', actual: '2.5.2' },
    ])
    expect(diffLock(lock, lock)).toEqual([])
  })
})

describe('run records', () => {
  it('compares results independently of key order', () => {
    expect(canonical({ b: 1, a: [{ y: 2, x: 1 }] })).toBe('{"a":[{"x":1,"y":2}],"b":1}')
    expect(sameResults([{ counts: { '00': 5, '11': 3 } }], [{ counts: { '11': 3, '00': 5 } }])).toBe(true)
    expect(sameResults([{ counts: { '00': 5 } }], [{ counts: { '00': 6 } }])).toBe(false)
  })

  it('builds file-system-safe record paths', () => {
    expect(runRecordPath({ id: 'abc', at: '2026-11-03T10:00:00.123Z' })).toBe('.qidea/runs/2026-11-03T10-00-00-123Z-abc.json')
  })

  it('snapshots code but not internal files, and gives up on huge projects', () => {
    expect(snapshotFiles({ 'a.py': 'x', '.qidea/runs/r.json': '{}', 'qidea.lock': '{}' })).toEqual({ 'a.py': 'x' })
    expect(snapshotFiles({ 'big.py': 'x'.repeat(600 * 1024) })).toBeUndefined()
  })
})
