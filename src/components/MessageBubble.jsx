import React from 'react'
import GeneratedAppCard from './GeneratedAppCard'
import ClarificationCard from './ClarificationCard'

function AIIcon() {
  return (
    <div style={{
      width: 24, height: 24, borderRadius: 6,
      background: 'linear-gradient(135deg, #1A1A1A, #3A3A3A)',
      border: '0.5px solid #3D3D3D',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <rect x="0" y="0" width="5.5" height="5.5" rx="1" fill="#888" />
        <rect x="6.5" y="0" width="5.5" height="5.5" rx="1" fill="#CCC" />
        <rect x="0" y="6.5" width="5.5" height="5.5" rx="1" fill="#555" />
        <rect x="6.5" y="6.5" width="5.5" height="5.5" rx="1" fill="#999" />
      </svg>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
      <AIIcon />
      <div style={{
        background: '#1A1A1A',
        border: '0.5px solid #222',
        borderRadius: 10,
        padding: '10px 14px',
        display: 'flex',
        gap: 4,
        alignItems: 'center',
      }}>
        {[0, 1, 2].map(i => (
          <div
            key={i}
            style={{
              width: 5, height: 5, borderRadius: '50%',
              background: '#525252',
              animation: 'bounce 1.2s infinite',
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
        <style>{`
          @keyframes bounce {
            0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
            40% { transform: translateY(-4px); opacity: 1; }
          }
        `}</style>
      </div>
    </div>
  )
}

export default function MessageBubble({ message, isTyping }) {
  if (isTyping) return <TypingIndicator />

  const isUser = message.role === 'user'
  const isAppCard = message.message_type === 'app_card'
  const isError = message.isError

  if (isUser) {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{
          background: '#1F1F1F',
          border: '0.5px solid #2E2E2E',
          borderRadius: 10,
          padding: '10px 13px',
          color: '#D4D4D4',
          fontSize: 12,
          lineHeight: 1.6,
          maxWidth: '80%',
          whiteSpace: 'pre-wrap',
        }}>
          {message.content}
        </div>
      </div>
    )
  }

  if (isAppCard) {
    const meta = message.metadata || {}
    return (
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
        <AIIcon />
        <GeneratedAppCard schema={meta.schema} slug={meta.slug} appId={meta.appId} />
      </div>
    )
  }

  if (message.message_type === 'clarification' && message.metadata?.questions && message.onClarify) {
    return (
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
        <AIIcon />
        <ClarificationCard questions={message.metadata.questions} onSubmit={message.onClarify} />
      </div>
    )
  }

  if (message.message_type === 'clarification' && message.metadata?.questions && !message.onClarify) {
    // already answered — show collapsed version
    return (
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
        <AIIcon />
        <div style={{
          background: '#1A1A1A', border: '0.5px solid #222', borderRadius: 10,
          padding: '10px 13px', color: '#525252', fontSize: 12, maxWidth: '88%',
        }}>
          Clarification answered
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
      <AIIcon />
      <div style={{
        background: '#1A1A1A',
        border: '0.5px solid #222',
        borderRadius: 10,
        padding: '10px 13px',
        color: isError ? '#F87171' : '#A3A3A3',
        fontSize: 12,
        lineHeight: 1.6,
        maxWidth: '88%',
        whiteSpace: 'pre-wrap',
      }}
        dangerouslySetInnerHTML={message.content.includes('**') ? undefined : undefined}
      >
        {renderContent(message.content)}
      </div>
    </div>
  )
}

function renderContent(content) {
  if (!content) return null
  const parts = content.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} style={{ color: '#F5F5F5' }}>{part.slice(2, -2)}</strong>
    }
    return part
  })
}
