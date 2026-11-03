import type { QideaExtension } from '@/extensions/api'
import { languagesExtension } from './languages'
import { genericMethodologyExtension } from './methodologyGeneric'
import { learnExtension, lifecycleExtension, projectManagerExtension } from './plannedModules'
import { pythonRuntimeExtension } from './pythonRuntime'
import { templatesExtension } from './templates'
import { workbenchExtension } from './workbench'

/** Every QIDEA feature ships as one of these, activated in this order at startup. */
export const BUILTIN_EXTENSIONS: QideaExtension[] = [
  workbenchExtension,
  languagesExtension,
  pythonRuntimeExtension,
  templatesExtension,
  genericMethodologyExtension,
  projectManagerExtension,
  learnExtension,
  lifecycleExtension,
]
