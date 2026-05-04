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

// ── PDF generator — clean white professional document ────────────────────────
function generatePDF(artifact) {
  return new Promise((resolve, reject) => {
    const MARGIN = 60
    const PAGE_W = 595.28  // A4 width in pts
    const CONTENT_W = PAGE_W - MARGIN * 2

    const doc = new PDFDocument({ margin: MARGIN, size: 'A4', autoFirstPage: true })
    const chunks = []
    doc.on('data', c => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const content = artifact.content || {}
    const typeLabel = artifact.artifact_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

    // ── Helpers ──────────────────────────────────────────────────────────────

    let pageNum = 1

    function addFooter() {
      const y = doc.page.height - 36
      doc.fontSize(8).font('Helvetica').fillColor('#AAAAAA')
        .text(`Aria  |  ${typeLabel}  |  ${dateStr}`, MARGIN, y, { width: CONTENT_W, align: 'left' })
        .text(`Page ${pageNum}`, MARGIN, y, { width: CONTENT_W, align: 'right' })
    }

    // Patch page addition to auto-add footer
    doc.on('pageAdded', () => {
      pageNum++
      // Footer will be drawn at end of each page section
    })

    function ensureSpace(needed) {
      if (doc.y + needed > doc.page.height - 80) {
        addFooter()
        doc.addPage()
      }
    }

    function sectionHeading(text) {
      ensureSpace(40)
      doc.moveDown(0.6)
      doc.fontSize(13).font('Helvetica-Bold').fillColor('#1A1A2E')
        .text(text.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), MARGIN, doc.y)
      const lineY = doc.y + 2
      doc.moveTo(MARGIN, lineY).lineTo(PAGE_W - MARGIN, lineY).strokeColor('#DDDDDD').lineWidth(0.75).stroke()
      doc.moveDown(0.5)
    }

    function labelText(label) {
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#6B7280')
        .text(label.replace(/_/g, ' ').toUpperCase(), MARGIN, doc.y, { width: CONTENT_W })
      doc.moveDown(0.15)
    }

    function bodyText(text, indent = 0) {
      if (!text) return
      ensureSpace(20)
      doc.fontSize(10).font('Helvetica').fillColor('#333333')
        .text(String(text), MARGIN + indent, doc.y, { width: CONTENT_W - indent, lineGap: 2 })
      doc.moveDown(0.3)
    }

    function bulletList(items, indent = 12) {
      if (!Array.isArray(items) || !items.length) return
      items.forEach(item => {
        ensureSpace(16)
        doc.fontSize(10).font('Helvetica').fillColor('#333333')
          .text('• ' + String(item), MARGIN + indent, doc.y, { width: CONTENT_W - indent, lineGap: 2 })
        doc.moveDown(0.2)
      })
      doc.moveDown(0.2)
    }

    function objectTable(rows, headers) {
      // rows is array of objects, headers is array of keys
      if (!rows || !rows.length) return
      const colW = Math.floor(CONTENT_W / headers.length)
      ensureSpace(30)

      // Header row
      const hdrY = doc.y
      headers.forEach((h, i) => {
        doc.rect(MARGIN + i * colW, hdrY, colW, 18).fill('#F3F4F6')
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#6B7280')
          .text(h.replace(/_/g, ' ').toUpperCase(), MARGIN + i * colW + 4, hdrY + 5, { width: colW - 8 })
      })
      doc.rect(MARGIN, hdrY, CONTENT_W, 18).stroke('#E5E7EB')
      doc.y = hdrY + 22

      rows.forEach((row, ri) => {
        ensureSpace(20)
        const rowY = doc.y
        const rowBg = ri % 2 === 1 ? '#F9F9F9' : '#FFFFFF'
        headers.forEach((h, i) => {
          doc.rect(MARGIN + i * colW, rowY, colW, 18).fill(rowBg)
          const val = row[h] !== undefined ? String(row[h] ?? '') : ''
          doc.fontSize(9).font('Helvetica').fillColor('#374151')
            .text(val, MARGIN + i * colW + 4, rowY + 5, { width: colW - 8, ellipsis: true })
        })
        doc.rect(MARGIN, rowY, CONTENT_W, 18).stroke('#E5E7EB')
        doc.y = rowY + 20
      })
      doc.moveDown(0.5)
    }

    // ── Title page ───────────────────────────────────────────────────────────

    doc.moveDown(3)
    doc.fontSize(28).font('Helvetica-Bold').fillColor('#111111')
      .text(artifact.title, MARGIN, doc.y, { width: CONTENT_W })
    doc.moveDown(0.5)
    doc.fontSize(12).font('Helvetica').fillColor('#6B7280')
      .text(typeLabel, MARGIN, doc.y)
    doc.moveDown(0.3)
    doc.fontSize(10).fillColor('#9CA3AF').text(dateStr, MARGIN, doc.y)
    doc.moveDown(0.3)
    doc.fontSize(10).fillColor('#9CA3AF')
      .text(`Version ${artifact.version}  ·  ${artifact.status}`, MARGIN, doc.y)

    // Thin rule below title block
    doc.moveDown(1)
    const ruleY = doc.y
    doc.moveTo(MARGIN, ruleY).lineTo(PAGE_W - MARGIN, ruleY).strokeColor('#E5E7EB').lineWidth(1).stroke()
    doc.moveDown(1.5)

    // ── Content rendering ────────────────────────────────────────────────────

    function renderVal(key, val, depth = 0) {
      if (val === null || val === undefined || key === '_manualEdit') return

      if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
        if (depth === 0) {
          sectionHeading(key)
          bodyText(String(val))
        } else {
          ensureSpace(28)
          labelText(key)
          bodyText(String(val))
        }
        return
      }

      if (Array.isArray(val)) {
        if (!val.length) return

        if (depth === 0) sectionHeading(key)
        else {
          ensureSpace(20)
          labelText(key)
        }

        if (typeof val[0] === 'string' || typeof val[0] === 'number') {
          bulletList(val.map(String))
        } else if (typeof val[0] === 'object') {
          // Try to render as a table
          const headers = Object.keys(val[0])
          if (headers.length <= 5) {
            objectTable(val, headers)
          } else {
            val.forEach((item, i) => {
              ensureSpace(20)
              doc.fontSize(10).font('Helvetica-Bold').fillColor('#1A1A2E')
                .text(`${i + 1}.`, MARGIN + 4, doc.y)
              doc.moveDown(0.2)
              Object.entries(item).forEach(([k, v]) => renderVal(k, v, depth + 1))
              doc.moveDown(0.3)
            })
          }
        }
        return
      }

      if (typeof val === 'object') {
        if (depth === 0) {
          sectionHeading(key)
        } else {
          ensureSpace(20)
          doc.fontSize(11).font('Helvetica-Bold').fillColor('#374151')
            .text(key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), MARGIN + (depth - 1) * 12, doc.y)
          doc.moveDown(0.3)
        }
        Object.entries(val).forEach(([k, v]) => renderVal(k, v, depth + 1))
        if (depth === 0) doc.moveDown(0.5)
      }
    }

    Object.entries(content).forEach(([k, v]) => renderVal(k, v, 0))

    // ── Footer on last page ──────────────────────────────────────────────────
    addFooter()

    // Small "Generated by Aria" note
    doc.fontSize(8).font('Helvetica').fillColor('#CCCCCC')
      .text('Generated by Aria', MARGIN, doc.page.height - 52, { width: CONTENT_W, align: 'center' })

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

// ── XLSX generator — formatted professional spreadsheet ───────────────────────
function generateXLSX(artifact) {
  const wb = XLSX.utils.book_new()
  const content = artifact.content || {}
  const type = artifact.artifact_type

  // ── Header style helper ──────────────────────────────────────────────────
  function applyHeaderStyle(ws, numCols, numRows) {
    // Bold header row with dark background
    for (let c = 0; c < numCols; c++) {
      const cellRef = XLSX.utils.encode_cell({ r: 0, c })
      if (ws[cellRef]) {
        ws[cellRef].s = {
          font: { bold: true, color: { rgb: 'FFFFFF' } },
          fill: { patternType: 'solid', fgColor: { rgb: '1A1A2E' } },
          alignment: { vertical: 'center' },
        }
      }
    }
    // Alternating row colors
    for (let r = 1; r < numRows; r++) {
      for (let c = 0; c < numCols; c++) {
        const cellRef = XLSX.utils.encode_cell({ r, c })
        if (ws[cellRef]) {
          ws[cellRef].s = {
            fill: r % 2 === 1
              ? { patternType: 'solid', fgColor: { rgb: 'F5F5F5' } }
              : { patternType: 'solid', fgColor: { rgb: 'FFFFFF' } },
          }
        }
      }
    }
    // Freeze header row
    ws['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft', state: 'frozen' }
  }

  function autoColWidths(data) {
    if (!data.length) return []
    const numCols = data[0].length
    const widths = Array(numCols).fill(10)
    data.forEach(row => {
      row.forEach((cell, i) => {
        const len = String(cell ?? '').length
        widths[i] = Math.min(Math.max(widths[i], len + 2), 60)
      })
    })
    return widths.map(w => ({ wch: w }))
  }

  // ── Type-specific sheets ─────────────────────────────────────────────────

  if (type === 'data_model' && content.fields?.length) {
    const headers = ['Field Name', 'Label', 'Type', 'Required', 'Options']
    const rows = content.fields.map(f => [
      f.name ?? '',
      f.label ?? '',
      f.type ?? '',
      f.required ? 'Yes' : 'No',
      Array.isArray(f.options) ? f.options.join(', ') : (f.options ?? ''),
    ])
    const data = [headers, ...rows]
    const ws = XLSX.utils.aoa_to_sheet(data)
    ws['!cols'] = autoColWidths(data)
    applyHeaderStyle(ws, headers.length, data.length)
    XLSX.utils.book_append_sheet(wb, ws, 'Fields')
  }

  if (type === 'app_spec') {
    if (content.features?.length) {
      const headers = ['Feature', 'Status']
      const rows = content.features.map(f => [String(f), ''])
      const data = [headers, ...rows]
      const ws = XLSX.utils.aoa_to_sheet(data)
      ws['!cols'] = autoColWidths(data)
      applyHeaderStyle(ws, headers.length, data.length)
      XLSX.utils.book_append_sheet(wb, ws, 'Features')
    }
    if (content.fields?.length) {
      const headers = ['Field Name', 'Label', 'Type', 'Required']
      const rows = content.fields.map(f => [f.name ?? '', f.label ?? '', f.type ?? '', f.required ? 'Yes' : 'No'])
      const data = [headers, ...rows]
      const ws = XLSX.utils.aoa_to_sheet(data)
      ws['!cols'] = autoColWidths(data)
      applyHeaderStyle(ws, headers.length, data.length)
      XLSX.utils.book_append_sheet(wb, ws, 'Fields')
    }
  }

  if (type === 'intake_summary' || type === 'product_brief') {
    // Key-value format
    const headers = ['Label', 'Value']
    const rows = []
    function flatKV(obj, prefix = '') {
      Object.entries(obj).forEach(([k, v]) => {
        if (k === '_manualEdit') return
        const label = (prefix ? prefix + ' > ' : '') + k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
        if (Array.isArray(v)) {
          if (v.length && typeof v[0] === 'string') rows.push([label, v.join('; ')])
          else if (v.length && typeof v[0] === 'object') {
            v.forEach((item, i) => flatKV(item, `${label} [${i + 1}]`))
          }
        } else if (v && typeof v === 'object') {
          flatKV(v, label)
        } else if (v !== null && v !== undefined) {
          rows.push([label, String(v)])
        }
      })
    }
    flatKV(content)
    const data = [headers, ...rows]
    const ws = XLSX.utils.aoa_to_sheet(data)
    ws['!cols'] = autoColWidths(data)
    applyHeaderStyle(ws, headers.length, data.length)
    XLSX.utils.book_append_sheet(wb, ws, 'Summary')
  }

  // ── Always add an Overview sheet ─────────────────────────────────────────
  const overviewData = [
    ['Document', artifact.title],
    ['Type', artifact.artifact_type.replace(/_/g, ' ')],
    ['Version', String(artifact.version)],
    ['Status', artifact.status],
    ['Generated', new Date().toISOString()],
  ]

  // For types without a dedicated sheet, add a full key-value data sheet
  if (!['data_model', 'app_spec', 'intake_summary', 'product_brief'].includes(type)) {
    const rows = []
    function flattenContent(obj, prefix = '') {
      Object.entries(obj).forEach(([k, v]) => {
        if (k === '_manualEdit') return
        const label = (prefix ? prefix + ' > ' : '') + k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
        if (Array.isArray(v)) {
          if (v.length && typeof v[0] === 'string') rows.push([label, v.join('; ')])
          else if (v.length && typeof v[0] === 'object') v.forEach((item, i) => flattenContent(item, `${label} [${i + 1}]`))
        } else if (v && typeof v === 'object') {
          flattenContent(v, label)
        } else if (v !== null && v !== undefined) {
          rows.push([label, String(v)])
        }
      })
    }
    flattenContent(content)
    if (rows.length) {
      const headers = ['Label', 'Value']
      const data = [headers, ...rows]
      const ws2 = XLSX.utils.aoa_to_sheet(data)
      ws2['!cols'] = [{ wch: 36 }, { wch: 60 }]
      applyHeaderStyle(ws2, headers.length, data.length)
      XLSX.utils.book_append_sheet(wb, ws2, 'Data')
    }
  }

  const overviewWs = XLSX.utils.aoa_to_sheet(overviewData)
  overviewWs['!cols'] = [{ wch: 18 }, { wch: 50 }]
  XLSX.utils.book_append_sheet(wb, overviewWs, 'Overview')

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
