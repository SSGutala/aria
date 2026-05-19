import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import Toast from '../components/Toast'

const ToastContext = createContext(null)

const DEFAULT_DURATIONS = {
  success: 4000,
  info: 4000,
  warning: 6000,
  error: 0, // persistent — user must dismiss or retry
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const idRef = useRef(0)

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const show = useCallback((level, message, options = {}) => {
    const id = ++idRef.current
    const duration = options.duration ?? DEFAULT_DURATIONS[level] ?? 5000
    const toast = {
      id,
      level,
      message,
      title: options.title || null,
      onRetry: options.onRetry || null,
      retryLabel: options.retryLabel || 'Retry',
    }
    setToasts(prev => [...prev, toast])
    if (duration > 0) {
      setTimeout(() => dismiss(id), duration)
    }
    return id
  }, [dismiss])

  const api = useMemo(() => ({
    success: (msg, opts) => show('success', msg, opts),
    info:    (msg, opts) => show('info', msg, opts),
    warning: (msg, opts) => show('warning', msg, opts),
    error:   (msg, opts) => show('error', msg, opts),
    dismiss,
  }), [show, dismiss])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <Toast toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    // Fallback so calls outside a provider don't crash — log to console instead.
    return {
      success: (m) => console.log('[toast.success]', m),
      info:    (m) => console.log('[toast.info]', m),
      warning: (m) => console.warn('[toast.warning]', m),
      error:   (m) => console.error('[toast.error]', m),
      dismiss: () => {},
    }
  }
  return ctx
}
