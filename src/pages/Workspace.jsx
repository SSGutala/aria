import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { supabase, MOCK_MODE } from '../lib/supabase'
import { analyzeAndQuestion, generateSpec, generateBrief, generatePMBrief, generateTaskBrief, generateRoleBrief, requestPMDocument, buildApp, editApp, getModeQuestions, getPMPackageOrQuestions, getRolePackageOrQuestions, getEngineQuestions, setActiveRoleContext, sendChatMessage, getModelStatus, generateAppProject, generateAppProjectStream, editAppProject, editAppProjectStream, generateStylePreviews, uploadTemplate } from '../lib/claude'
import ArtifactViewer from '../components/ArtifactViewer'
import ArtifactPanel from '../components/ArtifactPanel'
import { useBreakpoint } from '../hooks/useBreakpoint'
import { useToast } from '../contexts/ToastContext'
import { logError } from '../utils/errorHandler'
import { logAction, logFailed } from '../lib/devlog'
import { useProfile, getDefaultBuildMode } from '../hooks/useProfile'
import { saveConversationMemory, loadUserMemories, formatMemoriesForPrompt } from '../lib/memory'

function toHistoryMessages(msgs) {
  return msgs
    .filter(m => m.content && m.message_type === 'text')
    .map(m => ({ role: m.role, content: m.content }))
}

// ─── DIRECT BUILD MODE ───────────────────────────────────────────────────────
// When true, a build prompt skips the guided intake → questions → enterprise
// brief → document pipeline and goes STRAIGHT to staged app generation. The
// brief/docs flow is fully preserved in the codebase (runAnalyzeAndQuestion,
// runEngineQuestions, runBrief, handleRequestDocument, api/engines/*, the
// EngineIntakeCard/SpecCard/brief components) — it is only bypassed here, so we
// can re-enable it later by flipping this flag back to false. See PARKED_FLOWS.md.
const DIRECT_BUILD_MODE = true

import Sidebar from '../components/Sidebar'
import Topbar from '../components/Topbar'
import ChatArea from '../components/ChatArea'
import InputZone from '../components/InputZone'
import OnboardingFlow from '../components/OnboardingFlow'
import HomeScreen from '../components/HomeScreen'
import EngineIntakeCard from '../components/EngineIntakeCard'
import DocsTypeCard from '../components/DocsTypeCard'
import RoleBadge from '../components/RoleBadge'
import AppProjectPanel from '../components/AppProjectPanel'
import StyleCarousel from '../components/StyleCarousel'

export default function Workspace() {
  const { convId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { isMobile, isSmall } = useBreakpoint()
  const toast = useToast()

  // Surface API failures with a typed, user-friendly toast. Logs full error
  // context for telemetry while keeping the UI free of stack traces.
  const handleApiError = useCallback((err, { action, onRetry } = {}) => {
    logError(err, { action })
    const userMessage = err?.userMessage || err?.message || 'Something went wrong.'
    const retryable = err?.retryable ?? false
    // Update command-bar fault state
    opStartedAtRef.current = null
    setLastError(action ? `${action}: ${userMessage}` : userMessage)
    logFailed('action.failed', { action, error: userMessage })
    toast.error(userMessage, {
      title: action ? `Couldn't ${action}` : null,
      onRetry: retryable && onRetry ? onRetry : null,
    })
  }, [toast])

  const [user, setUser] = useState(null)
  const [conversations, setConversations] = useState([])
  const [apps, setApps] = useState([])
  const [appProjects, setAppProjects] = useState([])   // new-engine multi-file projects (app_projects table)
  const [folders, setFolders] = useState([])           // project folders grouping chats + apps
  const [showNewApp, setShowNewApp] = useState(false)  // blank "build an app" prompt modal
  const [newAppText, setNewAppText] = useState('')
  // Design-style carousel: before building, show 3 design directions to pick from.
  const [styleChoices, setStyleChoices] = useState(null)   // null | [{ id, label, vibe, files }]
  const [loadingStyles, setLoadingStyles] = useState(false)
  const [pendingAppPrompt, setPendingAppPrompt] = useState('')
  const [messages, setMessages] = useState([])
  const [currentConv, setCurrentConv] = useState(null)
  const [currentApp, setCurrentApp] = useState(null)
  const [currentProject, setCurrentProject] = useState(null)   // new-engine multi-file project
  const [generatingApp, setGeneratingApp] = useState(false)
  const [editingApp, setEditingApp] = useState(false)
  const [autoFixing, setAutoFixing] = useState(false)
  const [editProgress, setEditProgress] = useState({ percent: 0, message: '' })
  const [editLog, setEditLog] = useState([])           // running narration of edit steps
  const [editElapsedMs, setEditElapsedMs] = useState(0)
  const editStartRef = useRef(0)
  const repairAttemptsRef = useRef(0)
  const lastRepairSigRef = useRef('')
  const repairSigCountsRef = useRef({})   // { [errorSignature]: attemptCount }
  const [genProgress, setGenProgress] = useState({ percent: 0, message: '' })
  const [genElapsedMs, setGenElapsedMs] = useState(0)
  const genStartRef = useRef(0)
  const [isTyping, setIsTyping] = useState(false)
  const [modelStatus, setModelStatus] = useState({ degraded: false })
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const [buildingLabel, setBuildingLabel] = useState(null)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [showSidebar, setShowSidebar] = useState(false)
  // Ollama is the standard default. Override only via Settings (persisted to localStorage).
  const [currentModel, setCurrentModel] = useState(() => {
    try { return localStorage.getItem('aria_model') || import.meta.env.VITE_DEFAULT_AI_MODEL || 'groq' }
    catch { return 'ollama' }
  })
  const [lastLatencyMs, setLastLatencyMs] = useState(null)
  const [lastError, setLastError] = useState(null)
  const opStartedAtRef = useRef(null)
  const { profile } = useProfile()
  const defaultBuildMode = profile ? getDefaultBuildMode(profile.account_type, profile.work_category) : null
  const [userMemories, setUserMemories] = useState([])

  // ─── Artifact system ──────────────────────────────────────────────────────────
  const [artifacts, setArtifacts] = useState([])
  const [viewingArtifact, setViewingArtifact] = useState(null)
  const [showArtifactPanel, setShowArtifactPanel] = useState(false)

  // ─── Pending state refs across the multi-stage flow ──────────────────────────
  const pendingPromptRef       = useRef(null)
  const pendingClarMsgIdRef    = useRef(null)
  const pendingClarV2MsgIdRef  = useRef(null)
  const pendingSpecMsgIdRef    = useRef(null)
  const pendingSpecRef         = useRef(null)
  const pendingClarAnswersRef  = useRef(null)
  const pendingBriefMsgIdRef   = useRef(null)
  const pendingBuildModeMsgId  = useRef(null)
  const pendingPMPackageMsgId  = useRef(null)
  const pendingPMPackageRef    = useRef(null)  // stores selected pmPackage ('lean'|'enterprise'|'full_lifecycle')
  const pendingRoleMsgId       = useRef(null)
  const pendingRoleRef         = useRef(null)  // stores selected role ('operations'|'finance'|etc)
  const pendingEngineIntakeMsgId = useRef(null)   // engine_intake card
  const pendingDocTypeMsgId    = useRef(null)     // doc_type_picker card
  const pendingEngineRef       = useRef(null)     // current engine ('software'|'docs'|'automation'|'analytics')
  const pendingDocTypeRef      = useRef(null)     // selected doc type

  useEffect(() => {
    let cancelled = false
    // Resolve the signed-in user reliably. getUser() makes a network call that
    // can race or fail right after a redirect; fall back to the cached session
    // user so the sidebar + history aren't hidden just because that call lagged.
    const applyUser = (u) => {
      if (cancelled || !u) return
      setUser(prev => prev?.id === u.id ? prev : u)
      if (localStorage.getItem('aria_new_user')) setShowOnboarding(true)
      loadUserMemories(u.id).then(setUserMemories)
    }
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) applyUser(data.user)
      else supabase.auth.getSession().then(({ data: s }) => applyUser(s?.session?.user))
    }).catch(() => {
      supabase.auth.getSession().then(({ data: s }) => applyUser(s?.session?.user))
    })
    // Keep user in sync if auth resolves/refreshes after this mount.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user) applyUser(session.user)
    })
    return () => { cancelled = true; subscription.unsubscribe() }
  }, [])

  // Tick a live elapsed clock while an app build is running, so we can show a
  // real "time left" estimate that updates smoothly between pipeline events.
  useEffect(() => {
    if (!generatingApp) return
    const id = setInterval(() => setGenElapsedMs(Date.now() - genStartRef.current), 250)
    return () => clearInterval(id)
  }, [generatingApp])

  // Same live clock for edits/repairs, so the edit bar shows a real elapsed time.
  useEffect(() => {
    if (!editingApp && !autoFixing) return
    const id = setInterval(() => setEditElapsedMs(Date.now() - editStartRef.current), 250)
    return () => clearInterval(id)
  }, [editingApp, autoFixing])

  // Drive command-bar timing from typing state. When an AI op starts, record
  // start time + clear last error. When it ends (without error), record latency.
  useEffect(() => {
    if (isTyping) {
      opStartedAtRef.current = Date.now()
      setLastError(null)
    } else if (opStartedAtRef.current) {
      setLastLatencyMs(Date.now() - opStartedAtRef.current)
      opStartedAtRef.current = null
    }
  }, [isTyping])

  // Poll model status so the user is told when Claude is degrading to the Groq
  // fallback (e.g. Anthropic out of credits) instead of silently shipping weaker output.
  useEffect(() => {
    let cancelled = false
    const check = async () => {
      const s = await getModelStatus()
      if (!cancelled) setModelStatus(s || { degraded: false })
    }
    check()
    const id = setInterval(check, 15000)
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  // Re-check immediately whenever an AI op finishes (catches a fresh fallback fast).
  useEffect(() => {
    if (!isTyping) { getModelStatus().then(s => setModelStatus(s || { degraded: false })) }
  }, [isTyping])

  const loadConversations = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('conversations').select('*').eq('user_id', user.id)
      .neq('deleted', true)
      .order('updated_at', { ascending: false })
    // Hide "app-shell" conversations (kind === 'app') created by the New-app flow
    // so they don't clutter the Chats list. Filtered in JS so this stays graceful
    // if the `kind` column hasn't been migrated yet (undefined → kept as a chat).
    setConversations((data || []).filter(c => c.kind !== 'app'))
  }, [user])

  // Project folders that group chats + apps. Best-effort: if the migration hasn't
  // run yet, the query errors and we just keep an empty folder list.
  const loadFolders = useCallback(async () => {
    if (!user) return
    const { data, error } = await supabase
      .from('project_folders').select('*').eq('user_id', user.id)
      .order('created_at', { ascending: true })
    if (error) return
    setFolders(data || [])
  }, [user])

  const loadApps = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('generated_apps').select('*').eq('user_id', user.id)
      .neq('deleted', true)
      .order('created_at', { ascending: false })
    setApps(data || [])
  }, [user])

  // New-engine projects (multi-file, previewable in-app). Best-effort: if the
  // app_projects migration hasn't been run yet, just leave the list empty.
  const loadAppProjects = useCallback(async () => {
    if (!user) return
    const { data, error } = await supabase
      .from('app_projects').select('*').eq('user_id', user.id)
      .neq('status', 'deleted')
      .order('created_at', { ascending: false })
    if (error) return
    setAppProjects(data || [])
  }, [user])

  // Soft-delete a generated project (status → 'deleted'). Closes the preview if
  // the deleted project is the one currently open, then refreshes the list.
  const handleDeleteProject = useCallback(async (projectId) => {
    if (!projectId) return
    const { error } = await supabase
      .from('app_projects')
      .update({ status: 'deleted', updated_at: new Date().toISOString() })
      .eq('id', projectId)
    if (error) { handleApiError(error, { action: 'delete the app' }); return }
    logAction('app.project_deleted', { projectId })
    setAppProjects(prev => prev.filter(p => p.id !== projectId))
    setCurrentProject(prev => (prev && prev.id === projectId ? null : prev))
  }, [handleApiError])

  // ─── Project folders: CRUD + membership + pinning ───────────────────────────
  const handleCreateFolder = useCallback(async (name = 'New project') => {
    if (!user) return null
    const { data, error } = await supabase
      .from('project_folders').insert({ user_id: user.id, name }).select().single()
    if (error) { handleApiError(error, { action: 'create the folder' }); return null }
    logAction('folder.created', { folderId: data.id })
    setFolders(prev => [...prev, data])
    return data
  }, [user, handleApiError])

  const handleRenameFolder = useCallback(async (folderId, name) => {
    if (!folderId || !name?.trim()) return
    setFolders(prev => prev.map(f => f.id === folderId ? { ...f, name: name.trim() } : f))
    await supabase.from('project_folders').update({ name: name.trim(), updated_at: new Date().toISOString() }).eq('id', folderId)
  }, [])

  const handleDeleteFolder = useCallback(async (folderId) => {
    if (!folderId) return
    // ON DELETE SET NULL un-files the folder's chats/apps rather than deleting them.
    const { error } = await supabase.from('project_folders').delete().eq('id', folderId)
    if (error) { handleApiError(error, { action: 'delete the folder' }); return }
    logAction('folder.deleted', { folderId })
    setFolders(prev => prev.filter(f => f.id !== folderId))
    loadConversations(); loadAppProjects()
  }, [handleApiError, loadConversations, loadAppProjects])

  // Move a chat or app into a folder (folderId = null → unfile it).
  const handleMoveToFolder = useCallback(async (itemType, itemId, folderId) => {
    if (!itemId) return
    if (itemType === 'chat') {
      setConversations(prev => prev.map(c => c.id === itemId ? { ...c, folder_id: folderId } : c))
      await supabase.from('conversations').update({ folder_id: folderId }).eq('id', itemId)
    } else {
      setAppProjects(prev => prev.map(p => p.id === itemId ? { ...p, folder_id: folderId } : p))
      await supabase.from('app_projects').update({ folder_id: folderId }).eq('id', itemId)
    }
    logAction('item.moved_to_folder', { itemType, itemId, folderId })
  }, [])

  // Pin / unpin a chat or app (pinned items sort to the top of their section).
  const handlePinItem = useCallback(async (itemType, itemId, pinned) => {
    if (!itemId) return
    if (itemType === 'chat') {
      setConversations(prev => prev.map(c => c.id === itemId ? { ...c, pinned } : c))
      await supabase.from('conversations').update({ pinned }).eq('id', itemId)
    } else if (itemType === 'folder') {
      setFolders(prev => prev.map(f => f.id === itemId ? { ...f, pinned } : f))
      await supabase.from('project_folders').update({ pinned, updated_at: new Date().toISOString() }).eq('id', itemId)
    } else {
      setAppProjects(prev => prev.map(p => p.id === itemId ? { ...p, pinned } : p))
      await supabase.from('app_projects').update({ pinned }).eq('id', itemId)
    }
  }, [])

  // Rename an app project (from the Topbar app-build title or the sidebar).
  const handleRenameProject = useCallback(async (id, title) => {
    const trimmed = (title || '').trim()
    if (!id || !trimmed) return
    setCurrentProject(prev => (prev && prev.id === id ? { ...prev, title: trimmed } : prev))
    setAppProjects(prev => prev.map(p => p.id === id ? { ...p, title: trimmed } : p))
    await supabase.from('app_projects').update({ title: trimmed }).eq('id', id)
  }, [])

  useEffect(() => {
    if (user) { loadConversations(); loadApps(); loadAppProjects(); loadFolders() }
  }, [user, loadConversations, loadApps, loadAppProjects, loadFolders])

  // Navigating to a different chat (New chat, or clicking an existing chat/home)
  // should immediately surface that chat — never leave the user stranded on the
  // New-app composer or a project preview. So whenever the active convId changes,
  // drop any in-progress app-build surface. (Building a new app doesn't change
  // convId, so this won't clobber a freshly built preview.)
  const prevConvIdRef = useRef(convId)
  useEffect(() => {
    if (prevConvIdRef.current !== convId) {
      prevConvIdRef.current = convId
      setShowNewApp(false)
      setCurrentProject(null)
    }
  }, [convId])

  useEffect(() => {
    if (!convId) return
    supabase.from('conversations').select('*').eq('id', convId).single()
      .then(({ data }) => {
        setCurrentConv(data)
        // Push this conversation's frozen role context into the API client
        // so every downstream call uses the role active when the chat began.
        if (data) {
          setActiveRoleContext({
            role: data.role_context || null,
            customRole: data.custom_role_context || null,
            seniority: data.seniority_context || null,
            intendedUseCases: data.intended_use_cases || [],
            overridden: data.role_overridden || false,
          })
        }
      })
    supabase.from('messages').select('*').eq('conversation_id', convId).order('created_at')
      .then(({ data }) => {
        const msgs = data || []
        setMessages(msgs)
        // Restore pending refs so interactive handlers re-attach on refresh
        const ct = (m) => m.metadata?.cardType || m.message_type
        const lastOf = (type) => [...msgs].reverse().find(m => ct(m) === type)
        const hasAppCard = msgs.some(m => m.message_type === 'app_card')
        if (!hasAppCard) {
          const clarV2 = lastOf('clarification_v2')
          const clar = lastOf('clarification')
          const lastBrief = lastOf('enterprise_brief')
          const lastSpec = lastOf('spec')
          const lastBuildMode = lastOf('build_mode')
          const lastPMPackage = lastOf('pm_package')
          const lastRolePackage = lastOf('role_package')

          if (clarV2 && (!lastBrief || clarV2.created_at > (lastBrief?.created_at || ''))) {
            pendingClarV2MsgIdRef.current = clarV2.id
          }
          if (clar && (!lastSpec || clar.created_at > (lastSpec?.created_at || ''))) {
            pendingClarMsgIdRef.current = clar.id
          }
          if (lastBrief) {
            pendingBriefMsgIdRef.current = lastBrief.id
            pendingSpecRef.current = lastBrief.metadata?.brief?.appSpec || null
          }
          if (lastSpec) {
            pendingSpecMsgIdRef.current = lastSpec.id
            pendingSpecRef.current = lastSpec.metadata?.spec || null
          }
          // Restore build mode / PM / role pending refs if no downstream card yet
          if (lastBuildMode && !lastBrief && !lastSpec && !clarV2 && !clar) {
            pendingBuildModeMsgId.current = lastBuildMode.id
          }
          if (lastPMPackage && !clarV2) {
            pendingPMPackageMsgId.current = lastPMPackage.id
          }
          if (lastRolePackage && !clarV2) {
            pendingRoleMsgId.current = lastRolePackage.id
          }
          // Restore clarification answers if a brief was already generated
          if (lastBrief?.metadata?.clarificationAnswers) {
            pendingClarAnswersRef.current = lastBrief.metadata.clarificationAnswers
          }
          const lastUser = [...msgs].reverse().find(m => m.role === 'user')
          if (lastUser) pendingPromptRef.current = lastUser.content
        }
      })
    supabase.from('generated_apps').select('*').eq('conversation_id', convId).single()
      .then(({ data }) => setCurrentApp(data || null))
    // Load artifacts for this conversation
    loadArtifacts(convId)
    // Reset all pending state on conv change
    pendingPromptRef.current      = null
    pendingClarMsgIdRef.current   = null
    pendingClarV2MsgIdRef.current = null
    pendingSpecMsgIdRef.current   = null
    pendingSpecRef.current        = null
    pendingClarAnswersRef.current = null
    pendingBriefMsgIdRef.current  = null
    setArtifacts([])
    setViewingArtifact(null)
    setShowArtifactPanel(false)
  }, [convId])

  // ─── Auto-fire pending prompt from home screen suggestion ────────────────
  useEffect(() => {
    const pending = location.state?.pendingPrompt
    const pendingEngine = location.state?.pendingEngine
    if (!pending || !convId || !user) return
    // Clear the state so it doesn't re-fire on refresh
    navigate(location.pathname, { replace: true, state: {} })
    // If engine known upfront, set it before submit
    if (pendingEngine) pendingEngineRef.current = pendingEngine
    // Small delay to let the conversation load first
    const t = setTimeout(() => handleSubmit(pending), 200)
    return () => clearTimeout(t)
  }, [convId, user, location.state?.pendingPrompt])

  // ─── Load artifacts for a conversation ────────────────────────────────────
  async function loadArtifacts(cid) {
    if (!cid) return
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'
      const res = await fetch(`${apiUrl}/api/artifacts?conversationId=${cid}`)
      const data = await res.json()
      if (data.artifacts) setArtifacts(data.artifacts)
    } catch {}
  }

  // ─── Open artifact in viewer ───────────────────────────────────────────────
  function openArtifact(artifactOrId) {
    if (!artifactOrId) return
    if (typeof artifactOrId === 'string') {
      const found = artifacts.find(a => a.id === artifactOrId)
      if (found) setViewingArtifact(found)
    } else {
      setViewingArtifact(artifactOrId)
    }
  }

  function handleArtifactUpdate(updatedArtifact) {
    setArtifacts(prev => {
      // Replace old artifact (same id or superseded) with updated
      const next = prev.map(a => {
        if (a.id === updatedArtifact.id) return updatedArtifact
        // If a previous version was superseded, keep it
        return a
      })
      // If updatedArtifact is new (AI edit creates new version), add it
      if (!next.find(a => a.id === updatedArtifact.id)) return [...next, updatedArtifact]
      return next
    })
    setViewingArtifact(updatedArtifact)
  }

  // ─── Build app (shared between quick+spec path and guided+brief path) ─────────
  async function handleBuildApp() {
    const spec = pendingSpecRef.current
    const prompt = pendingPromptRef.current
    const clarAnswers = pendingClarAnswersRef.current
    if (!spec || !prompt) return

    pendingSpecMsgIdRef.current = null
    pendingBriefMsgIdRef.current = null

    const cyclingLabels = [
      'Designing data structure...',
      'Planning the workflow...',
      'Crafting your form fields...',
      'Building the app...',
      'Almost ready...',
    ]
    let labelIdx = 0
    setBuildingLabel(cyclingLabels[0])
    setIsTyping(true)

    const labelInterval = setInterval(() => {
      labelIdx = (labelIdx + 1) % cyclingLabels.length
      setBuildingLabel(cyclingLabels[labelIdx])
    }, 1800)

    try {
      const result = await buildApp(prompt, convId, spec, clarAnswers, currentModel)
      clearInterval(labelInterval)
      setIsTyping(false)
      setBuildingLabel(null)

      // Fetch only the new app_card message the backend just saved — keep all existing local UI cards
      const { data: freshMsgs } = await supabase.from('messages').select('*').eq('conversation_id', convId).order('created_at')
      setMessages(prev => {
        const existingIds = new Set(prev.map(m => m.id))
        const newMsgs = (freshMsgs || []).filter(m => !existingIds.has(m.id))
        return [...prev, ...newMsgs]
      })
      setCurrentApp({ slug: result.slug, id: result.appId, title: result.schema?.appTitle })
      logAction('app.built', { conversationId: convId, appId: result.appId })
      pendingSpecRef.current  = null
      pendingPromptRef.current = null
      loadApps()
      loadConversations()
    } catch (err) {
      handleApiError(err, { action: 'build your app', onRetry: () => handleBuildApp() })
      // Re-attach the spec card so the user can also retry from the canvas.
      if (pendingSpecRef.current) {
        const retryId = Date.now().toString() + '_spec_retry'
        pendingSpecMsgIdRef.current = retryId
        setMessages(prev => [...prev, { id: retryId, role: 'assistant', content: '', message_type: 'spec', metadata: { spec: pendingSpecRef.current } }])
      }
    } finally {
      clearInterval(labelInterval)
      setIsTyping(false)
      setBuildingLabel(null)
    }
  }

  // ─── New engine: staged, provider-agnostic multi-file generation ────────────
  // Runs the real pipeline (plan → file tree → per-file codegen → assemble) via
  // Aria's model router (defaults to Ollama, $0). Renders a live Sandpack preview.
  // Falls back to the legacy template build only if the new engine errors.
  async function handleGenerateApp() {
    const prompt = pendingPromptRef.current || pendingSpecRef.current?.appTitle
    if (!prompt) return
    pendingSpecMsgIdRef.current = null
    pendingBriefMsgIdRef.current = null

    setGeneratingApp(true)
    setIsTyping(true)
    setGenProgress({ percent: 2, message: 'Starting the generation pipeline…' })
    setBuildingLabel('Generating your app…')
    // Fresh build → reset the self-repair budget so the new app gets its own attempts.
    repairAttemptsRef.current = 0
    lastRepairSigRef.current = ''
    repairSigCountsRef.current = {}
    genStartRef.current = Date.now()
    setGenElapsedMs(0)
    // Monotonic progress driven by REAL pipeline events (never goes backwards).
    const onEvent = (evt) => {
      setGenProgress(prev => ({
        percent: Math.max(prev.percent, typeof evt.percent === 'number' ? evt.percent : prev.percent),
        message: evt.message || prev.message,
        stage: evt.stage,
        etaSeconds: typeof evt.etaSeconds === 'number' ? evt.etaSeconds : prev.etaSeconds,
      }))
    }
    try {
      const result = await generateAppProjectStream(convId, prompt, { onEvent }, currentModel)
      setGenProgress({ percent: 100, message: 'Done.' })
      const project = result?.project || {
        title: result?.appName, summary: result?.summary, files: result?.files,
        entry: result?.entry, file_tree: result?.fileTree, generation_errors: result?.errors,
      }
      setCurrentProject(project)
      logAction('app.generated_v2', { conversationId: convId, projectId: result?.projectId, fileCount: Object.keys(result?.files || {}).length })
      addMsg(result?.summary || `Generated ${project.title || 'your app'} — open the preview to see it live.`)
      // Refresh the sidebar "My Apps" list so the new project is reopenable
      // later without regenerating.
      loadAppProjects()
    } catch (err) {
      // Providers exhausted: don't silently grind on slow local Ollama or the
      // legacy engine — tell the user exactly what's unavailable and when it's back.
      if (err.providersUnavailable) {
        logAction('app.generate_v2_providers_unavailable', { conversationId: convId, retryAfterMs: err.retryAfterMs })
        addMsg(err.message, true)
      } else {
        // Other error — fall back to the legacy template engine so the user isn't blocked.
        logAction('app.generate_v2_failed_fallback', { conversationId: convId, error: err.message })
        addMsg('The new generation engine hit an error, so I used the classic builder instead. (Tip: make sure Ollama is running, or switch the provider.)', true)
        await handleBuildApp()
      }
    } finally {
      setGeneratingApp(false)
      setIsTyping(false)
      setBuildingLabel(null)
      setGenProgress({ percent: 0, message: '' })
    }
  }

  // ─── "New app" from the + New menu — a blank prompt that builds directly ────
  // Creates a hidden app-shell conversation (kind:'app', so it doesn't show in
  // Chats) purely to satisfy app_projects' FK, then runs the same generation
  // pipeline with the typed prompt and opens the live preview. No brief/spec step.
  // Step 1 of the App-build flow: the user describes the app → generate 3 design
  // directions and show the carousel. (The real build happens in step 2,
  // runAppBuild, once they pick a style.)
  async function handleBuildNewApp(promptText) {
    const prompt = (promptText || '').trim()
    if (!prompt || !user) return
    setPendingAppPrompt(prompt)
    setStyleChoices(null)
    setLoadingStyles(true)
    try {
      const { styles } = await generateStylePreviews(prompt, {}, currentModel)
      if (styles?.length) {
        setStyleChoices(styles)
        setNewAppText('')
      } else {
        // No previews → fall straight through to a default build.
        await runAppBuild(prompt, {})
      }
    } catch (err) {
      // Preview generation failed → don't block the user; build directly.
      logAction('app.style_previews_failed', { error: err?.message })
      await runAppBuild(prompt, {})
    } finally {
      setLoadingStyles(false)
    }
  }

  function handleCancelStyles() {
    setStyleChoices(null)
    setPendingAppPrompt('')
  }

  // Step 2: the user picked a design direction (and optional tweaks) → build the
  // real app with that style threaded in as a hard design constraint.
  async function handleConfirmStyle(chosenStyle, styleOpinion) {
    const prompt = pendingAppPrompt
    if (!prompt) return
    await runAppBuild(prompt, { chosenStyle, styleOpinion })
    setStyleChoices(null)
    setPendingAppPrompt('')
  }

  async function runAppBuild(promptText, styleCtx = {}) {
    const prompt = (promptText || '').trim()
    if (!prompt || !user) return

    // Create the backing app-shell conversation. The `kind: 'app'` discriminator
    // is what keeps this shell out of the Chats list and files its app under
    // "Recent Apps" (standalone) rather than nesting it under a chat. If the
    // `kind` column hasn't been migrated yet, that insert errors — so retry
    // without it so New app still works (the app just classifies as standalone
    // once the migration lands).
    const shellTitle = prompt.length > 40 ? prompt.slice(0, 40) + '…' : prompt
    let { data: shell, error: shellErr } = await supabase.from('conversations')
      .insert({ user_id: user.id, title: shellTitle, kind: 'app' })
      .select().single()
    if (shellErr && /kind/i.test(shellErr.message || '')) {
      ({ data: shell, error: shellErr } = await supabase.from('conversations')
        .insert({ user_id: user.id, title: shellTitle })
        .select().single())
    }
    if (shellErr || !shell) { handleApiError(shellErr || new Error('Could not start the app'), { action: 'start a new app' }); return }
    const shellConvId = shell.id

    setGeneratingApp(true)
    setGenProgress({ percent: 2, message: 'Starting the generation pipeline…' })
    repairAttemptsRef.current = 0
    lastRepairSigRef.current = ''
    repairSigCountsRef.current = {}
    genStartRef.current = Date.now()
    setGenElapsedMs(0)
    const onEvent = (evt) => {
      setGenProgress(prev => ({
        percent: Math.max(prev.percent, typeof evt.percent === 'number' ? evt.percent : prev.percent),
        message: evt.message || prev.message,
        stage: evt.stage,
        etaSeconds: typeof evt.etaSeconds === 'number' ? evt.etaSeconds : prev.etaSeconds,
      }))
    }
    try {
      const buildContext = {}
      if (styleCtx?.chosenStyle) buildContext.chosenStyle = { id: styleCtx.chosenStyle.id, label: styleCtx.chosenStyle.label, vibe: styleCtx.chosenStyle.vibe }
      if (styleCtx?.styleOpinion) buildContext.styleOpinion = styleCtx.styleOpinion
      const result = await generateAppProjectStream(shellConvId, prompt, { onEvent, context: Object.keys(buildContext).length ? buildContext : undefined }, currentModel)
      setGenProgress({ percent: 100, message: 'Done.' })
      const project = result?.project || {
        title: result?.appName, summary: result?.summary, files: result?.files,
        entry: result?.entry, file_tree: result?.fileTree, generation_errors: result?.errors,
      }
      autoFixedProjectRef.current = ''
      setCurrentProject(project)
      logAction('app.new_app_built', { conversationId: shellConvId, projectId: result?.projectId })
      loadAppProjects()
      setShowNewApp(false)
      setNewAppText('')
    } catch (err) {
      if (err.providersUnavailable) {
        toast.error(err.message, { title: 'Generation paused' })
      } else {
        handleApiError(err, { action: 'build your app', onRetry: () => handleBuildNewApp(prompt) })
      }
    } finally {
      setGeneratingApp(false)
      setGenProgress({ percent: 0, message: '' })
    }
  }

  // Iterative edit / repair of the open generated project. Patches only the
  // affected files via the staged engine and refreshes the preview.
  // Works whether or not the project was persisted. When there's no DB id we
  // send the current files/plan inline so the backend can edit/repair in memory
  // and return updated files — the preview is refreshed from those directly.
  async function handleEditProject(editRequest, opts = {}) {
    if (!currentProject || !editRequest?.trim()) return null
    setEditingApp(true)
    // Reset the live progress/narration for this edit pass.
    editStartRef.current = Date.now()
    setEditElapsedMs(0)
    setEditProgress({ percent: 4, message: opts.isRepair ? 'Diagnosing the error…' : 'Reading your request…' })
    setEditLog([{ stage: 'start', message: opts.isRepair ? 'Aria is fixing the app automatically.' : `Applying your change: “${editRequest.length > 80 ? editRequest.slice(0, 80) + '…' : editRequest}”` }])
    // Monotonic progress + a running narration of the edit steps. These messages
    // come straight from the pipeline's stage events — pure logging, no AI.
    const onEvent = (evt) => {
      setEditProgress(prev => ({
        percent: Math.max(prev.percent, typeof evt.percent === 'number' ? evt.percent : prev.percent),
        message: evt.message || prev.message,
        stage: evt.stage,
      }))
      if (evt.message) setEditLog(prev => [...prev, { stage: evt.stage, message: evt.message }])
    }
    try {
      const result = await editAppProjectStream(
        currentProject.id || null,
        editRequest,
        { ...opts, onEvent, files: currentProject.files || {}, plan: currentProject.app_plan || currentProject.plan || {} },
        currentModel
      )
      setEditProgress({ percent: 100, message: 'Done.' })
      // Prefer the persisted project row; otherwise merge returned files into the
      // in-memory project so the Sandpack preview recompiles with the fix.
      if (result?.project) {
        setCurrentProject(result.project)
      } else if (result?.files) {
        setCurrentProject(prev => ({
          ...prev,
          files: result.files,
          generation_errors: result.errors || [],
          summary: result.summary || prev?.summary,
        }))
      }
      if (result?.summary) setEditLog(prev => [...prev, { stage: 'summary', message: result.summary }])
      logAction(opts.isRepair ? 'app.repaired_v2' : 'app.edited_v2', { projectId: currentProject.id || '(inline)', changed: result?.changedFiles?.length || 0 })
      return result
    } catch (err) {
      setEditLog(prev => [...prev, { stage: 'error', message: 'Edit failed: ' + (err.message || 'unknown error') }])
      handleApiError(err, { action: 'edit your app', onRetry: () => handleEditProject(editRequest, opts) })
      return null
    } finally {
      setEditingApp(false)
      setTimeout(() => setEditProgress({ percent: 0, message: '' }), 600)
    }
  }

  // Aria fixes its OWN code. When the live preview throws a compile/runtime
  // error, automatically run repair passes — the user never has to touch code.
  // We keep fixing until the preview compiles clean, with two guard rails so it
  // can't loop forever on a genuinely unfixable bug:
  //   • a TOTAL attempt cap across the whole build session, and
  //   • a per-error cap so we retry the SAME error a few times (the first fix
  //     often doesn't land) but eventually give up on a stuck one.
  // The error counter is reset on every fresh build and whenever the preview
  // compiles cleanly (see ErrorWatcher), so a brand-new error after a good fix
  // gets a full budget again.
  const MAX_AUTO_REPAIRS = 12        // total passes per build session
  const MAX_PER_ERROR = 3            // retries for one specific error signature
  async function handleAutoRepair(errorText) {
    if (!currentProject || editingApp || autoFixing) return
    if (repairAttemptsRef.current >= MAX_AUTO_REPAIRS) return
    const sig = (errorText || '').replace(/\d+/g, '').slice(0, 240)
    const perError = repairSigCountsRef.current
    const seen = perError[sig] || 0
    if (sig && seen >= MAX_PER_ERROR) return // this exact error is stuck — stop
    perError[sig] = seen + 1
    lastRepairSigRef.current = sig
    repairAttemptsRef.current += 1
    setAutoFixing(true)
    try {
      await handleEditProject(
        `The live preview is failing to compile/run with this error. Fix the code so it compiles and runs correctly, and make sure every imported symbol actually exists and is exported from the file it's imported from. Do not change the app's intended behavior or design — only fix the bug.\n\nError:\n${errorText}`,
        { isRepair: true, errorText }
      )
    } finally {
      setAutoFixing(false)
    }
  }

  // Auto-fix generation errors. When a freshly generated project carries
  // build/generation errors, kick off a repair pass automatically — the user
  // shouldn't have to click "Fix with AI". Guarded by the same attempt budget
  // as preview repairs so it can't loop forever on an unfixable build.
  const autoFixedProjectRef = useRef('')
  useEffect(() => {
    const proj = currentProject
    if (!proj) return
    const errs = proj.generation_errors || proj.errors || []
    if (!errs.length) return
    if (editingApp || autoFixing || generatingApp) return
    if (repairAttemptsRef.current >= MAX_AUTO_REPAIRS) return
    // Only auto-fix a given project's generation errors once per signature so we
    // don't re-trigger on every render after the same fix attempt.
    const sig = (proj.id || proj.title || '') + ':' + errs.length
    if (autoFixedProjectRef.current === sig) return
    autoFixedProjectRef.current = sig
    handleEditProject('Fix the build/generation issues in the app so it compiles and runs cleanly. Do not change the intended behavior or design.', { isRepair: true, errorText: JSON.stringify(errs) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProject, editingApp, autoFixing, generatingApp])

  // ─── Quick path: spec card ─────────────────────────────────────────────────
  async function runSpec(prompt, clarificationAnswers = null) {
    setBuildingLabel('Generating app spec...')
    setIsTyping(true)
    try {
      const result = await generateSpec(prompt, convId, clarificationAnswers, toHistoryMessages(messages), currentModel)
      setIsTyping(false)
      setBuildingLabel(null)

      const specId = Date.now().toString() + '_spec'
      pendingSpecMsgIdRef.current = specId
      pendingSpecRef.current = result.spec
      pendingPromptRef.current = prompt
      pendingClarAnswersRef.current = clarificationAnswers

      const specMsg = { id: specId, role: 'assistant', content: '', message_type: 'spec', metadata: { spec: result.spec } }
      setMessages(prev => [...prev, specMsg])
      await persistCardMessages([specMsg])
      // Save cross-conversation memory
      const specSummary = typeof result.spec === 'string'
        ? result.spec
        : (result.spec?.summary || result.spec?.appName || result.spec?.title || JSON.stringify(result.spec || {}))
      saveConversationMemory(convId, {
        summary: specSummary.slice(0, 300) || prompt.slice(0, 200),
        prompt, outputType: 'spec', buildMode: 'quick',
      }).then(() => loadUserMemories(user?.id).then(setUserMemories))
    } catch (err) {
      handleApiError(err, {
        action: 'generate the spec',
        onRetry: () => runSpec(prompt, clarificationAnswers),
      })
    } finally {
      setIsTyping(false)
      setBuildingLabel(null)
    }
  }

  // ─── Guided/Docs path: full enterprise brief ──────────────────────────────
  async function runBrief(prompt, mode, clarAnswers) {
    const labels = ['Mapping the workflow...', 'Modeling the data...', 'Designing automation rules...', 'Building the brief...', 'Almost ready...']
    let idx = 0
    setBuildingLabel(labels[0])
    setIsTyping(true)
    const interval = setInterval(() => { idx = (idx + 1) % labels.length; setBuildingLabel(labels[idx]) }, 2200)

    try {
      const result = await generateBrief(prompt, convId, mode, clarAnswers, toHistoryMessages(messages), currentModel)
      clearInterval(interval)
      setIsTyping(false)
      setBuildingLabel(null)

      const briefId = Date.now().toString() + '_brief'
      pendingBriefMsgIdRef.current = briefId
      pendingSpecRef.current = result.brief?.appSpec || null
      pendingPromptRef.current = prompt
      pendingClarAnswersRef.current = clarAnswers

      const briefMsg = {
        id: briefId, role: 'assistant', content: '', message_type: 'enterprise_brief',
        metadata: { brief: result.brief, buildMode: mode, artifactIds: result.artifactIds, clarificationAnswers: clarAnswers },
      }
      setMessages(prev => [...prev, briefMsg])
      logAction('brief.generated', { conversationId: convId, buildMode: mode })
      await persistCardMessages([briefMsg])
      // Save cross-conversation memory
      saveConversationMemory(convId, {
        summary: result.brief?.executiveSummary || result.brief?.overview || result.brief?.appSpec?.slice(0, 300) || prompt.slice(0, 200),
        prompt, outputType: 'brief', buildMode: mode,
      }).then(() => loadUserMemories(user?.id).then(setUserMemories))
      // Refresh artifacts from server
      if (convId) loadArtifacts(convId)
    } catch (err) {
      handleApiError(err, {
        action: 'generate the brief',
        onRetry: () => runBrief(prompt, mode, clarAnswers),
      })
    } finally {
      clearInterval(interval)
      setIsTyping(false)
      setBuildingLabel(null)
    }
  }

  // ─── PHASE 1: Analyze prompt → classify engine and show EngineIntakeCard ──────
  async function runAnalyzeAndQuestion(prompt, engineHint = null) {
    // If engine already known from home screen, skip classification entirely
    if (engineHint) {
      pendingEngineRef.current = engineHint
      pendingPromptRef.current = prompt
      setIsTyping(false)
      setBuildingLabel(null)
      await runEngineQuestions(prompt, engineHint, null)
      return
    }

    setIsTyping(true)
    setBuildingLabel('Analyzing your request...')
    try {
      const result = await analyzeAndQuestion(prompt, convId, toHistoryMessages(messages), currentModel, userMemories)
      setIsTyping(false)
      setBuildingLabel(null)

      pendingPromptRef.current = prompt

      const newMsgs = []

      if (result.type === 'engine_intake') {
        if (result.greeting) {
          newMsgs.push({
            id: Date.now().toString() + '_greet', role: 'assistant',
            content: result.greeting, message_type: 'text', metadata: {},
          })
        }
        const intakeId = (Date.now() + 1).toString() + '_ei'
        pendingEngineIntakeMsgId.current = intakeId
        pendingEngineRef.current = result.engine
        newMsgs.push({
          id: intakeId, role: 'assistant', content: '', message_type: 'engine_intake',
          metadata: { engine: result.engine, engineFocus: result.engineFocus, confirmed: false },
        })
      } else if (result.type === 'build_mode') {
        // Legacy fallback — server returned old format
        if (result.greeting) {
          newMsgs.push({
            id: Date.now().toString() + '_greet', role: 'assistant',
            content: result.greeting, message_type: 'text', metadata: {},
          })
        }
        const modeId = (Date.now() + 1).toString() + '_bm'
        pendingBuildModeMsgId.current = modeId
        newMsgs.push({
          id: modeId, role: 'assistant', content: '', message_type: 'build_mode',
          metadata: { recommendedMode: result.recommendedMode, complexityReason: result.complexityReason },
        })
      } else {
        // Fallback: if server still returns clarification_v2 directly
        if (result.intro) {
          const introId = Date.now().toString() + '_intro'
          newMsgs.push({ id: introId, role: 'assistant', content: result.intro, message_type: 'text', metadata: {} })
        }
        if (result.type === 'clarification_v2' && result.questions?.length > 0) {
          const clarId = Date.now().toString() + '_cv2'
          pendingClarV2MsgIdRef.current = clarId
          newMsgs.push({
            id: clarId, role: 'assistant', content: '', message_type: 'clarification_v2',
            metadata: { questions: result.questions, outputType: result.outputType, buildMode: result.buildMode },
          })
        }
      }

      setMessages(prev => [...prev, ...newMsgs])
      await persistCardMessages(newMsgs)
    } catch (err) {
      handleApiError(err, {
        action: 'analyze your request',
        onRetry: () => runAnalyzeAndQuestion(prompt),
      })
    } finally {
      setIsTyping(false)
      setBuildingLabel(null)
    }
  }

  // ─── User picks a build mode → get questions for that mode ──────────────────
  async function handleBuildModeSelect(mode) {
    const prompt = pendingPromptRef.current
    if (!prompt) return

    // Mark the build_mode card as answered
    if (pendingBuildModeMsgId.current) {
      const bmId = pendingBuildModeMsgId.current
      pendingBuildModeMsgId.current = null
      setMessages(prev => prev.map(m =>
        m.id === bmId ? { ...m, metadata: { ...m.metadata, selectedMode: mode }, onModeSelect: null } : m
      ))
    }
    logAction('build_mode.selected', { mode, conversationId: convId })

    // Role → show RolePackageCard first
    if (['operations', 'it_admin', 'compliance', 'finance', 'hr'].includes(mode)) {
      setIsTyping(true)
      setBuildingLabel('Preparing role package...')
      try {
        const result = await getRolePackageOrQuestions(prompt, convId, mode, null, toHistoryMessages(messages), currentModel)
        setIsTyping(false)
        setBuildingLabel(null)
        const roleId = Date.now().toString() + '_role'
        pendingRoleMsgId.current = roleId
        pendingRoleRef.current = mode
        const roleMsg = {
          id: roleId, role: 'assistant', content: '', message_type: 'role_package',
          metadata: { intro: result.intro, role: mode },
        }
        setMessages(prev => [...prev, roleMsg])
        await persistCardMessages([roleMsg])
      } catch (err) {
        handleApiError(err, { action: 'prepare role package', onRetry: () => handleBuildModeSelect(mode) })
      } finally {
        setIsTyping(false)
        setBuildingLabel(null)
      }
      return
    }

    // PM Package → show PMPackageCard first
    if (mode === 'product_manager') {
      setIsTyping(true)
      setBuildingLabel('Preparing PM package...')
      try {
        const result = await getPMPackageOrQuestions(prompt, convId, null, toHistoryMessages(messages), currentModel)
        setIsTyping(false)
        setBuildingLabel(null)
        const pmId = Date.now().toString() + '_pm'
        pendingPMPackageMsgId.current = pmId
        const pmMsg = {
          id: pmId, role: 'assistant', content: '', message_type: 'pm_package',
          metadata: { intro: result.intro },
        }
        setMessages(prev => [...prev, pmMsg])
        await persistCardMessages([pmMsg])
      } catch (err) {
        handleApiError(err, { action: 'prepare PM package', onRetry: () => handleBuildModeSelect(mode) })
      } finally {
        setIsTyping(false)
        setBuildingLabel(null)
      }
      return
    }

    // Quick / Guided / Docs → get clarification questions
    setIsTyping(true)
    setBuildingLabel('Preparing questions...')
    try {
      const result = await getModeQuestions(prompt, convId, mode, toHistoryMessages(messages), currentModel)
      setIsTyping(false)
      setBuildingLabel(null)

      const newMsgs = []
      if (result.intro) {
        newMsgs.push({ id: Date.now().toString() + '_qi', role: 'assistant', content: result.intro, message_type: 'text', metadata: {} })
      }

      const clarId = Date.now().toString() + '_cv2'
      pendingClarV2MsgIdRef.current = clarId
      newMsgs.push({
        id: clarId, role: 'assistant', content: '', message_type: 'clarification_v2',
        metadata: { questions: result.questions, buildMode: mode, outputType: mode === 'quick' ? 'spec' : 'brief' },
      })

      setMessages(prev => [...prev, ...newMsgs])
      await persistCardMessages(newMsgs)
    } catch (err) {
      handleApiError(err, { action: 'prepare questions', onRetry: () => handleBuildModeSelect(mode) })
    } finally {
      setIsTyping(false)
      setBuildingLabel(null)
    }
  }

  // ─── User picks a PM package (lean/enterprise/full_lifecycle) ───────────────
  async function handlePMPackageSelect(pmPackage) {
    const prompt = pendingPromptRef.current
    if (!prompt) return

    if (pendingPMPackageMsgId.current) {
      const pmId = pendingPMPackageMsgId.current
      pendingPMPackageMsgId.current = null
      setMessages(prev => prev.map(m =>
        m.id === pmId ? { ...m, metadata: { ...m.metadata, selectedPackage: pmPackage }, onPMPackageSelect: null } : m
      ))
    }
    logAction('pm_package.selected', { pmPackage, conversationId: convId })

    pendingPMPackageRef.current = pmPackage
    setIsTyping(true)
    setBuildingLabel('Preparing PM questions...')
    try {
      const result = await getPMPackageOrQuestions(prompt, convId, pmPackage, toHistoryMessages(messages), currentModel)
      setIsTyping(false)
      setBuildingLabel(null)

      const newMsgs = []
      if (result.intro) {
        newMsgs.push({ id: Date.now().toString() + '_pmi', role: 'assistant', content: result.intro, message_type: 'text', metadata: {} })
      }

      const clarId = Date.now().toString() + '_cv2'
      pendingClarV2MsgIdRef.current = clarId
      newMsgs.push({
        id: clarId, role: 'assistant', content: '', message_type: 'clarification_v2',
        metadata: { questions: result.questions, buildMode: 'product_manager', outputType: 'pm_brief', pmPackage },
      })

      setMessages(prev => [...prev, ...newMsgs])
      await persistCardMessages(newMsgs)
    } catch (err) {
      handleApiError(err, { action: 'prepare PM questions', onRetry: () => handlePMPackageSelect(pmPackage) })
    } finally {
      setIsTyping(false)
      setBuildingLabel(null)
    }
  }

  // ─── User picks a role → get role-specific questions ────────────────────────
  async function handleRoleSelect(role) {
    const prompt = pendingPromptRef.current
    if (!prompt) return

    if (pendingRoleMsgId.current) {
      const rId = pendingRoleMsgId.current
      pendingRoleMsgId.current = null
      setMessages(prev => prev.map(m =>
        m.id === rId ? { ...m, metadata: { ...m.metadata, selectedRole: role }, onRoleSelect: null } : m
      ))
    }
    logAction('role.selected', { role, conversationId: convId })

    pendingRoleRef.current = role
    setIsTyping(true)
    setBuildingLabel('Preparing role questions...')
    try {
      const result = await getRolePackageOrQuestions(prompt, convId, role, 'guided', toHistoryMessages(messages), currentModel)
      setIsTyping(false)
      setBuildingLabel(null)

      const newMsgs = []
      if (result.intro) {
        newMsgs.push({ id: Date.now().toString() + '_ri', role: 'assistant', content: result.intro, message_type: 'text', metadata: {} })
      }

      const clarId = Date.now().toString() + '_cv2'
      pendingClarV2MsgIdRef.current = clarId
      newMsgs.push({
        id: clarId, role: 'assistant', content: '', message_type: 'clarification_v2',
        metadata: { questions: result.questions, buildMode: role, outputType: 'role_brief', rolePackage: 'guided' },
      })

      setMessages(prev => [...prev, ...newMsgs])
      await persistCardMessages(newMsgs)
    } catch (err) {
      handleApiError(err, { action: 'prepare role questions', onRetry: () => handleRoleSelect(role) })
    } finally {
      setIsTyping(false)
      setBuildingLabel(null)
    }
  }

  // ─── PM: generate full brief after clarification ─────────────────────────
  async function runPMBrief(prompt, pmPackage, clarAnswers) {
    const labels = [
      'Mapping the problem space...',
      'Writing the PRD...',
      'Building user stories...',
      'Drafting the business case...',
      'Modeling data and workflows...',
      'Finalizing document stack...',
      'Almost ready...',
    ]
    let idx = 0
    setBuildingLabel(labels[0])
    setIsTyping(true)
    const interval = setInterval(() => { idx = (idx + 1) % labels.length; setBuildingLabel(labels[idx]) }, 2400)

    try {
      const result = await generatePMBrief(prompt, convId, pmPackage, clarAnswers, toHistoryMessages(messages), currentModel)
      clearInterval(interval)
      setIsTyping(false)
      setBuildingLabel(null)

      const briefId = Date.now().toString() + '_pm_brief'
      pendingBriefMsgIdRef.current = briefId
      pendingSpecRef.current = result.brief?.appSpec || null
      pendingPromptRef.current = prompt
      pendingClarAnswersRef.current = clarAnswers

      const briefMsg = {
        id: briefId, role: 'assistant', content: '', message_type: 'enterprise_brief',
        metadata: { brief: result.brief, buildMode: 'product_manager', pmPackage: result.pmPackage, artifactIds: result.artifactIds },
      }
      setMessages(prev => [...prev, briefMsg])
      logAction('pm_brief.generated', { conversationId: convId, pmPackage })
      await persistCardMessages([briefMsg])
      if (convId) loadArtifacts(convId)
    } catch (err) {
      handleApiError(err, {
        action: 'generate the PM brief',
        onRetry: () => runPMBrief(prompt, pmPackage, clarAnswers),
      })
    } finally {
      clearInterval(interval)
      setIsTyping(false)
      setBuildingLabel(null)
    }
  }

  // ─── Role: generate full brief after clarification ───────────────────────
  async function runRoleBrief(prompt, role, rolePackage, clarAnswers) {
    const roleLabels = {
      operations: ['Mapping the current process...', 'Designing automation rules...', 'Building escalation matrix...', 'Generating SOPs...', 'Finalizing integration specs...'],
      it_admin: ['Analyzing system architecture...', 'Building permissions matrix...', 'Designing provisioning workflow...', 'Writing deployment runbook...', 'Finalizing admin console spec...'],
      compliance: ['Mapping controls framework...', 'Building risk matrix...', 'Designing evidence workflows...', 'Writing audit trail spec...', 'Finalizing reporting structure...'],
      finance: ['Mapping approval matrix...', 'Defining threshold rules...', 'Designing financial controls...', 'Building reporting spec...', 'Finalizing ERP integration...'],
      hr: ['Mapping employee journey...', 'Documenting policies...', 'Building approval workflows...', 'Designing notification plan...', 'Finalizing HRIS integration...'],
    }
    const labels = roleLabels[role] || ['Generating role brief...', 'Almost ready...']
    let idx = 0
    setBuildingLabel(labels[0])
    setIsTyping(true)
    const interval = setInterval(() => { idx = (idx + 1) % labels.length; setBuildingLabel(labels[idx]) }, 2400)

    try {
      const result = await generateRoleBrief(prompt, convId, role, rolePackage, clarAnswers, toHistoryMessages(messages), currentModel)
      clearInterval(interval)
      setIsTyping(false)
      setBuildingLabel(null)

      const briefId = Date.now().toString() + '_role_brief'
      pendingBriefMsgIdRef.current = briefId
      pendingSpecRef.current = result.brief?.appSpec || null
      pendingPromptRef.current = prompt
      pendingClarAnswersRef.current = clarAnswers

      const briefMsg = {
        id: briefId, role: 'assistant', content: '', message_type: 'enterprise_brief',
        metadata: { brief: result.brief, buildMode: role, rolePackage: result.rolePackage, artifactIds: result.artifactIds || {} },
      }
      setMessages(prev => [...prev, briefMsg])
      logAction('role_brief.generated', { conversationId: convId, role })
      await persistCardMessages([briefMsg])
      if (convId) loadArtifacts(convId)
    } catch (err) {
      handleApiError(err, {
        action: 'generate the role brief',
        onRetry: () => runRoleBrief(prompt, role, rolePackage, clarAnswers),
      })
    } finally {
      clearInterval(interval)
      setIsTyping(false)
      setBuildingLabel(null)
    }
  }

  // ─── Task Mode: generate task-mode brief after clarification ─────────────
  async function runTaskBrief(prompt, mode, clarAnswers) {
    const taskLabels = {
      fullstack:  ['Designing data model...', 'Mapping API contracts...', 'Specifying auth model...', 'Drafting integration spec...', 'Finalizing app spec...'],
      automation: ['Cataloging triggers...', 'Mapping condition logic...', 'Sequencing action chain...', 'Designing error handling...', 'Building notification plan...'],
      dashboard:  ['Defining KPIs...', 'Mapping data sources...', 'Planning refresh cadence...', 'Designing drill-down paths...', 'Setting access permissions...'],
      knowledge:  ['Modeling content taxonomy...', 'Designing versioning...', 'Building search spec...', 'Defining access control...', 'Drafting review workflow...'],
      workflow:   ['Mapping approval chain...', 'Setting SLAs...', 'Designing escalation rules...', 'Building decision logic...', 'Finalizing workflow map...'],
    }
    const labels = taskLabels[mode] || ['Generating brief...', 'Almost ready...']
    let idx = 0
    setBuildingLabel(labels[0])
    setIsTyping(true)
    const interval = setInterval(() => { idx = (idx + 1) % labels.length; setBuildingLabel(labels[idx]) }, 2200)

    try {
      const result = await generateTaskBrief(prompt, convId, mode, clarAnswers, toHistoryMessages(messages), currentModel)
      clearInterval(interval)
      setIsTyping(false)
      setBuildingLabel(null)

      const briefId = Date.now().toString() + '_task_brief'
      pendingBriefMsgIdRef.current = briefId
      pendingSpecRef.current = result.brief?.appSpec || null
      pendingPromptRef.current = prompt
      pendingClarAnswersRef.current = clarAnswers

      const briefMsg = {
        id: briefId, role: 'assistant', content: '', message_type: 'enterprise_brief',
        metadata: { brief: result.brief, buildMode: mode, artifactIds: result.artifactIds || {}, taskMode: mode },
      }
      setMessages(prev => [...prev, briefMsg])
      await persistCardMessages([briefMsg])
      if (convId) loadArtifacts(convId)
    } catch (err) {
      handleApiError(err, {
        action: 'generate the task brief',
        onRetry: () => runTaskBrief(prompt, mode, clarAnswers),
      })
    } finally {
      clearInterval(interval)
      setIsTyping(false)
      setBuildingLabel(null)
    }
  }

  // ─── Engine: run questions for a given engine (and optional docType) ─────────
  async function runEngineQuestions(prompt, engine, docType) {
    if (!prompt) return
    setIsTyping(true)
    setBuildingLabel('Preparing questions...')
    try {
      const result = await getEngineQuestions(prompt, convId, engine, docType, toHistoryMessages(messages), currentModel)
      setIsTyping(false)
      setBuildingLabel(null)

      const newMsgs = []

      if (result.type === 'doc_type_picker') {
        // Docs engine: show doc type picker first
        const dtId = Date.now().toString() + '_dt'
        pendingDocTypeMsgId.current = dtId
        newMsgs.push({
          id: dtId, role: 'assistant', content: '', message_type: 'doc_type_picker',
          metadata: { engine: 'docs' },
        })
      } else if (result.type === 'engine_questions') {
        if (result.intro) {
          newMsgs.push({
            id: Date.now().toString() + '_intro', role: 'assistant',
            content: result.intro, message_type: 'text', metadata: {},
          })
        }
        const clarId = (Date.now() + 1).toString() + '_cv2'
        pendingClarV2MsgIdRef.current = clarId
        newMsgs.push({
          id: clarId, role: 'assistant', content: '', message_type: 'clarification_v2',
          metadata: {
            questions: result.questions,
            outputType: result.outputType,
            engine: result.engine,
            docType: result.docType || null,
          },
        })
      }

      setMessages(prev => [...prev, ...newMsgs])
      await persistCardMessages(newMsgs)
    } catch (err) {
      handleApiError(err, { action: 'prepare questions', onRetry: () => runEngineQuestions(prompt, engine, docType) })
    } finally {
      setIsTyping(false)
      setBuildingLabel(null)
    }
  }

  // ─── User confirms the engine (clicks "Start with X Engine") ─────────────────
  async function handleEngineConfirm(engine) {
    pendingEngineRef.current = engine
    logAction('engine.confirmed', { engine, conversationId: convId })
    // Mark intake card as confirmed
    if (pendingEngineIntakeMsgId.current) {
      const intakeId = pendingEngineIntakeMsgId.current
      setMessages(prev => prev.map(m =>
        m.id === intakeId ? { ...m, metadata: { ...m.metadata, confirmed: true } } : m
      ))
    }
    await runEngineQuestions(pendingPromptRef.current, engine, null)
  }

  // ─── User selects doc type (docs engine only) ─────────────────────────────────
  async function handleDocTypeSelect(docType) {
    pendingDocTypeRef.current = docType
    logAction('docs_engine.type_selected', { docType, conversationId: convId })
    // Mark doc type card as selected
    if (pendingDocTypeMsgId.current) {
      const dtId = pendingDocTypeMsgId.current
      setMessages(prev => prev.map(m =>
        m.id === dtId ? { ...m, metadata: { ...m.metadata, selectedDocType: docType } } : m
      ))
    }
    await runEngineQuestions(pendingPromptRef.current, 'docs', docType)
  }

  // ─── Quick clarification answered ─────────────────────────────────────────
  async function handleClarification(answers) {
    const originalPrompt = pendingPromptRef.current
    if (!originalPrompt) return
    pendingClarMsgIdRef.current = null
    await runSpec(originalPrompt, answers)
  }

  // ─── Restart from clarification ───────────────────────────────────────────
  function handleRestartFromClarification() {
    setMessages(prev => {
      const clarIdx = prev.findIndex(m =>
        m.id === pendingClarMsgIdRef.current || m.id === pendingClarV2MsgIdRef.current
      )
      if (clarIdx === -1) return prev
      return prev.slice(0, clarIdx + 1)
    })
    pendingSpecRef.current = null
    pendingSpecMsgIdRef.current = null
    pendingBriefMsgIdRef.current = null
    pendingClarAnswersRef.current = null
  }

  // ─── Clarification answered → route based on metadata ──────────────────────
  async function handleClarificationV2(answers, cardMetadata = {}) {
    const originalPrompt = pendingPromptRef.current
    if (!originalPrompt) return
    pendingClarV2MsgIdRef.current = null
    pendingClarAnswersRef.current = answers

    const outputType = cardMetadata?.outputType || 'brief'
    const buildMode = cardMetadata?.buildMode || 'general'
    const engine = cardMetadata?.engine || pendingEngineRef.current || null
    const pmPackage = cardMetadata?.pmPackage || pendingPMPackageRef.current || 'lean'
    const rolePackage = cardMetadata?.rolePackage || 'guided'
    logAction('clarification.answered', { outputType, buildMode, engine, conversationId: convId })

    // Engine-specific routing
    if (engine === 'software' || outputType === 'software_spec' || outputType === 'analytics_spec') {
      await runSpec(originalPrompt, answers)
      return
    }

    if (engine === 'docs' || outputType === 'doc_brief') {
      await runBrief(originalPrompt, 'docs', answers)
      return
    }

    if (engine === 'automation' || outputType === 'automation_brief') {
      await runBrief(originalPrompt, 'operations', answers)
      return
    }

    if (engine === 'analytics') {
      await runSpec(originalPrompt, answers)
      return
    }

    // Legacy routing
    if (outputType === 'spec') {
      await runSpec(originalPrompt, answers)
      return
    }

    if (outputType === 'pm_brief') {
      await runPMBrief(originalPrompt, pmPackage, answers)
      return
    }

    if (outputType === 'role_brief') {
      await runRoleBrief(originalPrompt, buildMode, rolePackage, answers)
      return
    }

    await runBrief(originalPrompt, buildMode || 'guided', answers)
  }

  // ─── Edit existing app ─────────────────────────────────────────────────────
  async function runEdit(editRequest) {
    setIsTyping(true)
    setBuildingLabel('Updating your app...')
    try {
      const result = await editApp(currentApp.id, editRequest, convId, currentModel)
      setIsTyping(false)
      setBuildingLabel(null)
      const { data: freshMsgs } = await supabase.from('messages').select('*').eq('conversation_id', convId).order('created_at')
      setMessages(prev => {
        const existingIds = new Set(prev.map(m => m.id))
        const newMsgs = (freshMsgs || []).filter(m => !existingIds.has(m.id))
        return [...prev, ...newMsgs]
      })
    } catch (err) {
      handleApiError(err, {
        action: 'update your app',
        onRetry: () => runEdit(editRequest),
      })
    } finally {
      setIsTyping(false)
      setBuildingLabel(null)
    }
  }

  // ─── Persist assistant card messages so they survive refresh ──────────────
  // In mock mode: frontend saves to localStorage (backend saves to real Supabase which frontend can't read)
  // In real mode: backend already saved; do a fresh DB fetch to sync real IDs into local state
  async function persistCardMessages(newMsgs) {
    // Save card messages to DB with their local IDs so they survive refresh
    // (both MOCK and real mode — avoids fetch-and-merge that causes duplication)
    for (const m of newMsgs) {
      await supabase.from('messages').insert({
        id: m.id,
        conversation_id: convId,
        role: m.role || 'assistant',
        content: m.content || '',
        message_type: m.message_type || 'text',
        metadata: m.metadata || {},
      })
    }
  }

  // ─── Main submit handler ───────────────────────────────────────────────────
  async function handleSubmit(prompt) {
    if (!convId || !user) return

    const userMsg = { id: Date.now().toString(), role: 'user', content: prompt, message_type: 'text', metadata: {} }
    setMessages(prev => [...prev, userMsg])
    await supabase.from('messages').insert({ conversation_id: convId, role: 'user', content: prompt, message_type: 'text' })
    logAction('chat.message_sent', { conversationId: convId, promptLength: prompt.length })

    if (currentApp) {
      await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', convId)
      await runEdit(prompt)
      return
    }

    // Detect continuation intent — short affirmative follow-ups when there's
    // already an active pending state. Respond contextually instead of re-analyzing.
    const isContinuation = isFollowUpIntent(prompt) && (
      pendingBuildModeMsgId.current ||
      pendingClarV2MsgIdRef.current ||
      pendingClarMsgIdRef.current ||
      pendingBriefMsgIdRef.current ||
      pendingSpecMsgIdRef.current
    )

    if (isContinuation) {
      addMsg("Take a look at the options above — select whichever fits best and I'll move forward from there.")
      await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', convId)
      return
    }

    // Document request router — "generate a PRD", "create an SOP", "make a finance
    // breakdown" etc. route to the corporate document generator, NOT the app builder.
    // PARKED while DIRECT_BUILD_MODE is on (docs come back later).
    if (!DIRECT_BUILD_MODE && looksLikeDocumentRequest(prompt) && !pendingEngineRef.current) {
      await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', convId)
      await handleRequestDocument(prompt)
      return
    }

    // If the message looks like a question or conversational message (not a build
    // request), respond naturally instead of routing to the build engine.
    const hasActiveBuild = pendingBuildModeMsgId.current ||
      pendingClarV2MsgIdRef.current ||
      pendingClarMsgIdRef.current ||
      pendingBriefMsgIdRef.current ||
      pendingSpecMsgIdRef.current ||
      pendingEngineIntakeMsgId.current
    // Only divert to a plain chat reply for genuine questions — and only when there's
    // an active build to discuss, OR the message is an explicit question. Never hijack
    // build/continue requests (they must reach the intake → brief → documents pipeline).
    const isExplicitQuestion = prompt.includes('?')
    if (looksConversational(prompt) && (hasActiveBuild || isExplicitQuestion) && !pendingEngineRef.current) {
      await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', convId)
      await runConversationalResponse(prompt)
      return
    }

    await supabase.from('conversations').update({ updated_at: new Date().toISOString(), title: prompt.slice(0, 60) }).eq('id', convId)
    setCurrentConv(prev => prev ? { ...prev, title: prompt.slice(0, 60) } : prev)
    loadConversations()

    // DIRECT BUILD: skip the guided intake/brief pipeline and generate the app now.
    if (DIRECT_BUILD_MODE) {
      pendingEngineRef.current = null
      pendingPromptRef.current = prompt
      await handleGenerateApp()
      return
    }

    const engineHint = pendingEngineRef.current
    pendingEngineRef.current = null
    await runAnalyzeAndQuestion(prompt, engineHint)
  }

  // Apply a per-chat role override. Writes to the conversation row and
  // refreshes the active role context used by the API client.
  async function handleRoleOverride(updates) {
    if (!convId) return
    const { data, error } = await supabase
      .from('conversations').update(updates).eq('id', convId).select().single()
    if (error || !data) return
    setCurrentConv(data)
    setActiveRoleContext({
      role: data.role_context || null,
      customRole: data.custom_role_context || null,
      seniority: data.seniority_context || null,
      intendedUseCases: data.intended_use_cases || [],
      overridden: !!data.role_overridden,
    })
  }

  // Build a role context snapshot from the current profile. This snapshot is
  // FROZEN onto each conversation at creation time so existing chats keep
  // their role even if the user later changes their profile.
  function buildRoleContextFromProfile() {
    if (!profile) return {}
    return {
      role_context: profile.selected_role || null,
      custom_role_context: profile.custom_role || null,
      seniority_context: profile.seniority_level || null,
      intended_use_cases: profile.intended_use_cases || profile.use_cases || [],
      role_overridden: false,
    }
  }

  // ─── Home screen: start a new conversation from a suggestion ────────────────
  async function handleStartFromHome(promptText, engine = null) {
    if (!user) return
    logAction('home.suggestion_started', { promptLength: promptText.length, engine })
    const { data, error } = await supabase
      .from('conversations')
      .insert({
        user_id: user.id,
        title: promptText.slice(0, 60),
        ...buildRoleContextFromProfile(),
      })
      .select().single()
    if (error || !data) return
    loadConversations()
    // Navigate first, then submit after navigation renders the new convId
    navigate(`/workspace/${data.id}`, { state: { pendingPrompt: promptText, pendingEngine: engine } })
  }

  // Detect short follow-up / continuation messages that don't need re-analysis
  function isFollowUpIntent(text) {
    const t = text.trim().toLowerCase().replace(/[^a-z0-9 ]/g, '')
    const CONTINUATIONS = ['continue', 'yes', 'go', 'go ahead', 'ok', 'okay', 'sure', 'proceed',
      'next', 'do it', 'sounds good', 'looks good', 'perfect', 'great', 'yep', 'yup', 'correct',
      'that works', 'thats right', 'that is right', 'let s go', 'lets go', 'ready', 'start']
    return CONTINUATIONS.includes(t) || t.length < 12 && CONTINUATIONS.some(c => t.startsWith(c))
  }

  // Returns true when the message is a question, status check, or casual message —
  // NOT a new build request. Routes these to a plain chat response instead of the
  // build engine so Aria stays responsive even after a build stalls.
  function looksConversational(text) {
    const t = text.trim().toLowerCase()
    // Explicit question mark = question
    if (t.includes('?')) return true
    // Common question starters
    const questionStarters = [
      'what', 'why', 'how', 'when', 'where', 'who', 'which', 'is ', 'are ', 'was ',
      'were ', 'can ', 'could ', 'do ', 'does ', 'did ', 'will ', 'would ', 'should ',
      "isn't", "aren't", "doesn't", "don't", "won't", "why isn't", "why aren't",
      "i don't see", "i don't understand", "i'm confused", "nothing is", "nothing's",
      "i'm not seeing", 'not seeing', 'not working', 'not generating', "what's going on",
      'whats going on', "what happened", 'what is happening', 'seems like', 'it seems',
      'any update', 'still waiting', 'hello', 'hey', 'hi ', 'thanks', 'thank you',
    ]
    if (questionStarters.some(s => t.startsWith(s) || t.includes(' ' + s))) return true
    // Definitely build requests — never route these to chat
    const buildVerbs = [
      'build', 'create', 'make', 'generate', 'automate', 'design', 'develop',
      'write', 'draft', 'set up', 'setup', 'add', 'implement', 'integrate',
      'track', 'monitor', 'report', 'dashboard', 'app', 'tool', 'system',
    ]
    if (buildVerbs.some(v => t.includes(v))) return false
    // Otherwise it's NOT conversational — let it reach the build/document pipeline.
    // (We no longer treat short ambiguous messages like "continue" as chatter, which
    // was wrongly diverting build/continue requests to the plain chat handler.)
    return false
  }

  // Detects a request for a specific corporate DOCUMENT (PRD, SOP, risk assessment,
  // finance breakdown, deck, etc.) vs. an app build. Anchored on document nouns so
  // "build me a leave tracker app" still goes to the app builder.
  function looksLikeDocumentRequest(text) {
    const t = ' ' + text.trim().toLowerCase().replace(/[^a-z0-9 /-]/g, ' ').replace(/\s+/g, ' ') + ' '
    // App-build override: if the user clearly wants a working app/tool built, route to
    // the app engine even if the prompt also lists document deliverables (PRD, data model…).
    const APP_BUILD_SIGNALS = [
      'full-stack', 'fullstack', 'full stack', 'working app', 'working internal', 'real working',
      'not a static prototype', 'static prototype', 'internal tool', 'internal app', 'build an app',
      'build a tool', 'build a system', 'build a full', 'build a working', 'crud', 'command center',
      'real app', 'functional app', 'build the app', 'generate the app', 'generate an app',
    ]
    if (APP_BUILD_SIGNALS.some(s => t.includes(s))) return false
    // A long message is a full build brief (which already produces ALL the artifacts —
    // intake summary, product brief, workflow map, data model, automation model, UX, app
    // spec + diagram). Only SHORT, focused messages are treated as single-document requests.
    if (text.trim().length > 240) return false
    // Explicit document-type keywords (mirror documentTemplates.js aliases).
    const DOC_KEYWORDS = [
      'prd', 'product requirements', 'feature scope', 'user stories', 'acceptance criteria',
      'technical spec', 'tech spec', 'technical specification', 'design doc', 'api spec',
      'api specification', 'api documentation', 'test plan', 'qa plan', 'uat plan', 'test strategy',
      'deployment plan', 'release plan', 'rollout plan', 'rollback plan', 'go-live plan',
      'sop', 'standard operating procedure', 'runbook', 'run book', 'process optimization',
      'process improvement', 'current state process', 'future state process', 'process map',
      'cost breakdown', 'finance breakdown', 'cost analysis', 'budget breakdown', 'spend breakdown',
      'roi', 'savings analysis', 'cost-benefit', 'cost benefit', 'payback', 'business value',
      'risk assessment', 'risk analysis', 'risk register', 'compliance checklist', 'legal review',
      'legal checklist', 'compliance audit', 'audit checklist', 'data privacy', 'privacy review',
      'project charter', 'program charter', 'charter', 'raci', 'responsibility matrix',
      'status report', 'progress report', 'business case', 'business justification', 'investment case',
      'executive summary deck', 'exec deck', 'executive deck', 'pitch deck', 'stakeholder deck',
      'slide deck', 'signoff', 'sign-off', 'sign off',
    ]
    if (DOC_KEYWORDS.some(k => t.includes(' ' + k + ' ') || t.includes(' ' + k + 's '))) return true
    // Generic: a document verb + a document noun (e.g. "create a compliance document").
    const docVerb = /\b(generate|create|make|draft|write|add|produce|prepare|put together)\b/.test(t)
    const docNoun = /\b(documents?|docs?|checklists?|matri(x|ces)|plans?|reports?|assessments?|specs?|charters?|decks?|summary|summaries|memos?|policy|policies|briefs?|registers?|sop|prd)\b/.test(t)
    // Don't hijack app builds: if it names an app/tool/system as the object, defer to the app flow
    // UNLESS an explicit document keyword was already matched above.
    if (docVerb && docNoun) return true
    return false
  }

  async function runConversationalResponse(prompt) {
    setIsTyping(true)
    try {
      const result = await sendChatMessage(prompt, toHistoryMessages(messages), currentModel)
      const response = result?.response || "I'm here — let me know what you'd like to do next."
      addMsg(response)
      await supabase.from('messages').insert({
        conversation_id: convId, role: 'assistant', content: response, message_type: 'text',
      })
    } catch (err) {
      handleApiError(err, { action: 'respond to your message', onRetry: () => runConversationalResponse(prompt) })
    } finally {
      setIsTyping(false)
    }
  }

  // ─── Utility ──────────────────────────────────────────────────────────────
  function addMsg(content, isError = false) {
    setMessages(prev => [...prev, {
      id: Date.now().toString() + '_msg',
      role: 'assistant', content,
      message_type: 'text', isError, metadata: {},
    }])
  }

  // ─── On-demand PM document request ────────────────────────────────────────
  async function handleRequestDocument(userRequest, templateSkeleton = null) {
    if (!convId || !userRequest?.trim()) return
    const projectContext = messages
      .filter(m => m.metadata?.brief)
      .slice(-1)[0]?.metadata?.brief || null

    setIsTyping(true)
    setBuildingLabel(`Generating document: "${userRequest.slice(0, 50)}${userRequest.length > 50 ? '…' : ''}"`)
    try {
      const result = await requestPMDocument(convId, userRequest, projectContext, currentModel, templateSkeleton)
      setIsTyping(false)
      setBuildingLabel(null)
      // Add a text message confirming creation
      addMsg(`✓ "${result.artifact.title}" has been added to your project assets.`)
      // Refresh artifacts
      if (convId) loadArtifacts(convId)
    } catch (err) {
      handleApiError(err, {
        action: 'generate the document',
        onRetry: () => handleRequestDocument(userRequest),
      })
    } finally {
      setIsTyping(false)
      setBuildingLabel(null)
    }
  }

  // ─── Upload a document template → Aria fills it for this project ────────────
  // Parses the uploaded .docx/.pdf/.md/.txt into a section skeleton, then runs
  // the document engine so the generated doc mirrors the user's exact structure.
  async function handleAttachTemplate(file) {
    if (!file || !convId) return
    setIsTyping(true)
    setBuildingLabel(`Reading your template: ${file.name}…`)
    try {
      const parsed = await uploadTemplate(file)
      if (!parsed?.skeleton?.length) {
        addMsg(`I couldn't find clear section headings in "${file.name}". Try a file whose sections use heading styles (.docx), # markers (.md), or clear title lines.`, true)
        return
      }
      addMsg(`✓ Loaded your "${parsed.label}" template (${parsed.sectionCount} sections). Filling it out for your project…`)
      await handleRequestDocument(`Fill out my "${parsed.label}" template for this project`, parsed.skeleton)
    } catch (err) {
      handleApiError(err, { action: 'read your template', onRetry: () => handleAttachTemplate(file) })
    } finally {
      setIsTyping(false)
      setBuildingLabel(null)
    }
  }

  // ─── Attach live handlers to messages ─────────────────────────────────────
  const messagesWithHandlers = messages.map(m => {
    const ct = m.metadata?.cardType || m.message_type
    if (ct === 'engine_intake') {
      const isActive = m.id === pendingEngineIntakeMsgId.current && !isTyping
      return { ...m, onEngineConfirm: isActive && !m.metadata?.confirmed ? handleEngineConfirm : null }
    }
    if (ct === 'doc_type_picker') {
      const isActive = m.id === pendingDocTypeMsgId.current && !isTyping
      return { ...m, onDocTypeSelect: isActive ? handleDocTypeSelect : null }
    }
    if (ct === 'build_mode') {
      const isActive = m.id === pendingBuildModeMsgId.current && !isTyping
      const hideRoleSpecific = !!(profile?.work_category && profile.work_category.length > 0)
      return { ...m, onModeSelect: isActive ? handleBuildModeSelect : null, defaultMode: defaultBuildMode, hideRoleSpecific }
    }
    if (ct === 'pm_package') {
      const isActive = m.id === pendingPMPackageMsgId.current && !isTyping
      return { ...m, onPMPackageSelect: isActive ? handlePMPackageSelect : null }
    }
    if (ct === 'role_package') {
      const isActive = m.id === pendingRoleMsgId.current && !isTyping
      return { ...m, onRoleSelect: isActive ? handleRoleSelect : null }
    }
    if (ct === 'clarification') {
      const isActive = m.id === pendingClarMsgIdRef.current && !isTyping
      return { ...m, onClarify: isActive ? handleClarification : null, onRestart: handleRestartFromClarification }
    }
    if (ct === 'clarification_v2') {
      const isActive = m.id === pendingClarV2MsgIdRef.current && !isTyping
      if (isActive) {
        return {
          ...m,
          onClarifyV2: (answers) => handleClarificationV2(answers, m.metadata),
          onRestart: handleRestartFromClarification,
        }
      }
      return { ...m, onClarifyV2: null, onRestart: handleRestartFromClarification }
    }
    if (ct === 'spec' && m.id === pendingSpecMsgIdRef.current && !isTyping) {
      return { ...m, onBuild: handleGenerateApp, onSpecChange: (updatedSpec) => { pendingSpecRef.current = updatedSpec } }
    }
    if (ct === 'enterprise_brief') {
      const handlers = { onOpenArtifact: openArtifact, artifacts, onRequestDocument: handleRequestDocument }
      if (m.id === pendingBriefMsgIdRef.current && !isTyping) handlers.onBuild = handleGenerateApp
      return { ...m, ...handlers }
    }
    return m
  })

  const activeArtifacts = artifacts.filter(a => a.status !== 'superseded')

  const sidebarProps = {
    user, conversations, apps, appProjects,
    onOpenProject: (proj) => {
      setShowNewApp(false)            // opening an app supersedes the New-app composer
      setCurrentProject(proj)
      autoFixedProjectRef.current = ''   // allow auto-fix to run for the reopened project
      if (isSmall) setShowSidebar(false)
    },
    onDeleteProject: handleDeleteProject,
    onProjectsChange: loadAppProjects,
    folders,
    onCreateFolder: handleCreateFolder,
    onRenameFolder: handleRenameFolder,
    onDeleteFolder: handleDeleteFolder,
    onMoveToFolder: handleMoveToFolder,
    onPinItem: handlePinItem,
    onNewApp: () => setShowNewApp(true),
    onConversationsChange: loadConversations, onAppsChange: loadApps,
    onConversationRename: (id, title) => {
      setConversations(prev => prev.map(c => c.id === id ? { ...c, title } : c))
      if (currentConv?.id === id) setCurrentConv(prev => prev ? { ...prev, title } : prev)
    },
    onAppRename: (id, title) => {
      setApps(prev => prev.map(a => a.id === id ? { ...a, title } : a))
      if (currentApp?.id === id) setCurrentApp(prev => prev ? { ...prev, title } : prev)
    },
    onClose: isSmall ? () => setShowSidebar(false) : undefined,
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#111111', overflow: 'hidden' }}>
      {showOnboarding && <OnboardingFlow onComplete={() => setShowOnboarding(false)} />}

      {/* Artifact Viewer modal */}
      {viewingArtifact && (
        <ArtifactViewer
          artifact={viewingArtifact}
          onClose={() => setViewingArtifact(null)}
          onUpdate={handleArtifactUpdate}
          onApprove={handleArtifactUpdate}
        />
      )}

      {/* Sidebar — always rendered on desktop, drawer on mobile/tablet */}
      {user && !isSmall && <Sidebar {...sidebarProps} />}
      {user && isSmall && showSidebar && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setShowSidebar(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 40 }}
          />
          <div style={{ position: 'fixed', left: 0, top: 0, bottom: 0, zIndex: 50, display: 'flex' }}>
            <Sidebar {...sidebarProps} />
          </div>
        </>
      )}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', minWidth: 0 }}>
        <Topbar
          conversation={currentConv} app={currentApp}
          appBuild={currentProject ? { title: currentProject.title, id: currentProject.id, renamable: !!currentProject.id } : showNewApp ? { title: 'New app' } : null}
          onAppBuildTitleChange={(t) => { if (currentProject?.id) handleRenameProject(currentProject.id, t) }}
          onTitleChange={(t) => {
            setCurrentConv(prev => prev ? { ...prev, title: t } : prev)
            setConversations(prev => prev.map(c => c.id === currentConv?.id ? { ...c, title: t } : c))
          }}
          onAppTitleChange={(t) => {
            setCurrentApp(prev => prev ? { ...prev, title: t } : prev)
            setApps(prev => prev.map(a => a.id === currentApp?.id ? { ...a, title: t } : a))
          }}
          artifactCount={activeArtifacts.length}
          onToggleArtifacts={() => setShowArtifactPanel(v => !v)}
          showArtifactPanel={showArtifactPanel}
          onMenuToggle={isSmall ? () => setShowSidebar(v => !v) : undefined}
          isMobile={isMobile}
          currentModel={currentModel}
          isRunning={isTyping}
          phaseLabel={buildingLabel}
          lastError={lastError}
          lastLatencyMs={lastLatencyMs}
        />
        {/* Only a "degradation" if the user actually picked Claude. When Groq or
            Ollama is the chosen model, falling back to Groq is the plan, not a
            problem — so suppress the banner entirely. Always dismissible. */}
        {modelStatus.degraded && currentModel === 'claude' && !bannerDismissed && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 16px', borderBottom: '0.5px solid #3A2A0A',
            background: '#1A1407', color: '#F5C451', fontSize: 12, lineHeight: 1.5,
          }}>
            <span style={{ fontSize: 14 }}>⚠</span>
            <span style={{ flex: 1 }}>
              {modelStatus.reason === 'credits'
                ? 'Aria is running in degraded mode — your Anthropic API account is out of credits, so output is falling back to a weaker model. Add credits at console.anthropic.com (separate from Claude Max) to restore full quality.'
                : modelStatus.reason === 'rate_limit'
                ? 'Aria is temporarily rate-limited by Anthropic and falling back to a weaker model. Quality will restore automatically shortly.'
                : 'Aria is running in degraded mode — Claude is unavailable and output is falling back to a weaker model.'}
            </span>
            <button
              onClick={() => setBannerDismissed(true)}
              title="Dismiss"
              style={{
                background: 'none', border: 'none', color: '#F5C451', cursor: 'pointer',
                fontSize: 16, lineHeight: 1, padding: '0 2px', opacity: 0.7,
              }}
            >×</button>
          </div>
        )}
        {convId && currentConv?.role_context && !currentProject && !showNewApp && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 16px', borderBottom: '0.5px solid #1A1A1A',
            background: '#0D0D0D',
          }}>
            <span style={{ fontSize: 10, color: '#8A8A8A', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 }}>Role</span>
            <RoleBadge conversation={currentConv} onOverride={handleRoleOverride} />
          </div>
        )}
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          {currentProject ? (
            /* App build surface — lives in the content column beside the sidebar,
               exactly like chat does (no fullscreen overlay covering the rail). */
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '10px 16px', borderBottom: '0.5px solid #1A1A1A' }}>
                {currentProject.id && (
                  <button
                    onClick={async () => { const id = currentProject.id; await handleDeleteProject(id) }}
                    disabled={editingApp || autoFixing}
                    style={{ background: '#1A0E0E', color: '#F87171', border: '0.5px solid #3A1A1A', borderRadius: 7, padding: '6px 14px', fontSize: 12, cursor: editingApp || autoFixing ? 'default' : 'pointer', fontFamily: 'inherit', opacity: editingApp || autoFixing ? 0.5 : 1 }}
                    title="Delete this app"
                  >Delete</button>
                )}
                <button
                  onClick={() => setCurrentProject(null)}
                  style={{ background: '#1C1C1C', color: '#E5E5E5', border: '0.5px solid #2A2A2A', borderRadius: 7, padding: '6px 14px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
                >Close ✕</button>
              </div>
              <div style={{ flex: 1, minHeight: 0 }}>
                <AppProjectPanel project={currentProject} onEdit={handleEditProject} editing={editingApp} onRuntimeError={handleAutoRepair} autoFixing={autoFixing} editProgress={editProgress} editLog={editLog} editElapsedMs={editElapsedMs} />
              </div>
            </div>
          ) : showNewApp ? (
            /* New-app surface — identical UI to the chat empty state (centered
               hint + bottom input bar). Only the mode tag (App build, in the
               Topbar) and the build workflow differ. */
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              {styleChoices ? (
                <StyleCarousel
                  styles={styleChoices}
                  prompt={pendingAppPrompt}
                  building={generatingApp}
                  onBuild={handleConfirmStyle}
                  onCancel={handleCancelStyles}
                />
              ) : loadingStyles ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#8A8A8A', fontSize: 13, gap: 12, minHeight: 0 }}>
                  <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#60A5FA', animation: 'pulse 1.4s ease-in-out infinite' }} />
                  <span>Designing 3 directions for your app…</span>
                  <span style={{ fontSize: 11, color: '#5A5A5A', maxWidth: 320, textAlign: 'center' }}>“{pendingAppPrompt.length > 80 ? pendingAppPrompt.slice(0, 80) + '…' : pendingAppPrompt}”</span>
                </div>
              ) : (
              <>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#2A2A2A', fontSize: 12, gap: 8, minHeight: 0 }}>
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                  <rect x="2" y="2" width="13" height="13" rx="2" fill="#2A2A2A" />
                  <rect x="17" y="2" width="13" height="13" rx="2" fill="#3A3A3A" />
                  <rect x="2" y="17" width="13" height="13" rx="2" fill="#222" />
                  <rect x="17" y="17" width="13" height="13" rx="2" fill="#303030" />
                </svg>
                <span>Describe an app to get started</span>
              </div>
              {generatingApp && (
                <div style={{ padding: '12px 16px', borderTop: '0.5px solid #1A1A1A', background: '#0B0B0B' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, color: '#FFFFFF', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#34D399', animation: 'pulse 1.4s ease-in-out infinite' }} />
                      {genProgress.message || 'Building your app…'}
                    </span>
                    <span style={{ fontSize: 13, color: '#FFFFFF', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{Math.min(100, Math.round(genProgress.percent || 0))}%</span>
                  </div>
                  <div style={{ height: 6, background: '#1C1C1C', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.max(2, Math.min(100, genProgress.percent))}%`, background: 'linear-gradient(90deg, #34D399, #60A5FA)', borderRadius: 999, transition: 'width 0.5s ease' }} />
                  </div>
                </div>
              )}
              <InputZone
                onSubmit={handleBuildNewApp}
                disabled={generatingApp || loadingStyles}
                currentModel={currentModel}
                onModelChange={setCurrentModel}
                placeholder="Describe the app you want to build. Aria will instantly build it."
                sendHint="Enter to build · Shift+Enter for new line"
              />
              </>
              )}
            </div>
          ) : convId ? (
            <>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <ChatArea messages={messagesWithHandlers} isTyping={isTyping && !generatingApp} buildingLabel={generatingApp ? null : buildingLabel} />
                {generatingApp && (() => {
                  // Compute ETA on the frontend from real elapsed time vs. % done.
                  // Works even if the backend doesn't send an estimate, and the
                  // 250ms tick keeps it live between pipeline events.
                  const elapsedSec = genElapsedMs / 1000
                  const pct = Math.round(genProgress.percent)
                  const etaSec = pct > 3 && pct < 100 ? Math.max(1, Math.round(elapsedSec * (100 - pct) / pct)) : null
                  const fmt = (s) => s >= 60 ? `${Math.floor(s / 60)}m ${Math.round(s % 60)}s` : `${Math.round(s)}s`
                  return (
                  <div style={{ padding: '12px 16px', borderTop: '0.5px solid #1A1A1A', background: '#0B0B0B' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 13, color: '#FFFFFF', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#34D399', animation: 'pulse 1.4s ease-in-out infinite' }} />
                        {genProgress.message || 'Generating your app…'}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <span style={{ fontSize: 12, color: '#C8C8C8', fontVariantNumeric: 'tabular-nums' }}>
                          {fmt(elapsedSec)} elapsed
                        </span>
                        {etaSec != null && (
                          <span style={{ fontSize: 12, color: '#34D399', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                            ~{fmt(etaSec)} left
                          </span>
                        )}
                        <span style={{ fontSize: 13, color: '#FFFFFF', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{pct}%</span>
                      </span>
                    </div>
                    <div style={{ height: 6, background: '#1C1C1C', borderRadius: 999, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.max(2, Math.min(100, genProgress.percent))}%`, background: 'linear-gradient(90deg, #34D399, #60A5FA)', borderRadius: 999, transition: 'width 0.5s ease' }} />
                    </div>
                  </div>
                  )
                })()}
                <InputZone onSubmit={handleSubmit} disabled={isTyping} currentModel={currentModel} onModelChange={setCurrentModel} onAttachTemplate={handleAttachTemplate} />
              </div>
              {showArtifactPanel && (
                isSmall ? (
                  /* On mobile/tablet: full-screen overlay */
                  <>
                    <div onClick={() => setShowArtifactPanel(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 40 }} />
                    <div style={{ position: 'fixed', right: 0, top: 0, bottom: 0, zIndex: 50, width: Math.min(320, window.innerWidth - 40) }}>
                      <ArtifactPanel
                        artifacts={activeArtifacts}
                        onOpen={openArtifact}
                        onClose={() => setShowArtifactPanel(false)}
                        onArtifactUpdate={handleArtifactUpdate}
                      />
                    </div>
                  </>
                ) : (
                  <ArtifactPanel
                    artifacts={activeArtifacts}
                    onOpen={openArtifact}
                    onClose={() => setShowArtifactPanel(false)}
                    onArtifactUpdate={handleArtifactUpdate}
                  />
                )
              )}
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <HomeScreen user={user} onStartConversation={handleStartFromHome} />
              <InputZone onSubmit={handleStartFromHome} disabled={isTyping} currentModel={currentModel} onModelChange={setCurrentModel} />
            </div>
          )}
        </div>
      </div>

    </div>
  )
}
