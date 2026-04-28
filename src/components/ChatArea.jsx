import React, { useEffect, useRef } from 'react'
import MessageBubble from './MessageBubble'

export default function ChatArea({ messages, isTyping }) {
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  if (messages.length === 0 && !isTyping) {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#2A2A2A',
        fontSize: 12,
        gap: 8,
      }}>
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <rect x="2" y="2" width="13" height="13" rx="2" fill="#2A2A2A" />
          <rect x="17" y="2" width="13" height="13" rx="2" fill="#3A3A3A" />
          <rect x="2" y="17" width="13" height="13" rx="2" fill="#222" />
          <rect x="17" y="17" width="13" height="13" rx="2" fill="#303030" />
        </svg>
        <span>Describe an internal tool to get started</span>
      </div>
    )
  }

  return (
    <div style={{
      flex: 1,
      overflowY: 'auto',
      padding: '18px 22px',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
    }}>
      {messages.map(msg => (
        <MessageBubble key={msg.id} message={msg} />
      ))}
      {isTyping && <MessageBubble isTyping />}
      <div ref={bottomRef} />
    </div>
  )
}
