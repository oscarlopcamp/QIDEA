import { Blocks, Files } from 'lucide-react'
import type { QideaExtension } from '@/extensions/api'
import { usePalette } from '@/stores/palette'
import { useUi } from '@/stores/ui'
import { useWorkspace } from '@/stores/workspace'
import { Explorer } from '@/ui/explorer/Explorer'
import { ExtensionsView } from '@/ui/extensions/ExtensionsView'
import { pickZipFile } from '@/ui/projects/pickZip'

const hasProject = () => useWorkspace.getState().project !== null

export const workbenchExtension: QideaExtension = {
  id: 'qidea.workbench',
  name: 'Workbench',
  description: 'Explorer, command palette, project and file commands, keyboard shortcuts.',
  version: '1.0.0',
  activate(ctx) {
    ctx.views.register({ id: 'explorer', title: 'views.explorer', icon: Files, order: 10, component: Explorer })
    ctx.views.register({ id: 'extensions', title: 'views.extensions', icon: Blocks, order: 90, component: ExtensionsView })

    const cmd = ctx.commands.register

    // Palette
    cmd({
      id: 'qidea.palette.commands',
      title: 'commands.showCommands',
      keybinding: ['mod+shift+p', 'f1'],
      run: () => usePalette.getState().openCommands(),
    })
    cmd({
      id: 'qidea.palette.files',
      title: 'commands.goToFile',
      category: 'commands.categoryFile',
      keybinding: 'mod+p',
      when: hasProject,
      run: () => usePalette.getState().openFiles(),
    })

    // View
    cmd({
      id: 'qidea.view.toggleSidebar',
      title: 'commands.toggleSidebar',
      category: 'commands.categoryView',
      keybinding: 'mod+b',
      run: () => useUi.getState().toggleSidebar(),
    })
    cmd({
      id: 'qidea.view.togglePanel',
      title: 'commands.togglePanel',
      category: 'commands.categoryView',
      keybinding: 'mod+j',
      run: () => useUi.getState().togglePanel(),
    })
    cmd({
      id: 'qidea.view.toggleTheme',
      title: 'commands.toggleTheme',
      category: 'commands.categoryView',
      run: () => useUi.getState().toggleTheme(),
    })
    cmd({
      id: 'qidea.view.showExplorer',
      title: 'commands.showExplorer',
      category: 'commands.categoryView',
      keybinding: 'mod+shift+e',
      run: () => useUi.getState().showView('explorer'),
    })
    cmd({
      id: 'qidea.view.showExtensions',
      title: 'commands.showExtensions',
      category: 'commands.categoryView',
      keybinding: 'mod+shift+x',
      run: () => useUi.getState().showView('extensions'),
    })

    // Project
    cmd({
      id: 'qidea.project.new',
      title: 'commands.newProject',
      category: 'commands.categoryProject',
      run: () => useUi.getState().setNewProjectOpen(true),
    })
    cmd({
      id: 'qidea.project.open',
      title: 'commands.openProject',
      category: 'commands.categoryProject',
      run: async () => {
        const ws = useWorkspace.getState()
        await ws.refreshProjects()
        const projects = useWorkspace.getState().projects
        if (!projects.length) return ctx.ui.showMessage('There are no projects yet. Create one first.')
        const picked = await ctx.ui.showQuickPick(
          projects.map((p) => ({
            label: p.name,
            description: new Date(p.updatedAt).toLocaleString('en'),
            value: p.id,
          })),
          { placeholder: 'Open a project' },
        )
        if (picked) await useWorkspace.getState().openProject(picked.value)
      },
    })
    cmd({
      id: 'qidea.project.import',
      title: 'commands.importProject',
      category: 'commands.categoryProject',
      run: async () => {
        const file = await pickZipFile()
        if (!file) return
        try {
          await useWorkspace.getState().importProject(file)
          ctx.ui.showMessage(`Imported “${useWorkspace.getState().project?.name}”.`)
        } catch (err) {
          ctx.ui.showMessage(`Could not import ${file.name}: ${(err as Error).message}`, 'error')
        }
      },
    })
    cmd({
      id: 'qidea.project.export',
      title: 'commands.exportProject',
      category: 'commands.categoryProject',
      when: hasProject,
      run: () => useWorkspace.getState().exportProject(),
    })
    cmd({
      id: 'qidea.project.close',
      title: 'commands.closeProject',
      category: 'commands.categoryProject',
      when: hasProject,
      run: () => useWorkspace.getState().closeProject(),
    })

    // File
    cmd({
      id: 'qidea.file.new',
      title: 'commands.newFile',
      category: 'commands.categoryFile',
      when: hasProject,
      run: () => {
        useUi.getState().showView('explorer')
        useUi.getState().requestExplorerNew('file')
      },
    })
    cmd({
      id: 'qidea.file.newFolder',
      title: 'commands.newFolder',
      category: 'commands.categoryFile',
      when: hasProject,
      run: () => {
        useUi.getState().showView('explorer')
        useUi.getState().requestExplorerNew('folder')
      },
    })
    cmd({
      id: 'qidea.file.run',
      title: 'commands.runFile',
      category: 'commands.categoryRun',
      keybinding: 'mod+enter',
      when: () => useWorkspace.getState().active?.endsWith('.py') ?? false,
      run: () => useWorkspace.getState().runFile(),
    })
    cmd({
      id: 'qidea.file.closeTab',
      title: 'commands.closeTab',
      category: 'commands.categoryFile',
      when: () => useWorkspace.getState().active !== null,
      run: () => {
        const active = useWorkspace.getState().active
        if (active) useWorkspace.getState().closeTab(active)
      },
    })
  },
}
