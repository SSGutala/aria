/**
 * /api/template-upload — Parse a user-uploaded document template into a section
 * skeleton Aria can fill out.
 *
 * The user uploads a .docx / .pdf / .md / .txt that represents the STRUCTURE they
 * want their generated document to follow. We extract the heading skeleton (and
 * any inline hints under each heading), and return:
 *   { skeleton: [{ title, hint }], rawText, label }
 *
 * The frontend then passes `skeleton` back into /api/pm-document as
 * `templateSkeleton`, which overrides the default section spine so the generated
 * document mirrors the user's exact format — filled with content grounded in
 * their project.
 *
 * Uploads are processed in memory (multer memoryStorage) — nothing is persisted
 * to disk; everything runs locally.
 */

import mammoth from 'mammoth'

const MAX_HEADINGS = 40
const MAX_RAW_CHARS = 20000

function cleanTitle(t) {
  return String(t || '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s\-•*\d.)(]+/, '')
    .trim()
}

// ── Markdown / plain-text heading extraction ────────────────────────────────
function parseMarkdown(text) {
  const lines = text.split('\n')
  const skeleton = []
  let current = null
  for (const raw of lines) {
    const line = raw.replace(/\r$/, '')
    const md = line.match(/^(#{1,4})\s+(.*)$/)
    const numbered = line.match(/^\s*(\d+[.)]\s+)([A-Z][^.!?]{2,80})\s*:?\s*$/)
    const allCaps = line.match(/^\s*([A-Z][A-Z0-9 &/'-]{3,60})\s*:?\s*$/)
    if (md) {
      const title = cleanTitle(md[2])
      if (title) { current = { title, hint: '' }; skeleton.push(current) }
    } else if (numbered) {
      const title = cleanTitle(numbered[2])
      if (title) { current = { title, hint: '' }; skeleton.push(current) }
    } else if (allCaps) {
      const title = cleanTitle(allCaps[1])
      if (title) { current = { title, hint: '' }; skeleton.push(current) }
    } else if (current && line.trim()) {
      // Accumulate a short hint (placeholder/sub-bullet text) under the heading.
      if (current.hint.length < 240) {
        current.hint = (current.hint ? current.hint + ' ' : '') + line.trim()
      }
    }
  }
  return skeleton
}

// ── DOCX heading extraction (via mammoth → HTML with heading styles) ────────
async function parseDocx(buffer) {
  const { value: html } = await mammoth.convertToHtml(
    { buffer },
    { styleMap: ["p[style-name='Title'] => h1:fresh", "p[style-name='Heading 1'] => h1:fresh", "p[style-name='Heading 2'] => h2:fresh", "p[style-name='Heading 3'] => h3:fresh"] }
  )
  const skeleton = []
  const headingRe = /<h[1-4][^>]*>(.*?)<\/h[1-4]>/gis
  let m
  while ((m = headingRe.exec(html)) !== null) {
    const title = cleanTitle(m[1].replace(/<[^>]+>/g, ''))
    if (title) skeleton.push({ title, hint: '' })
  }
  if (skeleton.length) return skeleton
  // Fallback: no styled headings → extract raw text and use heuristics.
  const { value: raw } = await mammoth.extractRawText({ buffer })
  return parseMarkdown(raw)
}

// ── PDF heading extraction (heuristic on raw text) ──────────────────────────
async function parsePdf(buffer) {
  const { default: pdfParse } = await import('pdf-parse')
  const data = await pdfParse(buffer)
  return { skeleton: parseMarkdown(data.text || ''), rawText: data.text || '' }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const file = req.file
  if (!file || !file.buffer) {
    return res.status(400).json({ error: 'No file uploaded. Attach a .docx, .pdf, .md, or .txt template.' })
  }

  const name = (file.originalname || 'template').replace(/\.[^.]+$/, '')
  const ext = (file.originalname || '').toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] || ''

  try {
    let skeleton = []
    let rawText = ''

    if (ext === 'docx') {
      skeleton = await parseDocx(file.buffer)
      try { rawText = (await mammoth.extractRawText({ buffer: file.buffer })).value || '' } catch {}
    } else if (ext === 'pdf') {
      const out = await parsePdf(file.buffer)
      skeleton = out.skeleton
      rawText = out.rawText
    } else if (ext === 'md' || ext === 'markdown' || ext === 'txt' || ext === '') {
      rawText = file.buffer.toString('utf8')
      skeleton = parseMarkdown(rawText)
    } else {
      return res.status(415).json({ error: `Unsupported file type ".${ext}". Use .docx, .pdf, .md, or .txt.` })
    }

    // De-dupe + cap.
    const seen = new Set()
    skeleton = skeleton
      .filter(s => s.title && !seen.has(s.title.toLowerCase()) && seen.add(s.title.toLowerCase()))
      .slice(0, MAX_HEADINGS)
      .map(s => ({ title: s.title, hint: (s.hint || '').slice(0, 240) }))

    if (!skeleton.length) {
      return res.status(422).json({
        error: 'Could not detect any section headings in this template. Make sure headings use Heading styles (.docx), # markers (.md), or clear title lines.',
        rawTextPreview: rawText.slice(0, 500),
      })
    }

    return res.json({
      label: name || 'Uploaded Template',
      skeleton,
      rawText: rawText.slice(0, MAX_RAW_CHARS),
      sectionCount: skeleton.length,
    })
  } catch (err) {
    return res.status(500).json({ error: 'Failed to parse template: ' + (err?.message || String(err)) })
  }
}
