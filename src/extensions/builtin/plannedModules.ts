import { FlaskConical, GraduationCap, SquareKanban } from 'lucide-react'
import type { QideaExtension } from '@/extensions/api'
import { host } from '@/extensions'
import i18n from '@/i18n'
import { useManager } from '@/stores/manager'
import { useUi } from '@/stores/ui'
import { useWorkspace } from '@/stores/workspace'
import { ManagerSidebar } from '@/ui/manager/ManagerSidebar'
import { plannedView } from '@/ui/shell/PlannedView'

const hostMethodologies = () => host.get('methodologies')

/** Project manager, Learn and Lifecycle views. Their content arrives in Phases 6, 8 and 9. */
export const projectManagerExtension: QideaExtension = {
  id: 'qidea.project-manager',
  name: 'Project manager',
  description: 'Lifecycle stages × classical, quantum and integration lanes, linked to code.',
  version: '1.0.0',
  activate(ctx) {
    ctx.views.register({ id: 'manager', title: 'views.manager', icon: SquareKanban, order: 20, component: ManagerSidebar })
    const hasProject = () => useWorkspace.getState().project !== null
    ctx.commands.register({
      id: 'qidea.manager.show',
      title: 'commands.showManager',
      category: 'commands.categoryView',
      keybinding: 'mod+shift+m',
      when: hasProject,
      run: () => {
        useUi.getState().showView('manager')
        useUi.getState().setMode('manager')
      },
    })
    ctx.commands.register({
      id: 'qidea.mode.code',
      title: 'commands.showCode',
      category: 'commands.categoryView',
      when: hasProject,
      run: () => useUi.getState().setMode('code'),
    })
    ctx.commands.register({
      id: 'qidea.manager.methodology',
      title: 'commands.changeMethodology',
      category: 'commands.categoryProject',
      when: hasProject,
      run: async () => {
        const picked = await ctx.ui.showQuickPick(
          hostMethodologies().map((m) => ({ label: i18n.t(m.title), description: i18n.t(m.description), value: m.id })),
          { placeholder: i18n.t('manager.pickMethodology') },
        )
        if (picked) await useManager.getState().setMethodology(picked.value)
      },
    })
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
