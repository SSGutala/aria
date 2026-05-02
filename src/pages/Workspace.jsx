import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase, MOCK_MODE } from '../lib/supabase'
import { analyzeBuildMode, getModeQuestions, generateSpec, generateBrief, buildApp, editApp } from '../lib/claude'
import ArtifactViewer from '../components/ArtifactViewer'
import ArtifactPanel from '../components/ArtifactPanel'
import { useBreakpoint } from '../hooks/useBreakpoint'

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

export default function Workspace() {
  const { convId } = useParams()
  const navigate = useNavigate()
  const { isMobile, isSmall } = useBreakpoint()

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

  // ─── Artifact system ──────────────────────────────────────────────────────────
  const [artifacts, setArtifacts] = useState([])
  const [viewingArtifact, setViewingArtifact] = useState(null)
  const [showArtifactPanel, setShowArtifactPanel] = useState(false)

  // ─── Pending state refs across the multi-stage flow ──────────────────────────
  const pendingPromptRef       = useRef(null)
  const pendingBuildModeRef    = useRef(null)   // 'quick' | 'guided' | 'docs'
  const pendingBuildModeMsgId  = useRef(null)
  const pendingClarMsgIdRef    = useRef(null)
  const pendingClarV2MsgIdRef  = useRef(null)
  const pendingSpecMsgIdRef    = useRef(null)
  const pendingSpecRef         = useRef(null)
  const pendingClarAnswersRef  = useRef(null)
  const pendingBriefMsgIdRef   = useRef(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      if (localStorage.getItem('aria_new_user')) setShowOnboarding(true)
    })
  }, [])

  const loadConversations = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('conversations').select('*').eq('user_id', user.id)
      .order('updated_at', { ascending: false })
    setConversations(data || [])
  }, [user])

  const loadApps = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('generated_apps').select('*').eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setApps(data || [])
  }, [user])

  useEffect(() => {
    if (user) { loadConversations(); loadApps() }
  }, [user, loadConversations, loadApps])

  useEffect(() => {
    if (!convId) return
    supabase.from('conversations').select('*').eq('id', convId).single()
      .then(({ data }) => setCurrentConv(data))
    supabase.from('messages').select('*').eq('conversation_id', convId).order('created_at')
      .then(({ data }) => {
        const msgs = data || []
        setMessages(msgs)
        // Restore pending refs so interactive handlers re-attach on refresh
        // Only restore if there are no later messages that would have consumed the card
        // (i.e. the card is still the "last actionable" item of its type)
        // cardType helper — DB stores 'confirmation'/'clarification' but real type is in metadata.cardType
        const ct = (m) => m.metadata?.cardType || m.message_type
        const lastOf = (type) => [...msgs].reverse().find(m => ct(m) === type)
        const hasAppCard = msgs.some(m => m.message_type === 'app_card')
        if (!hasAppCard) {
          const bm = lastOf('build_mode')
          if (bm && bm.metadata?.selectedMode == null) pendingBuildModeMsgId.current = bm.id
          const clarV2 = lastOf('clarification_v2')
          const clar = lastOf('clarification')
          // Only restore if no brief/spec came after it (meaning it hasn't been answered)
          const lastBrief = lastOf('enterprise_brief')
          const lastSpec = lastOf('spec')
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
          // Restore prompt from last user message
          const lastUser = [...msgs].reverse().find(m => m.role === 'user')
          if (lastUser) pendingPromptRef.current = lastUser.content
          // Restore build mode
          if (bm?.metadata?.selectedMode) pendingBuildModeRef.current = bm.metadata.selectedMode
        }
      })
    supabase.from('generated_apps').select('*').eq('conversation_id', convId).single()
      .then(({ data }) => setCurrentApp(data || null))
    // Load artifacts for this conversation
    loadArtifacts(convId)
    // Reset all pending state on conv change
    pendingPromptRef.current      = null
    pendingBuildModeRef.current   = null
    pendingBuildModeMsgId.current = null
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
      const result = await buildApp(prompt, convId, spec, clarAnswers)
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
      pendingSpecRef.current  = null
      pendingPromptRef.current = null
      loadApps()
      loadConversations()
    } catch (err) {
      clearInterval(labelInterval)
      setIsTyping(false)
      setBuildingLabel(null)

      const isRetryable = err.message && (
        err.message.includes('constraint') || err.message.includes('violates') ||
        err.message.includes('500') || err.message.includes('fetch')
      )
      if (isRetryable && !handleBuildApp._retried) {
        handleBuildApp._retried = true
        addMsg('Ran into a snag — retrying automatically...')
        setTimeout(() => { handleBuildApp._retried = false; handleBuildApp() }, 1500)
        return
      }
      handleBuildApp._retried = false
      addMsg(err.message || 'Build failed. Please try again.', true)

      if (pendingSpecRef.current) {
        const retryId = Date.now().toString() + '_spec_retry'
        pendingSpecMsgIdRef.current = retryId
        setMessages(prev => [...prev, { id: retryId, role: 'assistant', content: '', message_type: 'spec', metadata: { spec: pendingSpecRef.current } }])
      }
    }
  }

  // ─── Quick path: spec card ─────────────────────────────────────────────────
  async function runSpec(prompt, clarificationAnswers = null) {
    setBuildingLabel('Generating app spec...')
    setIsTyping(true)
    try {
      const result = await generateSpec(prompt, convId, clarificationAnswers, toHistoryMessages(messages))
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
    } catch (err) {
      setIsTyping(false)
      setBuildingLabel(null)
      addMsg(err.message || 'Failed to generate spec. Please try again.', true)
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
      const result = await generateBrief(prompt, convId, mode, clarAnswers, toHistoryMessages(messages))
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
        metadata: { brief: result.brief, buildMode: mode, artifactIds: result.artifactIds },
      }
      setMessages(prev => [...prev, briefMsg])
      await persistCardMessages([briefMsg])
      // Refresh artifacts from server
      if (convId) loadArtifacts(convId)
    } catch (err) {
      clearInterval(interval)
      setIsTyping(false)
      setBuildingLabel(null)
      addMsg(err.message || 'Failed to generate brief. Please try again.', true)
    }
  }

  // ─── PHASE 1: Analyze prompt → show build mode card ──────────────────────
  async function runBuildModeSelection(prompt) {
    setIsTyping(true)
    setBuildingLabel('Analyzing your request...')
    try {
      const result = await analyzeBuildMode(prompt, convId, toHistoryMessages(messages))
      setIsTyping(false)
      setBuildingLabel(null)

      pendingPromptRef.current = prompt

      const newMsgs = []
      if (result.intro) {
        const introId = Date.now().toString() + '_intro'
        newMsgs.push({ id: introId, role: 'assistant', content: result.intro, message_type: 'text', metadata: {} })
      }
      const modeId = Date.now().toString() + '_mode'
      pendingBuildModeMsgId.current = modeId
      newMsgs.push({
        id: modeId, role: 'assistant', content: '', message_type: 'build_mode',
        metadata: { recommendedMode: result.recommendedMode, complexityReason: result.complexityReason },
      })
      setMessages(prev => [...prev, ...newMsgs])
      await persistCardMessages(newMsgs)
    } catch (err) {
      setIsTyping(false)
      setBuildingLabel(null)
      addMsg(err.message || 'Failed to analyze request. Please try again.', true)
    }
  }

  // ─── User picks build mode → get clarification questions ─────────────────
  async function handleBuildModeSelect(mode) {
    pendingBuildModeRef.current = mode
    const prompt = pendingPromptRef.current
    if (!prompt) return

    // Mark the build_mode message as selected in DB so it persists correctly on refresh
    if (pendingBuildModeMsgId.current) {
      const bmId = pendingBuildModeMsgId.current
      pendingBuildModeMsgId.current = null
      // Update local state so card shows selected mode immediately
      setMessages(prev => prev.map(m =>
        m.id === bmId
          ? { ...m, metadata: { ...m.metadata, selectedMode: mode }, onModeSelect: null }
          : m
      ))
      // Persist selection to DB (update metadata on the build_mode DB row if it exists)
      // We don't have the DB row ID, so we query by conversation + type + selecting the latest
      supabase.from('messages')
        .select('id')
        .eq('conversation_id', convId)
        .eq('message_type', 'confirmation')
        .order('created_at', { ascending: false })
        .limit(1)
        .then(({ data }) => {
          if (data?.[0]) {
            supabase.from('messages').update({ metadata: { ...data[0].metadata, selectedMode: mode } }).eq('id', data[0].id)
          }
        })
    }

    setIsTyping(true)
    setBuildingLabel('Preparing questions...')
    try {
      const result = await getModeQuestions(prompt, convId, mode, toHistoryMessages(messages))
      setIsTyping(false)
      setBuildingLabel(null)

      const newMsgs = []
      if (result.intro) {
        newMsgs.push({ id: Date.now().toString() + '_qi', role: 'assistant', content: result.intro, message_type: 'text', metadata: {} })
      }

      if (result.type === 'clarification' && result.questions?.length > 0) {
        // Quick build: existing MC clarification card
        const clarId = Date.now().toString() + '_c'
        pendingClarMsgIdRef.current = clarId
        newMsgs.push({ id: clarId, role: 'assistant', content: '', message_type: 'clarification', metadata: { questions: result.questions, buildMode: 'quick' } })
      } else if (result.type === 'clarification_v2' && result.questions?.length > 0) {
        // Guided/Docs: richer clarification
        const clarId = Date.now().toString() + '_cv2'
        pendingClarV2MsgIdRef.current = clarId
        newMsgs.push({ id: clarId, role: 'assistant', content: '', message_type: 'clarification_v2', metadata: { questions: result.questions, buildMode: mode } })
      } else if (result.needsClarification === false) {
        // Quick build with no questions → go straight to spec
        setMessages(prev => [...prev, ...newMsgs])
        await runSpec(prompt, null)
        return
      }

      setMessages(prev => [...prev, ...newMsgs])
      await persistCardMessages(newMsgs)
    } catch (err) {
      setIsTyping(false)
      setBuildingLabel(null)
      addMsg(err.message || 'Failed to prepare questions. Please try again.', true)
    }
  }

  // ─── Quick clarification answered ─────────────────────────────────────────
  async function handleClarification(answers) {
    const originalPrompt = pendingPromptRef.current
    if (!originalPrompt) return
    pendingClarMsgIdRef.current = null
    // Don't echo answers as text — they're already visible in the card
    await runSpec(originalPrompt, answers)
  }

  // ─── Restart from clarification ───────────────────────────────────────────
  function handleRestartFromClarification() {
    // Clear everything after clarification — remove spec/brief messages, restore clarification as active
    setMessages(prev => {
      // Keep messages up to and including the clarification card
      const clarIdx = prev.findIndex(m =>
        m.id === pendingClarMsgIdRef.current || m.id === pendingClarV2MsgIdRef.current
      )
      if (clarIdx === -1) return prev
      return prev.slice(0, clarIdx + 1)
    })
    // Reset downstream pending state
    pendingSpecRef.current = null
    pendingSpecMsgIdRef.current = null
    pendingBriefMsgIdRef.current = null
    pendingClarAnswersRef.current = null
    // Re-activate the clarification card (it already has the right id in ref)
    // The ref is still set so the card will get its onClarify/onClarifyV2 handler back
  }

  // ─── Guided/Docs clarification answered ───────────────────────────────────
  async function handleClarificationV2(answers) {
    const originalPrompt = pendingPromptRef.current
    const mode = pendingBuildModeRef.current || 'guided'
    if (!originalPrompt) return
    pendingClarV2MsgIdRef.current = null
    // Don't echo answers as text — they're already visible in the card
    pendingClarAnswersRef.current = answers
    await runBrief(originalPrompt, mode, answers)
  }

  // ─── Edit existing app ─────────────────────────────────────────────────────
  async function runEdit(editRequest) {
    setIsTyping(true)
    setBuildingLabel('Updating your app...')
    try {
      const result = await editApp(currentApp.id, editRequest, convId)
      setIsTyping(false)
      setBuildingLabel(null)
      const { data: freshMsgs } = await supabase.from('messages').select('*').eq('conversation_id', convId).order('created_at')
      setMessages(prev => {
        const existingIds = new Set(prev.map(m => m.id))
        const newMsgs = (freshMsgs || []).filter(m => !existingIds.has(m.id))
        return [...prev, ...newMsgs]
      })
    } catch (err) {
      setIsTyping(false)
      setBuildingLabel(null)
      addMsg(err.message || 'Edit failed. Please try again.', true)
    }
  }

  // ─── Persist assistant card messages so they survive refresh ──────────────
  // In mock mode: frontend saves to localStorage (backend saves to real Supabase which frontend can't read)
  // In real mode: backend already saved; do a fresh DB fetch to sync real IDs into local state
  async function persistCardMessages(newMsgs) {
    if (MOCK_MODE) {
      // Save each card message via frontend Supabase client → localStorage
      for (const m of newMsgs) {
        if (m.message_type !== 'text') {
          await supabase.from('messages').insert({
            id: m.id,
            conversation_id: convId,
            role: m.role || 'assistant',
            content: m.content || '',
            message_type: m.message_type,
            metadata: m.metadata || {},
          })
        }
      }
    } else {
      // Real Supabase: backend already saved with real UUIDs — fetch fresh and merge
      const { data: dbMsgs } = await supabase.from('messages').select('*').eq('conversation_id', convId).order('created_at')
      if (dbMsgs?.length) {
        setMessages(prev => {
          // Keep any local-only messages (pending refs, optimistic), merge with DB
          const dbIds = new Set(dbMsgs.map(m => m.id))
          const localOnly = prev.filter(m => !dbIds.has(m.id) && m.id.includes('_'))
          return [...dbMsgs, ...localOnly]
        })
      }
    }
  }

  // ─── Main submit handler ───────────────────────────────────────────────────
  async function handleSubmit(prompt) {
    if (!convId || !user) return

    const userMsg = { id: Date.now().toString(), role: 'user', content: prompt, message_type: 'text', metadata: {} }
    setMessages(prev => [...prev, userMsg])
    await supabase.from('messages').insert({ conversation_id: convId, role: 'user', content: prompt, message_type: 'text' })

    if (currentApp) {
      await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', convId)
      await runEdit(prompt)
      return
    }

    await supabase.from('conversations').update({ updated_at: new Date().toISOString(), title: prompt.slice(0, 60) }).eq('id', convId)
    setCurrentConv(prev => prev ? { ...prev, title: prompt.slice(0, 60) } : prev)
    loadConversations()

    await runBuildModeSelection(prompt)
  }

  // ─── Utility ──────────────────────────────────────────────────────────────
  function addMsg(content, isError = false) {
    setMessages(prev => [...prev, {
      id: Date.now().toString() + '_msg',
      role: 'assistant', content,
      message_type: 'text', isError, metadata: {},
    }])
  }

  // ─── Attach live handlers to messages ─────────────────────────────────────
  const messagesWithHandlers = messages.map(m => {
    const ct = m.metadata?.cardType || m.message_type
    if (ct === 'build_mode' && m.id === pendingBuildModeMsgId.current && !isTyping) {
      return { ...m, onModeSelect: handleBuildModeSelect }
    }
    if (ct === 'clarification') {
      const isActive = m.id === pendingClarMsgIdRef.current && !isTyping
      return { ...m, onClarify: isActive ? handleClarification : null, onRestart: handleRestartFromClarification }
    }
    if (ct === 'clarification_v2') {
      const isActive = m.id === pendingClarV2MsgIdRef.current && !isTyping
      return { ...m, onClarifyV2: isActive ? handleClarificationV2 : null, onRestart: handleRestartFromClarification }
    }
    if (ct === 'spec' && m.id === pendingSpecMsgIdRef.current && !isTyping) {
      return { ...m, onBuild: handleBuildApp, onSpecChange: (updatedSpec) => { pendingSpecRef.current = updatedSpec } }
    }
    if (ct === 'enterprise_brief') {
      const handlers = { onOpenArtifact: openArtifact, artifacts }
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
        />
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          {convId ? (
            <>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <ChatArea messages={messagesWithHandlers} isTyping={isTyping} buildingLabel={buildingLabel} />
                <InputZone onSubmit={handleSubmit} disabled={isTyping} />
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
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: '#2A2A2A', fontSize: 13 }}>
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                <rect x="2" y="2" width="17" height="17" rx="3" fill="#2A2A2A" />
                <rect x="21" y="2" width="17" height="17" rx="3" fill="#333" />
                <rect x="2" y="21" width="17" height="17" rx="3" fill="#222" />
                <rect x="21" y="21" width="17" height="17" rx="3" fill="#2E2E2E" />
              </svg>
              <span>Select a conversation or create a new app</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
