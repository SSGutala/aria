import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { generateApp } from '../lib/claude'
import Sidebar from '../components/Sidebar'
import Topbar from '../components/Topbar'
import ChatArea from '../components/ChatArea'
import InputZone from '../components/InputZone'
import OnboardingFlow from '../components/OnboardingFlow'

export default function Workspace() {
  const { convId } = useParams()
  const navigate = useNavigate()

  const [user, setUser] = useState(null)
  const [conversations, setConversations] = useState([])
  const [apps, setApps] = useState([])
  const [messages, setMessages] = useState([])
  const [currentConv, setCurrentConv] = useState(null)
  const [currentApp, setCurrentApp] = useState(null)
  const [isTyping, setIsTyping] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)

  // Track pending clarification so we can resolve it inline
  const pendingPromptRef = useRef(null)
  const pendingClarMsgIdRef = useRef(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      if (localStorage.getItem('aria_new_user')) setShowOnboarding(true)
    })
  }, [])

  const loadConversations = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
    setConversations(data || [])
  }, [user])

  const loadApps = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('generated_apps')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setApps(data || [])
  }, [user])

  useEffect(() => {
    if (user) {
      loadConversations()
      loadApps()
    }
  }, [user, loadConversations, loadApps])

  useEffect(() => {
    if (!convId) return
    supabase.from('conversations').select('*').eq('id', convId).single()
      .then(({ data }) => setCurrentConv(data))
    supabase.from('messages').select('*').eq('conversation_id', convId).order('created_at')
      .then(({ data }) => setMessages(data || []))
    supabase.from('generated_apps').select('*').eq('conversation_id', convId).single()
      .then(({ data }) => setCurrentApp(data || null))
    pendingPromptRef.current = null
    pendingClarMsgIdRef.current = null
  }, [convId])

  async function runGeneration(prompt, clarificationAnswers = null) {
    setIsTyping(true)
    try {
      const result = await generateApp(prompt, convId, [], clarificationAnswers)
      setIsTyping(false)

      if (result.type === 'clarification') {
        // Store the pending prompt so we can resubmit after clarification
        pendingPromptRef.current = prompt
        const clarId = Date.now().toString() + '_c'
        pendingClarMsgIdRef.current = clarId
        const clarMsg = {
          id: clarId,
          role: 'assistant',
          content: '',
          message_type: 'clarification',
          metadata: { questions: result.questions },
        }
        setMessages(prev => [...prev, clarMsg])

      } else if (result.type === 'app_card') {
        // Pull fresh messages from DB to get the confirmation msg too
        const { data: freshMsgs } = await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', convId)
          .order('created_at')
        setMessages(freshMsgs || [])
        setCurrentApp({ slug: result.slug, id: result.appId, title: result.schema?.appTitle })
        loadApps()
        loadConversations()
      }
    } catch (err) {
      setIsTyping(false)
      setMessages(prev => [...prev, {
        id: Date.now().toString() + '_err',
        role: 'assistant',
        content: err.message || 'Generation failed. Please try again.',
        message_type: 'text',
        isError: true,
        metadata: {},
      }])
    }
  }

  async function handleSubmit(prompt) {
    if (!convId || !user) return

    // Save user message
    const userMsg = {
      id: Date.now().toString(),
      role: 'user',
      content: prompt,
      message_type: 'text',
      metadata: {},
    }
    setMessages(prev => [...prev, userMsg])

    await supabase.from('messages').insert({
      conversation_id: convId,
      role: 'user',
      content: prompt,
      message_type: 'text',
    })

    await supabase.from('conversations').update({
      updated_at: new Date().toISOString(),
      title: prompt.slice(0, 60),
    }).eq('id', convId)

    setCurrentConv(prev => prev ? { ...prev, title: prompt.slice(0, 60) } : prev)
    loadConversations()

    await runGeneration(prompt)
  }

  async function handleClarification(answers) {
    const originalPrompt = pendingPromptRef.current
    if (!originalPrompt) return

    // Collapse the clarification card (remove onClarify so it shows answered state)
    pendingClarMsgIdRef.current = null

    // Show user's answers as a chat message
    const userAnswerMsg = {
      id: Date.now().toString() + '_ua',
      role: 'user',
      content: answers,
      message_type: 'text',
      metadata: {},
    }
    setMessages(prev => [...prev, userAnswerMsg])

    await supabase.from('messages').insert({
      conversation_id: convId,
      role: 'user',
      content: answers,
      message_type: 'text',
    })

    await runGeneration(originalPrompt, answers)
  }

  // Attach onClarify handler to the pending clarification message
  const messagesWithHandlers = messages.map(m => {
    if (
      m.message_type === 'clarification' &&
      m.id === pendingClarMsgIdRef.current &&
      !isTyping
    ) {
      return { ...m, onClarify: handleClarification }
    }
    return m
  })

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#111111' }}>
      {showOnboarding && <OnboardingFlow onComplete={() => setShowOnboarding(false)} />}
      {user && (
        <Sidebar
          user={user}
          conversations={conversations}
          apps={apps}
          onConversationsChange={loadConversations}
        />
      )}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', minWidth: 0 }}>
        <Topbar
          conversation={currentConv}
          app={currentApp}
          onTitleChange={(t) => setCurrentConv(prev => prev ? { ...prev, title: t } : prev)}
        />
        {convId ? (
          <>
            <ChatArea messages={messagesWithHandlers} isTyping={isTyping} />
            <InputZone onSubmit={handleSubmit} disabled={isTyping} />
          </>
        ) : (
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: 12,
            color: '#2A2A2A',
            fontSize: 13,
          }}>
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
  )
}
