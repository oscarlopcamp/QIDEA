import type { QideaExtension } from '@/extensions/api'

/** The V-model, as an example of a methodology contributed by an extension. */
export const vModelMethodologyExtension: QideaExtension = {
  id: 'qidea.methodology.v-model',
  name: 'V-model lifecycle',
  description: 'Each design stage on the left of the V is paired with a test stage on the right.',
  version: '1.0.0',
  activate(ctx) {
    const stage = (id: string) => ({ id, title: `vmodel.${id}.title`, description: `vmodel.${id}.description` })
    ctx.methodologies.register({
      id: 'v-model',
      title: 'methodologies.vModel.title',
      description: 'methodologies.vModel.description',
      stages: [
        'requirements',
        'systemDesign',
        'architecture',
        'moduleDesign',
        'implementation',
        'unitTesting',
        'integrationTesting',
        'systemTesting',
        'acceptanceTesting',
      ].map(stage),
    })
  },
}
