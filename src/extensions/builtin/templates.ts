import type { QideaExtension } from '@/extensions/api'
import { instantiateTemplate } from '@/services/projects/templates'

export const templatesExtension: QideaExtension = {
  id: 'qidea.templates',
  name: 'Project templates',
  description: 'Starter projects for hybrid quantum–classical work.',
  version: '1.0.0',
  activate(ctx) {
    ctx.projectTemplates.register({
      id: 'hybrid-starter',
      title: 'templates.hybridStarter',
      description: 'templates.hybridStarterDesc',
      instantiate: (vars) => instantiateTemplate('hybrid-starter', vars),
    })
  },
}
