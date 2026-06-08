# 🚀 Quick Start: Running Aria with New Features

## Prerequisites
- Node.js + npm
- Supabase project
- Gemini API key (in `.env.local` as `GOOGLE_API_KEY`)
- Claude & Groq API keys (for fallback)

## 1. Apply Database Migration

Run the new migration to add language & checkpoint support:

```bash
cd supabase
# Via Supabase CLI:
supabase migration up

# OR manually in Supabase dashboard:
# Run the SQL from: migrations/20260607_app_projects_enhancements.sql
```

## 2. Start the Development Server

```bash
npm install  # If not done
npm run dev
```

Server should start on `http://localhost:3001`

## 3. Test the Workflows

### ✅ Test App Build
1. Go to Workspace → "New App"
2. Describe an app: "A simple expense tracker with categories"
3. View the 3 design previews (carousel)
4. Pick a design + optional tweaks
5. Wait for build to complete
6. ✅ App persists (refresh page - should NOT rebuild)
7. Switch language via dropdown (Code tab)
8. Type changes: "Add a summary section"
9. Watch it apply

### ✅ Test Chat Build
1. Go to Workspace → Chat
2. Type: "Create a risk assessment document"
3. Answer clarifying questions
4. Document generates
5. ✅ In chat, type: "Add a compliance section"
6. Watch Aria auto-detect and edit
7. Click download icon (MD or TXT)

### ✅ Test Error Recovery
1. Build an app with intentional issues
2. Preview shows errors
3. Click "Fix with AI"
4. Watch auto-fix apply
5. Preview recompiles
6. ✅ State saved (no rebuild on refresh)

## 4. Expected Behavior

### Apps
```
Generate → Saved ✓
Refresh  → Loads from DB (NO REBUILD)
Change Language → Conversion only (NO REBUILD)
Edit     → Targeted file changes
Error    → Auto-fix attempt
```

### Documents
```
Generate → Saved ✓
Refresh  → Loads from DB (NO REBUILD)
Edit (UI) → Apply & save new version
Edit (Chat) → Auto-detect & apply
Download → MD or TXT format
```

### Providers
```
Gemini 2.5 (primary)
  ↓ (on rate limit)
Groq
  ↓
Claude
  ↓
Ollama (local, free)
```

## 5. Troubleshooting

### Error: "Artifact not found"
- Check Supabase connection
- Verify `artifacts` table exists
- Ensure user has RLS permissions

### Error: "Generation failed"
- Check Gemini API key in `.env.local`
- Check rate limits (Gemini, Groq, Claude)
- Check token limits (max_tokens in prompts)

### Language dropdown not showing
- Make sure you're on the "Code" tab
- Check browser console for JS errors
- Verify `convertAppLanguage` endpoint is registered

### Apps rebuilding on refresh
- Check if `app_projects` table has data
- Verify app loads with `status: 'ready'`
- Check if `currentProject` is being reset

## 6. Environment Variables

Ensure `.env.local` has:
```
GOOGLE_API_KEY=your_gemini_key
ANTHROPIC_API_KEY=your_claude_key
GROQ_API_KEY=your_groq_key
APP_ENGINE_PROVIDER=gemini
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

## 7. Key Files Modified/Added

New files:
- `/api/convert-app-language.js` - Language conversion
- `/api/artifacts-export.js` - Document downloads
- `/supabase/migrations/20260607_app_projects_enhancements.sql` - Schema

Modified:
- `/api/chat.js` - Auto-detect edit requests
- `/api/generate-app.js` - Pass chosenStyle through
- `/api/lib/appPipeline.js` - Inject styleDirective
- `src/lib/claude.js` - Add download & conversion functions
- `src/components/AppProjectPanel.jsx` - Language selector
- `src/pages/Workspace.jsx` - Handle artifact edits from chat

## 8. Success Indicators

✅ All tests pass:
- [ ] Apps generate and persist
- [ ] Documents generate and persist
- [ ] No rebuilds on refresh
- [ ] Language switching works
- [ ] Chat edit detection works
- [ ] Downloads work
- [ ] Auto-fix works
- [ ] Gemini is primary provider
- [ ] No errors in console

## 🎯 You're Ready!

Run the server and test the complete workflows. Everything should "just work" without errors.

If you encounter ANY errors, they will be detailed in:
- Browser console (F12)
- Server logs (terminal)
- Supabase dashboard

**Remember:** Apps and documents NEVER rebuild on view - they load from your database instantly. This saves tokens and ensures your work is always persisted.
