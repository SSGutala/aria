import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { supabase, MOCK_MODE } from '../lib/supabase'
import { analyzeAndQuestion, generateSpec, generateBrief, generatePMBrief, generateTaskBrief, generateRoleBrief, requestPMDocument, buildApp, editApp, getModeQuestions, getPMPackageOrQuestions, getRolePackageOrQuestions, getEngineQuestions, setActiveRoleContext } from '../lib/claude'
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

import Sidebar from '../components/Sidebar'
import Topbar from '../components/Topbar'
import ChatArea from '../components/ChatArea'
import InputZone from '../components/InputZone'
import OnboardingFlow from '../components/OnboardingFlow'
import HomeScreen from '../components/HomeScreen'
import EngineIntakeCard from '../components/EngineIntakeCard'
import DocsTypeCard from '../components/DocsTypeCard'
import RoleBadge from '../components/RoleBadge'

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
  const [messages, setMessages] = useState([])
  const [currentConv, setCurrentConv] = useState(null)
  const [currentApp, setCurrentApp] = useState(null)
  const [isTyping, setIsTyping] = useState(false)
  const [buildingLabel, setBuildingLabel] = useState(null)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [showSidebar, setShowSidebar] = useState(false)
  const [currentModel, setCurrentModel] = useState(import.meta.env.VITE_DEFAULT_AI_MODEL || 'groq')  // 'claude' | 'groq' | 'ollama'
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
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      if (localStorage.getItem('aria_new_user')) setShowOnboarding(true)
      if (user) {
        loadUserMemories(user.id).then(setUserMemories)
      }
    })
  }, [])

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

  const loadConversations = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('conversations').select('*').eq('user_id', user.id)
      .neq('deleted', true)
      .order('updated_at', { ascending: false })
    setConversations(data || [])
  }, [user])

  const loadApps = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('generated_apps').select('*').eq('user_id', user.id)
      .neq('deleted', true)
      .order('created_at', { ascending: false })
    setApps(data || [])
  }, [user])

  useEffect(() => {
    if (user) { loadConversations(); loadApps() }
  }, [user, loadConversations, loadApps])

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
      saveConversationMemory(convId, {
        summary: result.spec?.slice(0, 300) || prompt.slice(0, 200),
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

    await supabase.from('conversations').update({ updated_at: new Date().toISOString(), title: prompt.slice(0, 60) }).eq('id', convId)
    setCurrentConv(prev => prev ? { ...prev, title: prompt.slice(0, 60) } : prev)
    loadConversations()

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

  // ─── Utility ──────────────────────────────────────────────────────────────
  function addMsg(content, isError = false) {
    setMessages(prev => [...prev, {
      id: Date.now().toString() + '_msg',
      role: 'assistant', content,
      message_type: 'text', isError, metadata: {},
    }])
  }

  // ─── On-demand PM document request ────────────────────────────────────────
  async function handleRequestDocument(userRequest) {
    if (!convId || !userRequest?.trim()) return
    const projectContext = messages
      .filter(m => m.metadata?.brief)
      .slice(-1)[0]?.metadata?.brief || null

    setIsTyping(true)
    setBuildingLabel(`Generating ${userRequest}...`)
    try {
      const result = await requestPMDocument(convId, userRequest, projectContext)
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
      return { ...m, onBuild: handleBuildApp, onSpecChange: (updatedSpec) => { pendingSpecRef.current = updatedSpec } }
    }
    if (ct === 'enterprise_brief') {
      const handlers = { onOpenArtifact: openArtifact, artifacts, onRequestDocument: handleRequestDocument }
      if (m.id === pendingBriefMsgIdRef.current && !isTyping) handlers.onBuild = handleBuildApp
      return { ...m, ...handlers }
    }
    return m
  })

  const activeArtifacts = artifacts.filter(a => a.status !== 'superseded')

  const sidebarProps = {
    user, conversations, apps,
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
        {convId && currentConv?.role_context && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 16px', borderBottom: '0.5px solid #1A1A1A',
            background: '#0D0D0D',
          }}>
            <span style={{ fontSize: 10, color: '#525252', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Role</span>
            <RoleBadge conversation={currentConv} onOverride={handleRoleOverride} />
          </div>
        )}
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          {convId ? (
            <>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <ChatArea messages={messagesWithHandlers} isTyping={isTyping} buildingLabel={buildingLabel} />
                <InputZone onSubmit={handleSubmit} disabled={isTyping} currentModel={currentModel} onModelChange={setCurrentModel} />
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
