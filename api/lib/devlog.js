/**
 * Aria Developer Event Logger
 *
 * Prints structured action logs to the terminal so Aria developers
 * can monitor exactly what's happening without needing Claude or a UI.
 *
 * Terminal output is colored. File output is plain text.
 * Log file: logs/aria-events.log (auto-created)
 *
 * Usage:
 *   devlog('conversation.opened', { conversationId, userId })
 *   devlogError('brief.generation_failed', { traceId, error: err.message })
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const LOG_DIR = path.join(__dirname, '../../logs')
const LOG_FILE = path.join(LOG_DIR, 'aria-events.log')

// Ensure logs/ dir exists on startup
try { fs.mkdirSync(LOG_DIR, { recursive: true }) } catch {}

const C = {
  action:  '\x1b[36m',   // cyan  — normal events
  failed:  '\x1b[31m',   // red   — errors / failures
  api:     '\x1b[33m',   // yellow — API request logs
  reset:   '\x1b[0m',
  bold:    '\x1b[1m',
  dim:     '\x1b[90m',
}

function metaStr(metadata) {
  return Object.entries(metadata)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`)
    .join('  ')
}

function writeLine(tag, eventName, metadata) {
  const ts = new Date().toISOString()
  const meta = metaStr(metadata)
  // File: plain
  try {
    fs.appendFileSync(LOG_FILE, `[${tag}] ${ts}  ${eventName}${meta ? '  ' + meta : ''}\n`)
  } catch {}
}

export function devlog(eventName, metadata = {}) {
  const ts = new Date().toISOString()
  const meta = metaStr(metadata)
  console.log(
    `${C.action}[ACTION]${C.reset} ${C.dim}${ts}${C.reset}  ${C.bold}${eventName}${C.reset}${meta ? `  ${C.dim}${meta}${C.reset}` : ''}`
  )
  writeLine('ACTION', eventName, metadata)
}

export function devlogError(eventName, metadata = {}) {
  const ts = new Date().toISOString()
  const meta = metaStr(metadata)
  console.log(
    `${C.failed}[FAILED]${C.reset} ${C.dim}${ts}${C.reset}  ${C.bold}${eventName}${C.reset}${meta ? `  ${C.dim}${meta}${C.reset}` : ''}`
  )
  writeLine('FAILED', eventName, metadata)
}

export function devlogApi(method, path, status, ms) {
  const ts = new Date().toISOString()
  const statusColor = status >= 400 ? C.failed : C.dim
  console.log(
    `${C.api}[API]${C.reset}   ${C.dim}${ts}${C.reset}  ${method.padEnd(6)} ${path.padEnd(40)} ${statusColor}${status}${C.reset}  ${C.dim}${ms}ms${C.reset}`
  )
  writeLine('API', `${method} ${path}`, { status, ms })
}
