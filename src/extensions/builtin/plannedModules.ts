import { FlaskConical, GraduationCap, SquareKanban } from 'lucide-react'
import type { QideaExtension } from '@/extensions/api'
import { plannedView } from '@/ui/shell/PlannedView'

/** Project manager, Learn and Lifecycle views. Their content arrives in Phases 6, 8 and 9. */
export const projectManagerExtension: QideaExtension = {
  id: 'qidea.project-manager',
  name: 'Project manager',
  description: 'Lifecycle stages × classical, quantum and integration lanes, linked to code.',
  version: '0.1.0',
  activate(ctx) {
    ctx.views.register({ id: 'manager', title: 'views.manager', icon: SquareKanban, order: 20, component: plannedView('manager') })
  },
}

export const learnExtension: QideaExtension = {
  id: 'qidea.learn',
  name: 'Learn',
  description: 'Interactive lessons on qubits, entanglement and hybrid algorithms.',
  version: '0.1.0',
  activate(ctx) {
    ctx.views.register({ id: 'learn', title: 'views.learn', icon: GraduationCap, order: 30, component: plannedView('learn') })
  },
}

export const lifecycleExtension: QideaExtension = {
  id: 'qidea.lifecycle',
  name: 'Test & deploy',
  description: 'Test, validate and package hybrid projects.',
  version: '0.1.0',
  activate(ctx) {
    ctx.views.register({ id: 'lifecycle', title: 'views.lifecycle', icon: FlaskConical, order: 40, component: plannedView('lifecycle') })
  },
}
