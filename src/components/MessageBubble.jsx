import React, { useState } from 'react'
import GeneratedAppCard from './GeneratedAppCard'
import ClarificationCard from './ClarificationCard'
import ClarificationCardV2 from './ClarificationCardV2'
import BuildModeCard from './BuildModeCard'
import EnterpriseStagesCard from './EnterpriseStagesCard'
import SpecCard from './SpecCard'
import BuildingIndicator from './BuildingIndicator'

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

// ── Copy button ───────────────────────────────────────────────────────────────
function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false)
  function copy(e) {
    e.stopPropagation()
    navigator.clipboard.writeText(text || '').then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }
  return (
    <button onClick={copy}
      title="Copy"
      style={{
        background: 'none', border: 'none', cursor: 'pointer', padding: '2px 5px',
        color: copied ? '#34D399' : '#3D3D3D', fontSize: 10, borderRadius: 4,
        transition: 'color 0.15s', lineHeight: 1, fontFamily: 'inherit',
      }}
      onMouseEnter={e => { if (!copied) e.currentTarget.style.color = '#737373' }}
      onMouseLeave={e => { if (!copied) e.currentTarget.style.color = '#3D3D3D' }}>
      {copied ? '✓ Copied' : '⎘ Copy'}
    </button>
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

export default function MessageBubble({ message, isTyping, buildingLabel }) {
  if (isTyping) return <BuildingIndicator label={buildingLabel} />

  const isUser = message.role === 'user'
  const isError = message.isError
  const meta = message.metadata || {}

  // ── User bubble ──────────────────────────────────────────────────────────────
  if (isUser) {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-end', gap: 6 }}>
        <CopyBtn text={message.content} />
        <div style={{
          background: '#1F1F1F', border: '0.5px solid #2E2E2E', borderRadius: 10,
          padding: '10px 13px', color: '#D4D4D4', fontSize: 'clamp(11px, 1.5vw, 13px)',
          lineHeight: 1.6, maxWidth: 'min(80%, 560px)', whiteSpace: 'pre-wrap',
        }}>
          {message.content}
        </div>
      </div>
    )
  }

  // ── Generated app card ───────────────────────────────────────────────────────
  if (message.message_type === 'app_card') {
    return (
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
        <AIIcon />
        <GeneratedAppCard schema={meta.schema} slug={meta.slug} appId={meta.appId} />
      </div>
    )
  }

  // ── Build mode selection card — always shown as card ─────────────────────────
  if (message.message_type === 'build_mode') {
    return (
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
        <AIIcon />
        <BuildModeCard
          recommendedMode={meta.recommendedMode}
          complexityReason={meta.complexityReason}
          onSelect={message.onModeSelect}   // null = already selected, card shows as read-only
          selected={!message.onModeSelect ? (meta.selectedMode || meta.recommendedMode) : null}
        />
      </div>
    )
  }

  // ── Clarification v1 — always shown as interactive card ───────────────────────
  if (message.message_type === 'clarification' && meta.questions) {
    return (
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
        <AIIcon />
        <ClarificationCard
          questions={meta.questions}
          onSubmit={message.onClarify}
          onRestart={message.onRestart}
          answered={!message.onClarify}    // shows "change answers" mode
        />
      </div>
    )
  }

  // ── Clarification v2 — always shown as interactive card ──────────────────────
  if (message.message_type === 'clarification_v2' && meta.questions) {
    return (
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
        <AIIcon />
        <ClarificationCardV2
          questions={meta.questions}
          buildMode={meta.buildMode}
          onSubmit={message.onClarifyV2}
          onRestart={message.onRestart}
          answered={!message.onClarifyV2}
        />
      </div>
    )
  }

  // ── Enterprise stages brief ──────────────────────────────────────────────────
  if (message.message_type === 'enterprise_brief') {
    return (
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, width: '100%' }}>
        <AIIcon />
        <EnterpriseStagesCard
          brief={meta.brief}
          buildMode={meta.buildMode}
          onBuild={message.onBuild}
          onOpenArtifact={message.onOpenArtifact}
          artifactIds={meta.artifactIds}
          artifacts={message.artifacts || []}
        />
      </div>
    )
  }

  // ── Quick build spec card ────────────────────────────────────────────────────
  if (message.message_type === 'spec') {
    const spec = meta.spec
    if (!spec) return null
    return (
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
        <AIIcon />
        <SpecCard spec={spec} onBuild={message.onBuild} onSpecChange={message.onSpecChange} />
      </div>
    )
  }

  // ── Default text bubble ──────────────────────────────────────────────────────
  if (!message.content) return null
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
      <AIIcon />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxWidth: 'min(88%, 680px)', minWidth: 0 }}>
        <div style={{
          background: '#1A1A1A', border: '0.5px solid #222', borderRadius: 10,
          padding: '10px 13px',
          color: isError ? '#F87171' : '#A3A3A3',
          fontSize: 'clamp(11px, 1.5vw, 13px)', lineHeight: 1.6, whiteSpace: 'pre-wrap',
        }}>
          {renderContent(message.content)}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <CopyBtn text={message.content} />
        </div>
      </div>
    </div>
  )
}
