import React, { useEffect, useRef, useState } from 'react'
import mermaid from 'mermaid'
import { logAction } from '../lib/devlog'

mermaid.initialize({ startOnLoad: false, theme: 'neutral', securityLevel: 'loose' })

export default function DiagramViewer({ diagram, onClose, onUpdate }) {
  const [mode, setMode] = useState('view') // 'view' | 'edit'
  const [source, setSource] = useState(diagram?.mermaid_source || diagram?.content?.mermaid_source || '')
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const previewRef = useRef(null)

  useEffect(() => { renderDiagram(source) }, [source, mode])

  async function renderDiagram(src) {
    if (!previewRef.current || !src) return
    try {
      setError(null)
      const id = 'mermaid-' + Date.now()
      const { svg } = await mermaid.render(id, src)
      previewRef.current.innerHTML = svg
    } catch (e) {
      setError(e.message || 'Invalid diagram syntax')
    }
  }

  async function save() {
    setSaving(true)
    try {
      const res = await fetch(`/api/artifacts/${diagram.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: { ...diagram.content, mermaid_source: source }, mermaid_source: source })
      })
      const data = await res.json()
      onUpdate?.(data.artifact)
      setMode('view')
    } finally { setSaving(false) }
  }

  async function exportSVG() {
    if (!previewRef.current) return
    const svg = previewRef.current.innerHTML
    const blob = new Blob([svg], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `${diagram.title || 'diagram'}.svg`; a.click()
    URL.revokeObjectURL(url)
  }

  async function exportMermaid() {
    const blob = new Blob([source], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `${diagram.title || 'diagram'}.md`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:1000,display:'flex',flexDirection:'column' }}>
      {/* Header */}
      <div style={{ background:'#111',borderBottom:'0.5px solid #2A2A2A',padding:'12px 20px',display:'flex',alignItems:'center',gap:12 }}>
        <span style={{ color:'#D4D4D4',fontWeight:600,fontSize:14,flex:1 }}>{diagram.title}</span>
        <span style={{ fontSize:10,color:'#525252',background:'#1A1A1A',border:'0.5px solid #2A2A2A',borderRadius:4,padding:'2px 8px' }}>Diagram</span>
        {mode === 'view' ? (
          <>
            <button onClick={() => { logAction('diagram.edit_mode_entered', {}); setMode('edit') }} style={btnStyle('#1E1E1E','#A3A3A3')}>✏ Edit</button>
            <button onClick={() => { logAction('diagram.exported', { format: 'svg' }); exportSVG() }} style={btnStyle('#1E1E1E','#A3A3A3')}>↓ SVG</button>
            <button onClick={() => { logAction('diagram.exported', { format: 'mermaid' }); exportMermaid() }} style={btnStyle('#1E1E1E','#A3A3A3')}>↓ Mermaid</button>
          </>
        ) : (
          <>
            <button onClick={() => { logAction('diagram.edit_cancelled', {}); setMode('view') }} style={btnStyle('#1E1E1E','#737373')}>Cancel</button>
            <button onClick={() => { logAction('diagram.saved', {}); save() }} disabled={saving} style={btnStyle('#1A2A1A','#34D399')}>{saving ? 'Saving...' : 'Save'}</button>
          </>
        )}
        <button onClick={() => { logAction('diagram.viewer_closed', {}); onClose() }} style={{ background:'none',border:'none',color:'#525252',cursor:'pointer',fontSize:18,padding:'0 4px' }}>✕</button>
      </div>

      {/* Body */}
      <div style={{ flex:1,display:'flex',overflow:'hidden' }}>
        {/* Preview */}
        <div style={{ flex:1,overflow:'auto',padding:32,background:'#FAFAFA',display:'flex',alignItems:'flex-start',justifyContent:'center' }}>
          {error && <div style={{ color:'#EF4444',fontSize:12,background:'#FEF2F2',border:'1px solid #FECACA',borderRadius:8,padding:12,marginBottom:16 }}>{error}</div>}
          <div ref={previewRef} style={{ maxWidth:900,width:'100%' }} />
        </div>
        {/* Editor (shown in edit mode) */}
        {mode === 'edit' && (
          <div style={{ width:380,borderLeft:'0.5px solid #2A2A2A',display:'flex',flexDirection:'column',background:'#111' }}>
            <div style={{ padding:'10px 14px',borderBottom:'0.5px solid #1E1E1E' }}>
              <span style={{ fontSize:11,color:'#525252' }}>Edit Mermaid source</span>
            </div>
            <textarea
              value={source}
              onChange={e => setSource(e.target.value)}
              style={{ flex:1,background:'#0D0D0D',color:'#D4D4D4',border:'none',padding:16,fontSize:12,fontFamily:'monospace',lineHeight:1.6,resize:'none',outline:'none' }}
            />
          </div>
        )}
      </div>
    </div>
  )
}

function btnStyle(bg, color) {
  return { background:bg, color, border:'0.5px solid #2A2A2A', borderRadius:6, fontSize:11, cursor:'pointer', padding:'5px 12px', fontFamily:'inherit' }
}
