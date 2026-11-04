import { describe, expect, it } from 'vitest'
import { emptyManager, parseManager, progressBy, serializeManager, unassigned, type WorkItem } from '../manager'

const item = (over: Partial<WorkItem>): WorkItem => ({
  id: 'x',
  stageId: 'design',
  lane: 'quantum',
  title: 'T',
  description: '',
  status: 'todo',
  links: [],
  createdAt: '',
  updatedAt: '',
  ...over,
})

describe('manager model', () => {
  it('round-trips and tolerates hand-edited files', () => {
    const d = { ...emptyManager(), items: [item({ id: 'a' })] }
    expect(parseManager(serializeManager(d))).toEqual(d)
    const messy = JSON.stringify({ items: [{ id: 'b', title: 'B', lane: 'classical', stageId: 's', status: 'weird' }, { id: 'c', title: 'C', lane: 'nope' }] })
    const parsed = parseManager(messy)!
    expect(parsed.methodologyId).toBe('generic')
    expect(parsed.items).toHaveLength(1)
    expect(parsed.items[0]).toMatchObject({ status: 'todo', description: '', links: [] })
    expect(parseManager('{')).toBeNull()
  })

  it('computes progress and finds items outside the methodology', () => {
    const items = [item({ id: '1', status: 'done' }), item({ id: '2' }), item({ id: '3', lane: 'classical', stageId: 'sprint' })]
    expect(progressBy(items, (i) => i.lane)).toEqual({ quantum: { done: 1, total: 2 }, classical: { done: 0, total: 1 } })
    expect(unassigned(items, ['design']).map((i) => i.id)).toEqual(['3'])
  })
})
