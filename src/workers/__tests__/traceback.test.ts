import { describe, expect, it } from 'vitest'
import { cleanTraceback } from '../traceback'

describe('cleanTraceback', () => {
  it('keeps user frames and the error, drops Pyodide internals', () => {
    const tb = [
      'Traceback (most recent call last):',
      '  File "/lib/python314.zip/_pyodide/_base.py", line 619, in eval_code_async',
      '    await CodeRunner(',
      '    ...<10 lines>...',
      '  File "/home/pyodide/project/integration/main.py", line 7, in <module>',
      '    from quantum.ansatz import build_ansatz',
      '  File "/home/pyodide/project/quantum/ansatz.py", line 3',
      '    def oops(',
      'SyntaxError: unexpected EOF',
    ].join('\n')
    expect(cleanTraceback(tb)).toBe(
      [
        'Traceback (most recent call last):',
        '  File "integration/main.py", line 7, in <module>',
        '    from quantum.ansatz import build_ansatz',
        '  File "quantum/ansatz.py", line 3',
        '    def oops(',
        'SyntaxError: unexpected EOF',
      ].join('\n'),
    )
  })
})
