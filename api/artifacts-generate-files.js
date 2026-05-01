/**
 * POST /api/artifacts/:id/files
 * Generates real PDF, DOCX, XLSX, JSON, CSV files from an artifact's content.
 * Uploads to Supabase Storage, stores URLs back on the artifact row.
 */
import { createClient } from '@supabase/supabase-js'
import { createRequire } from 'module'
import { Readable } from 'stream'

const require = createRequire(import.meta.url)
const PDFDocument = require('pdfkit')
const XLSX = require('xlsx')

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
)

// ── Markdown serialiser ──────────────────────────────────────────────────────
function toMarkdown(artifact) {
  const { title, artifact_type, version, content } = artifact
  const lines = [`# ${artifact.title}`, `**Type:** ${artifact_type}  |  **Version:** ${version}  |  **Status:** ${artifact.status}`, '---', '']

  function walk(key, val, depth = 0) {
    const indent = '  '.repeat(depth)
    const h = '#'.repeat(Math.min(depth + 2, 6))
    if (val === null || val === undefined) return
    if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
      lines.push(`${indent}**${key}:** ${val}`)
      lines.push('')
    } else if (Array.isArray(val)) {
      lines.push(`${indent}**${key}:**`)
      val.forEach(item => {
        if (typeof item === 'string') lines.push(`${indent}- ${item}`)
        else if (typeof item === 'object') { lines.push(''); Object.entries(item).forEach(([k, v]) => walk(k, v, depth + 1)) }
      })
      lines.push('')
    } else if (typeof val === 'object') {
      lines.push(`${indent}${h} ${key}`)
      lines.push('')
      Object.entries(val).forEach(([k, v]) => walk(k, v, depth + 1))
    }
  }

  if (content && typeof content === 'object') {
    Object.entries(content).forEach(([k, v]) => walk(k, v))
  }
  return lines.join('\n')
}

// ── PDF generator ────────────────────────────────────────────────────────────
function generatePDF(artifact) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' })
    const chunks = []
    doc.on('data', c => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const content = artifact.content || {}
    const typeLabel = artifact.artifact_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

    // Header bar
    doc.rect(0, 0, doc.page.width, 80).fill('#111111')
    doc.fillColor('#FFFFFF').fontSize(20).font('Helvetica-Bold').text(artifact.title, 50, 25, { width: 500 })
    doc.fontSize(10).fillColor('#999999').text(`${typeLabel}  ·  Version ${artifact.version}  ·  ${artifact.status}`, 50, 52)
    doc.moveDown(3)

    // Content
    doc.fillColor('#111111').fontSize(11).font('Helvetica')

    function renderVal(key, val, depth = 0) {
      const indent = depth * 20
      const labelColor = depth === 0 ? '#1a1a2e' : '#333366'
      const headingSize = Math.max(10, 14 - depth * 2)

      if (val === null || val === undefined) return

      if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
        doc.fontSize(9).font('Helvetica-Bold').fillColor(labelColor)
          .text(String(key).replace(/_/g, ' ').toUpperCase(), 50 + indent, doc.y, { continued: true })
        doc.font('Helvetica').fillColor('#222222').text('  ' + String(val))
        doc.moveDown(0.3)
        return
      }

      if (Array.isArray(val)) {
        doc.fontSize(headingSize).font('Helvetica-Bold').fillColor(labelColor)
          .text(String(key).replace(/_/g, ' ').toUpperCase(), 50 + indent)
        doc.moveDown(0.2)
        val.forEach(item => {
          if (typeof item === 'string') {
            doc.fontSize(9).font('Helvetica').fillColor('#333333')
              .text('• ' + item, 60 + indent, doc.y, { width: 450 - indent })
            doc.moveDown(0.2)
          } else if (typeof item === 'object') {
            doc.moveDown(0.3)
            Object.entries(item).forEach(([k, v]) => renderVal(k, v, depth + 1))
          }
        })
        doc.moveDown(0.5)
        return
      }

      if (typeof val === 'object') {
        if (depth === 0) {
          doc.moveDown(0.5)
          doc.fontSize(headingSize + 2).font('Helvetica-Bold').fillColor(labelColor)
            .text(String(key).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), 50)
          doc.moveDown(0.4)
          // Underline
          const y = doc.y
          doc.moveTo(50, y).lineTo(545, y).strokeColor('#DDDDDD').stroke()
          doc.moveDown(0.4)
        } else {
          doc.fontSize(headingSize).font('Helvetica-Bold').fillColor(labelColor)
            .text(String(key).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), 50 + indent)
          doc.moveDown(0.2)
        }
        Object.entries(val).forEach(([k, v]) => renderVal(k, v, depth + 1))
        doc.moveDown(0.5)
      }
    }

    Object.entries(content).forEach(([k, v]) => renderVal(k, v, 0))

    // Footer
    doc.fontSize(8).fillColor('#AAAAAA')
      .text(`Generated by Aria  ·  ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, 50, doc.page.height - 40, { align: 'center', width: 495 })

    doc.end()
  })
}

// ── DOCX generator ────────────────────────────────────────────────────────────
async function generateDOCX(artifact) {
  // Use docxtemplater-free approach: build XML manually
  // We'll use the 'docx' package if available, else fall back to HTML-wrapped DOCX
  try {
    const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, BorderStyle } = await import('docx').catch(() => null) || {}
    if (!Document) throw new Error('docx not available')

    const content = artifact.content || {}
    const children = []

    children.push(new Paragraph({
      text: artifact.title,
      heading: HeadingLevel.TITLE,
    }))
    children.push(new Paragraph({
      children: [new TextRun({ text: `Type: ${artifact.artifact_type.replace(/_/g, ' ')}   Version: ${artifact.version}   Status: ${artifact.status}`, color: '666666', size: 18 })],
    }))
    children.push(new Paragraph({ text: '' }))

    function addVal(key, val, depth = 0) {
      const label = String(key).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      if (val === null || val === undefined) return
      if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
        children.push(new Paragraph({
          children: [
            new TextRun({ text: label + ': ', bold: true, size: 20 }),
            new TextRun({ text: String(val), size: 20 }),
          ],
        }))
        return
      }
      if (Array.isArray(val)) {
        children.push(new Paragraph({ text: label, heading: depth === 0 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3 }))
        val.forEach(item => {
          if (typeof item === 'string') {
            children.push(new Paragraph({ text: '• ' + item, indent: { left: 360 } }))
          } else if (typeof item === 'object') {
            Object.entries(item).forEach(([k, v]) => addVal(k, v, depth + 1))
          }
        })
        return
      }
      if (typeof val === 'object') {
        children.push(new Paragraph({ text: label, heading: depth === 0 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3 }))
        Object.entries(val).forEach(([k, v]) => addVal(k, v, depth + 1))
      }
    }

    Object.entries(content).forEach(([k, v]) => addVal(k, v, 0))

    const doc = new Document({ sections: [{ children }] })
    return await Packer.toBuffer(doc)
  } catch {
    // Fallback: RTF (opens in Word)
    const md = toMarkdown(artifact)
    const rtf = `{\\rtf1\\ansi\\deff0
{\\fonttbl{\\f0 Helvetica;}}
{\\colortbl;\\red0\\green0\\blue0;}
\\f0\\fs24
{\\b\\fs36 ${artifact.title.replace(/[{}\\]/g, '')}\\par}
\\fs20 Type: ${artifact.artifact_type}  Version: ${artifact.version}\\par
\\par
${md.replace(/\*\*/g, '').replace(/^# .+\n/m, '').replace(/\n/g, '\\par\n').replace(/[{}\\]/g, '')}
}`
    return Buffer.from(rtf)
  }
}

// ── XLSX generator ─────────────────────────────────────────────────────────────
function generateXLSX(artifact) {
  const wb = XLSX.utils.book_new()
  const content = artifact.content || {}

  function flattenToRows(obj, prefix = '') {
    const rows = []
    Object.entries(obj).forEach(([k, v]) => {
      const key = prefix ? `${prefix} > ${k}` : k
      if (Array.isArray(v)) {
        if (v.length > 0 && typeof v[0] === 'object') {
          // Table: columns from first object keys
          const headers = Object.keys(v[0])
          const sheetData = [headers, ...v.map(row => headers.map(h => row[h] ?? ''))]
          const ws = XLSX.utils.aoa_to_sheet(sheetData)
          // Style header row
          headers.forEach((_, i) => {
            const cell = ws[XLSX.utils.encode_cell({ r: 0, c: i })]
            if (cell) cell.s = { font: { bold: true }, fill: { fgColor: { rgb: '1a1a2e' } } }
          })
          XLSX.utils.book_append_sheet(wb, ws, String(key).slice(0, 31))
        } else {
          rows.push([String(key).replace(/_/g, ' '), v.join('; ')])
        }
      } else if (v && typeof v === 'object') {
        rows.push(['', ''])
        rows.push([String(key).replace(/_/g, ' ').toUpperCase(), ''])
        flattenToRows(v, key).forEach(r => rows.push(r))
      } else if (v !== null && v !== undefined) {
        rows.push([String(key).replace(/_/g, ' '), String(v)])
      }
    })
    return rows
  }

  // Summary sheet
  const summaryRows = [
    ['Document', artifact.title],
    ['Type', artifact.artifact_type.replace(/_/g, ' ')],
    ['Version', artifact.version],
    ['Status', artifact.status],
    ['Generated', new Date().toISOString()],
    [],
  ]
  const mainRows = flattenToRows(content)
  const summarySheet = XLSX.utils.aoa_to_sheet([...summaryRows, ...mainRows])
  summarySheet['!cols'] = [{ wch: 30 }, { wch: 60 }]
  XLSX.utils.book_append_sheet(wb, summarySheet, 'Overview')

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
}

// ── CSV generator ─────────────────────────────────────────────────────────────
function generateCSV(artifact) {
  const content = artifact.content || {}
  const rows = [['Field', 'Value']]

  function walk(obj, prefix = '') {
    Object.entries(obj).forEach(([k, v]) => {
      const label = prefix ? `${prefix} > ${k}` : k
      if (Array.isArray(v)) {
        if (v.length > 0 && typeof v[0] === 'object') {
          v.forEach((item, i) => walk(item, `${label}[${i}]`))
        } else {
          rows.push([label, v.join('; ')])
        }
      } else if (v && typeof v === 'object') {
        walk(v, label)
      } else if (v !== null && v !== undefined) {
        rows.push([label, String(v)])
      }
    })
  }

  walk(content)
  return rows.map(r => r.map(c => `"${String(c || '').replace(/"/g, '""')}"`).join(',')).join('\n')
}

// ── Upload to Supabase Storage ─────────────────────────────────────────────────
async function uploadFile(buffer, path, contentType) {
  const { data, error } = await supabase.storage
    .from('artifacts')
    .upload(path, buffer, { contentType, upsert: true })

  if (error) throw new Error('Storage upload failed: ' + error.message)

  const { data: { publicUrl } } = supabase.storage
    .from('artifacts')
    .getPublicUrl(path)

  return publicUrl
}

// ── Determine which formats to generate per artifact type ─────────────────────
const FORMAT_MAP = {
  intake_summary:    ['pdf', 'docx', 'md'],
  product_brief:     ['pdf', 'docx', 'md'],
  workflow_map:      ['pdf', 'md', 'json'],
  data_model:        ['pdf', 'xlsx', 'csv', 'json'],
  automation_model:  ['pdf', 'json', 'md'],
  ux_recommendation: ['pdf', 'docx', 'md'],
  app_spec:          ['pdf', 'docx', 'xlsx', 'json'],
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const artifactId = req.params?.id || req.url.split('/').slice(-2, -1)[0]
  if (!artifactId) return res.status(400).json({ error: 'Artifact ID required' })

  // Fetch artifact
  const { data: artifact, error: fetchErr } = await supabase
    .from('artifacts').select('*').eq('id', artifactId).single()
  if (fetchErr || !artifact) return res.status(404).json({ error: 'Artifact not found' })

  const formats = FORMAT_MAP[artifact.artifact_type] || ['pdf', 'json', 'md']
  const basePath = `${artifact.conversation_id}/${artifactId}_v${artifact.version}`
  const fileUrls = {}
  const errors = []

  for (const fmt of formats) {
    try {
      let buffer, contentType, ext

      switch (fmt) {
        case 'pdf':
          buffer = await generatePDF(artifact)
          contentType = 'application/pdf'
          ext = 'pdf'
          break
        case 'docx':
          buffer = await generateDOCX(artifact)
          contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          ext = 'docx'
          break
        case 'xlsx':
          buffer = generateXLSX(artifact)
          contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          ext = 'xlsx'
          break
        case 'csv':
          buffer = Buffer.from(generateCSV(artifact))
          contentType = 'text/csv'
          ext = 'csv'
          break
        case 'json':
          buffer = Buffer.from(JSON.stringify(artifact.content, null, 2))
          contentType = 'application/json'
          ext = 'json'
          break
        case 'md':
          buffer = Buffer.from(toMarkdown(artifact))
          contentType = 'text/markdown'
          ext = 'md'
          break
      }

      const url = await uploadFile(buffer, `${basePath}.${ext}`, contentType)
      fileUrls[fmt] = url
    } catch (err) {
      errors.push({ format: fmt, error: err.message })
      console.error(`File gen error [${fmt}]:`, err.message)
    }
  }

  // Store file URLs back on artifact
  const { data: updated, error: updateErr } = await supabase
    .from('artifacts')
    .update({ file_urls: fileUrls, files_generated_at: new Date().toISOString() })
    .eq('id', artifactId)
    .select().single()

  if (updateErr) console.error('Failed to save file URLs:', updateErr.message)

  return res.json({
    artifactId,
    fileUrls,
    errors: errors.length ? errors : undefined,
    artifact: updated || artifact,
  })
}
