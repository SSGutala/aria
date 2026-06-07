/**
 * /api/convert-app-language — Convert app code from one language to another.
 *
 * Takes a React/JS app and converts it to Python, Java, or HTML/CSS as requested.
 * Preserves the app's functionality and structure while adapting to the target language.
 */

import { createClient } from '@supabase/supabase-js'
import { createOrchestrator, respondWithError } from './lib/orchestrator.js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
)

const CONVERSION_SYSTEM = `You are a code conversion specialist. Convert the provided app code from JavaScript/React to the target language while:
- Preserving all functionality and features
- Maintaining the UI/UX layout and structure
- Using idiomatic patterns for the target language
- Ensuring the code is production-ready and fully functional

Target language specifics:
- Python: Use Flask/Django for web apps, maintain the same functionality
- Java: Use Spring Boot for web apps, convert components to servlets/controllers
- HTML/CSS: Convert React to vanilla HTML/CSS/JS, maintain responsiveness

Return ONLY the converted code - no explanations or markdown.`

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { projectId, targetLanguage, aiModel = 'claude' } = req.body || {}
  if (!projectId || !['python', 'java', 'html'].includes(targetLanguage)) {
    return res.status(400).json({ error: 'Missing or invalid: projectId, targetLanguage (python, java, html)' })
  }

  const orch = createOrchestrator({
    workflow: 'app_language_conversion',
    aiModel,
    traceContext: { projectId, targetLanguage },
  })

  try {
    // Fetch the project
    const { data: project, error: fetchErr } = await supabase
      .from('app_projects').select('*').eq('id', projectId).single()

    if (fetchErr || !project) {
      return res.status(404).json({ error: 'Project not found' })
    }

    // Skip if already in target language
    if (project.language === targetLanguage) {
      return res.json({ success: true, message: 'Already in target language', project })
    }

    // Get the main file (usually /App.js for React apps)
    const mainFile = project.files[project.entry || '/App.js'] || project.files[Object.keys(project.files)[0]]
    if (!mainFile) {
      return res.status(400).json({ error: 'No source code found' })
    }

    // Convert the code
    const prompt = `Convert this ${project.language || 'js'} app to ${targetLanguage}:

${mainFile.slice(0, 8000)}

Output the complete converted code in ${targetLanguage} format only.`

    const convertedCode = await orch.text('convert', {
      tier: 'smart',
      maxTokens: 8000,
      system: CONVERSION_SYSTEM,
      prompt,
    })

    if (!convertedCode || convertedCode.length < 50) {
      throw new Error('Conversion failed - empty result')
    }

    // Determine new entry point based on language
    const entryMap = {
      python: 'app.py',
      java: 'App.java',
      html: 'index.html',
    }

    // Update project with converted code
    const newEntry = entryMap[targetLanguage]
    const convertedFiles = {
      ...project.files,
      [newEntry]: convertedCode,
    }

    const { data: updated, error: updateErr } = await supabase
      .from('app_projects')
      .update({
        language: targetLanguage,
        entry: newEntry,
        files: convertedFiles,
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId)
      .select()
      .single()

    if (updateErr) throw new Error(updateErr.message)

    orch.end({ success: true, newLanguage: targetLanguage })
    return res.json({
      success: true,
      project: updated,
      message: `Successfully converted to ${targetLanguage}`,
    })
  } catch (err) {
    return respondWithError(res, err, orch)
  }
}
