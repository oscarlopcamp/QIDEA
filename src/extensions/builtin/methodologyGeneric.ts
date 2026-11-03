import type { QideaExtension } from '@/extensions/api'

/** Methodology-neutral lifecycle. Other methodologies (Scrum, V-model, ...) register the same way. */
export const genericMethodologyExtension: QideaExtension = {
  id: 'qidea.methodology.generic',
  name: 'Generic lifecycle',
  description: 'Eight lifecycle stages that fit any methodology, from requirements to maintenance.',
  version: '1.0.0',
  activate(ctx) {
    const stage = (id: string) => ({
      id,
      title: `stages.${id}.title`,
      description: `stages.${id}.description`,
    })
    ctx.methodologies.register({
      id: 'generic',
      title: 'methodologies.generic.title',
      description: 'methodologies.generic.description',
      stages: [
        'requirements',
        'analysis',
        'design',
        'implementation',
        'testing',
        'validation',
        'deployment',
        'maintenance',
      ].map(stage),
    })
  },
}
