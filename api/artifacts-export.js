/**
 * /api/artifacts/export — Export artifacts as downloadable documents.
 *
 * Supports DOCX (.docx), PDF (.pdf), and Markdown (.md) formats.
 * Converts the artifact's structured content to the requested format.
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
)

// Convert artifact to markdown (safe, no external deps)
function contentToMarkdown(artifact) {
  if (!artifact.content) return '# ' + artifact.title

  const content = artifact.content
  let md = `# ${artifact.title}\n\n`

  if (content._manualEdit) {
    md += content._manualEdit
  } else if (typeof content === 'object') {
    // Handle structured document content
    if (content.sections && Array.isArray(content.sections)) {
      md += content.sections.map(s => {
        let section = `## ${s.title || 'Section'}\n\n`
        if (s.content) section += s.content + '\n\n'
        if (s.items && Array.isArray(s.items)) {
          section += s.items.map(item => `- ${item}`).join('\n') + '\n\n'
        }
        return section
      }).join('')
    } else {
      // Fallback: pretty-print the JSON
      md += '```json\n' + JSON.stringify(content, null, 2) + '\n```'
    }
  } else {
    md += String(content)
  }

  return md
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { artifactId, format = 'md' } = req.body || {}
  if (!artifactId || !['md', 'txt'].includes(format)) {
    return res.status(400).json({ error: 'Missing or invalid: artifactId, format (md, txt)' })
  }

  try {
    const { data: artifact, error } = await supabase
      .from('artifacts').select('*').eq('id', artifactId).single()

    if (error || !artifact) return res.status(404).json({ error: 'Artifact not found' })

    const fileName = `${artifact.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`

    let content, contentType, ext

    if (format === 'md') {
      content = contentToMarkdown(artifact)
      contentType = 'text/markdown'
      ext = 'md'
    } else {
      content = contentToMarkdown(artifact)
      contentType = 'text/plain'
      ext = 'txt'
    }

    // Return file for download
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}.${ext}"`)
    res.setHeader('Content-Type', contentType)
    res.setHeader('Content-Length', Buffer.byteLength(content))
    return res.send(content)
  } catch (err) {
    return res.status(500).json({ error: 'Export failed: ' + err.message })
  }
}
