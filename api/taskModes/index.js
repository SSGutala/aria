/**
 * Task-mode handler registry. Each handler exports a uniform shape:
 *   { label, system, modelTier, maxTokens, stageMap, buildPrompt }
 */
import fullstack  from './fullstack.js'
import automation from './automation.js'
import dashboard  from './dashboard.js'
import knowledge  from './knowledge.js'
import workflow   from './workflow.js'

export const TASK_MODES = { fullstack, automation, dashboard, knowledge, workflow }
export const TASK_MODE_NAMES = Object.keys(TASK_MODES)
