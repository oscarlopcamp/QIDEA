import { describe, expect, it } from 'vitest'
import { fuzzyScore } from '@/stores/palette'

describe('fuzzyScore', () => {
  it('matches substrings and subsequences, rejects non-matches', () => {
    expect(fuzzyScore('', 'anything')).toBe(0)
    expect(fuzzyScore('run', 'Run: Run active Python file')).not.toBeNull()
    expect(fuzzyScore('tgsb', 'View: Toggle sidebar')).not.toBeNull()
    expect(fuzzyScore('xyz', 'View: Toggle sidebar')).toBeNull()
  })

  it('ranks a direct substring above a scattered match', () => {
    const direct = fuzzyScore('main', 'integration/main.py')!
    const scattered = fuzzyScore('main', 'quantum/my_ansatz_init.py')
    expect(scattered === null || direct > scattered).toBe(true)
  })
})
