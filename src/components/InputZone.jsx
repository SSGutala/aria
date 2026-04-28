import React, { useState, useRef } from 'react'

export default function InputZone({ onSubmit, disabled }) {
  const [value, setValue] = useState('')
  const textareaRef = useRef(null)

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
    <div style={{ padding: '10px 18px 13px', borderTop: '0.5px solid #1A1A1A' }}>
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
          placeholder="Describe the internal tool you need..."
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
        <style>{`textarea::placeholder { color: #3D3D3D; }`}</style>
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
      }}>
        <div style={{ display: 'flex', gap: 6, flex: 1 }}>
          <span style={{
            display: 'flex', alignItems: 'center', gap: 4,
            color: '#3D3D3D', fontSize: 10, cursor: 'default',
          }}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <rect x="1" y="1" width="8" height="8" rx="1.5" stroke="#3D3D3D" strokeWidth="0.75"/>
              <path d="M3 5h4M5 3v4" stroke="#3D3D3D" strokeWidth="0.75" strokeLinecap="round"/>
            </svg>
            Connect M365
          </span>
          <span style={{
            display: 'flex', alignItems: 'center', gap: 4,
            color: '#3D3D3D', fontSize: 10, cursor: 'default',
          }}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <circle cx="5" cy="5" r="3.5" stroke="#3D3D3D" strokeWidth="0.75"/>
              <path d="M5 3v2l1.5 1.5" stroke="#3D3D3D" strokeWidth="0.75" strokeLinecap="round"/>
            </svg>
            View history
          </span>
        </div>
        <span style={{ color: '#2A2A2A', fontSize: 10 }}>Enter to send · Shift+Enter for new line</span>
      </div>
    </div>
  )
}
