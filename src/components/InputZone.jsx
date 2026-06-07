import React, { useState, useRef } from 'react'
import { logAction } from '../lib/devlog'

export default function InputZone({ onSubmit, disabled, currentModel, onModelChange, placeholder = 'Describe the internal tool you need...', sendHint = 'Enter to send · Shift+Enter for new line', onAttachTemplate }) {
  const [value, setValue] = useState('')
  const textareaRef = useRef(null)
  const fileInputRef = useRef(null)

  function handleFilePick(e) {
    const file = e.target.files?.[0]
    if (file) onAttachTemplate?.(file)
    e.target.value = '' // allow re-selecting the same file
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
    // Shift+Enter falls through naturally — browser inserts newline
  }

  function submit() {
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    setValue('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    onSubmit(trimmed)
  }

  function handleInput(e) {
    setValue(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
  }

  return (
    <div style={{ padding: 'clamp(8px, 2vw, 10px) clamp(10px, 4vw, 18px) clamp(10px, 2vw, 13px)', borderTop: '0.5px solid #1A1A1A' }}>
      <div style={{
        border: '0.5px solid #2A2A2A',
        borderRadius: 10,
        padding: '9px 12px',
        display: 'flex',
        alignItems: 'flex-end',
        gap: 10,
      }}>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          disabled={disabled}
          style={{
            background: 'transparent',
            color: '#F5F5F5',
            fontSize: 12,
            border: 'none',
            outline: 'none',
            flex: 1,
            resize: 'none',
            lineHeight: 1.5,
            fontFamily: 'inherit',
            caretColor: '#F5F5F5',
            minHeight: 20,
            maxHeight: 120,
            overflow: 'hidden',
          }}
        />
        <style>{`textarea::placeholder { color: #6E6E6E; }`}</style>
        {onAttachTemplate && (
          <>
            <input ref={fileInputRef} type="file" accept=".docx,.pdf,.md,.markdown,.txt" onChange={handleFilePick} style={{ display: 'none' }} />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled}
              title="Upload a document template for Aria to fill out"
              style={{ width: 28, height: 28, borderRadius: 6, background: 'transparent', border: '0.5px solid #2A2A2A', cursor: disabled ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: disabled ? 0.5 : 1 }}
            >
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                <path d="M9.5 3.5L4.7 8.3a1.5 1.5 0 102.1 2.1l4.8-4.8a3 3 0 10-4.2-4.2L2.4 6.2a4.5 4.5 0 106.4 6.4" stroke="#C4C4C4" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </>
        )}
        <button
          onClick={submit}
          disabled={disabled || !value.trim()}
          style={{
            width: 28, height: 28,
            borderRadius: 6,
            background: 'linear-gradient(135deg, #2A2A2A, #484848)',
            border: '0.5px solid #525252',
            cursor: disabled || !value.trim() ? 'default' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            opacity: disabled || !value.trim() ? 0.5 : 1,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 10L10 2M10 2H4M10 2V8" stroke="#E0E0E0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginTop: 7,
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', gap: 6, flex: 1 }}>
          <span style={{
            display: 'flex', alignItems: 'center', gap: 4,
            color: '#C4C4C4', fontSize: 10, cursor: 'default',
          }}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <rect x="1" y="1" width="8" height="8" rx="1.5" stroke="#C4C4C4" strokeWidth="0.75"/>
              <path d="M3 5h4M5 3v4" stroke="#C4C4C4" strokeWidth="0.75" strokeLinecap="round"/>
            </svg>
            Connect M365
          </span>
          <span style={{
            display: 'flex', alignItems: 'center', gap: 4,
            color: '#C4C4C4', fontSize: 10, cursor: 'default',
          }}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <circle cx="5" cy="5" r="3.5" stroke="#C4C4C4" strokeWidth="0.75"/>
              <path d="M5 3v2l1.5 1.5" stroke="#C4C4C4" strokeWidth="0.75" strokeLinecap="round"/>
            </svg>
            View history
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            color: '#9CA3AF', fontSize: 10,
            border: '0.5px solid #2A2A2A', borderRadius: 4, padding: '4px 8px',
          }} title="Model is configured in Settings → Integrations">
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: (currentModel || 'ollama') === 'ollama' ? '#34D399' : '#A78BFA' }} />
            {(currentModel || 'ollama') === 'ollama' ? 'Ollama (Local)' : (currentModel === 'claude' ? 'Claude' : 'Groq')}
          </span>
          <span style={{ color: '#B5B5B5', fontSize: 10, whiteSpace: 'nowrap' }}>{sendHint}</span>
        </div>
      </div>
    </div>
  )
}
