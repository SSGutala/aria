import React, { useState, useRef } from 'react'
import { API_URL as API } from '../lib/api'
import { logAction } from '../lib/devlog'

const TYPE_META = {
  intake_summary:    { label: 'Intake Summary',    icon: '📋', color: '#60A5FA' },
  product_brief:     { label: 'Product Brief',     icon: '📄', color: '#A78BFA' },
  workflow_map:      { label: 'Workflow Map',       icon: '🔀', color: '#34D399' },
  data_model:        { label: 'Data Model',         icon: '🗂️', color: '#FBBF24' },
  automation_model:  { label: 'Automation Model',   icon: '⚡', color: '#F87171' },
  ux_recommendation: { label: 'UX Recommendation',  icon: '🎨', color: '#F472B6' },
  app_spec:          { label: 'App Spec',            icon: '⚙️', color: '#94A3B8' },
}

const STATUS_DOT = {
  draft:      '#525252',
  approved:   '#34D399',
  built:      '#60A5FA',
  superseded: '#333333',
}

const FORMAT_LABELS = { pdf: 'PDF', docx: 'Word', xlsx: 'Excel', csv: 'CSV', json: 'JSON', md: 'MD' }
const FORMAT_ICONS  = { pdf: '📄', docx: '📝', xlsx: '📊', csv: '📋', json: '{ }', md: '#' }

const FORMAT_MAP = {
  intake_summary:    ['pdf', 'docx', 'md'],
  product_brief:     ['pdf', 'docx', 'md'],
  workflow_map:      ['pdf', 'md', 'json'],
  data_model:        ['pdf', 'xlsx', 'csv', 'json'],
  automation_model:  ['pdf', 'json', 'md'],
  ux_recommendation: ['pdf', 'docx', 'md'],
  app_spec:          ['pdf', 'docx', 'xlsx', 'json'],
}

const ARTIFACT_TYPES = Object.entries(TYPE_META).map(([value, { label }]) => ({ value, label }))

// ─── Add Document Modal ───────────────────────────────────────────────────────
function AddDocumentModal({ conversationId, onClose, onArtifactCreated, onGenerateArtifact, onUploadFile }) {
  const [tab, setTab] = useState('generate') // 'generate' | 'blank' | 'upload'
  const [description, setDescription] = useState('')
  const [type, setType] = useState('product_brief')
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef(null)

  async function handleGenerate() {
    if (!description.trim()) return
    logAction('artifact.generate_requested', { type, description: description.slice(0, 80) })
    setLoading(true); setError('')
    try {
      await onGenerateArtifact?.(description, type)
      onClose()
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  async function handleCreateBlank() {
    if (!title.trim()) return
    logAction('artifact.blank_created', { type, title })
    setLoading(true); setError('')
    try {
      const res = await fetch(`${API}/api/artifacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, artifactType: type, title, source: 'blank' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onArtifactCreated?.(data.artifact)
      onClose()
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  function handleUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    logAction('artifact.file_uploaded', { fileName: e.target.files[0]?.name })
    onUploadFile?.(file)
    onClose()
  }

  const tabs = [
    { key: 'generate', label: '✦ Generate with AI' },
    { key: 'blank',    label: '+ Create blank' },
    { key: 'upload',   label: '↑ Upload file' },
  ]

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#141414', border: '0.5px solid #2A2A2A', borderRadius: 12, width: 420, overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.6)' }}>
        {/* Header */}
        <div style={{ padding: '16px 20px 12px', borderBottom: '0.5px solid #1E1E1E', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#D4D4D4' }}>Add Document</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#525252', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '0.5px solid #1E1E1E' }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{ flex: 1, padding: '9px 4px', background: tab === t.key ? '#1E1E1E' : 'transparent', border: 'none', color: tab === t.key ? '#D4D4D4' : '#525252', fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', borderBottom: tab === t.key ? '2px solid #A78BFA' : '2px solid transparent', transition: 'all 0.1s' }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ padding: 20 }}>
          {tab === 'generate' && (
            <>
              <textarea value={description} onChange={e => setDescription(e.target.value)}
                placeholder="Describe the document... e.g. 'A data model for a vendor invoice management system'"
                style={{ width: '100%', minHeight: 80, background: '#1A1A1A', border: '0.5px solid #2A2A2A', borderRadius: 6, color: '#D4D4D4', fontSize: 12, padding: '8px 12px', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none', lineHeight: 1.5, marginBottom: 12 }}
              />
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 10, color: '#525252', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Document Type</label>
                <select value={type} onChange={e => { logAction('artifact.type_changed', { type: e.target.value }); setType(e.target.value) }}
                  style={{ width: '100%', background: '#1A1A1A', border: '0.5px solid #2A2A2A', borderRadius: 5, color: '#D4D4D4', fontSize: 12, padding: '7px 10px', fontFamily: 'inherit', outline: 'none' }}>
                  {ARTIFACT_TYPES.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
              {error && <div style={{ fontSize: 11, color: '#F87171', marginBottom: 10 }}>{error}</div>}
              <button onClick={handleGenerate} disabled={loading || !description.trim()}
                style={{ width: '100%', background: loading || !description.trim() ? '#1A1A1A' : '#1A0D2A', color: loading || !description.trim() ? '#525252' : '#A78BFA', border: '0.5px solid #3A1E5F', borderRadius: 6, padding: '8px', fontSize: 12, cursor: loading || !description.trim() ? 'default' : 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>
                {loading ? 'Generating…' : '✦ Generate with Aria'}
              </button>
            </>
          )}

          {tab === 'blank' && (
            <>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 10, color: '#525252', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Document Type</label>
                <select value={type} onChange={e => setType(e.target.value)}
                  style={{ width: '100%', background: '#1A1A1A', border: '0.5px solid #2A2A2A', borderRadius: 5, color: '#D4D4D4', fontSize: 12, padding: '7px 10px', fontFamily: 'inherit', outline: 'none' }}>
                  {ARTIFACT_TYPES.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 10, color: '#525252', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Title</label>
                <input value={title} onChange={e => setTitle(e.target.value)}
                  placeholder="Document title…"
                  style={{ width: '100%', background: '#1A1A1A', border: '0.5px solid #2A2A2A', borderRadius: 5, color: '#D4D4D4', fontSize: 12, padding: '7px 10px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              {error && <div style={{ fontSize: 11, color: '#F87171', marginBottom: 10 }}>{error}</div>}
              <button onClick={handleCreateBlank} disabled={loading || !title.trim()}
                style={{ width: '100%', background: loading || !title.trim() ? '#1A1A1A' : '#0D1F16', color: loading || !title.trim() ? '#525252' : '#34D399', border: '0.5px solid #34D39933', borderRadius: 6, padding: '8px', fontSize: 12, cursor: loading || !title.trim() ? 'default' : 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>
                {loading ? 'Creating…' : '+ Create Blank Document'}
              </button>
            </>
          )}

          {tab === 'upload' && (
            <>
              <div style={{ background: '#1A1A1A', border: '1px dashed #2A2A2A', borderRadius: 8, padding: '32px 20px', textAlign: 'center', marginBottom: 16, cursor: 'pointer' }}
                onClick={() => fileRef.current?.click()}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>↑</div>
                <div style={{ fontSize: 12, color: '#737373', marginBottom: 4 }}>Click to select file</div>
                <div style={{ fontSize: 10, color: '#3D3D3D' }}>.pdf, .docx, .txt, .md, .json, .csv, .xlsx</div>
              </div>
              <input ref={fileRef} type="file" accept=".pdf,.docx,.txt,.md,.json,.csv,.xlsx"
                onChange={handleUpload} style={{ display: 'none' }} />
              <div style={{ fontSize: 10, color: '#3D3D3D', textAlign: 'center' }}>File will be processed and added to your project</div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Artifact Row ─────────────────────────────────────────────────────────────
function ArtifactRow({ artifact, meta, generating, onOpen, onGenerate, onDelete, onArtifactUpdate }) {
  const [expanded, setExpanded] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const fileUrls = artifact.file_urls || {}
  const hasFiles = Object.keys(fileUrls).length > 0
  const formats = FORMAT_MAP[artifact.artifact_type] || ['pdf', 'json']

  async function handleDelete() {
    setDeleting(true)
    try {
      const res = await fetch(`${API}/api/artifacts/${artifact.id}`, { method: 'DELETE' })
      if (res.ok) {
        onDelete?.(artifact.id)
      }
    } catch (e) { console.error(e) }
    finally { setDeleting(false); setConfirmDelete(false) }
  }

  return (
    <div style={{ borderBottom: '0.5px solid #111' }}>
      {/* Row */}
      <div
        style={{ padding: '10px 16px', cursor: 'pointer', transition: 'background 0.1s' }}
        onMouseEnter={e => e.currentTarget.style.background = '#111'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          {/* Status dot */}
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: STATUS_DOT[artifact.status] || '#525252', flexShrink: 0, marginTop: 4 }} />

          <div style={{ flex: 1, minWidth: 0 }} onClick={() => onOpen(artifact)}>
            <div style={{ fontSize: 12, color: '#D4D4D4', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.4 }}>
              {artifact.title.replace(/^.*?—\s*/, '')}
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 3, alignItems: 'center' }}>
              <span style={{ fontSize: 9, color: STATUS_DOT[artifact.status], textTransform: 'capitalize', fontWeight: 600 }}>{artifact.status}</span>
              <span style={{ fontSize: 9, color: '#3D3D3D' }}>v{artifact.version}</span>
              {hasFiles && <span style={{ fontSize: 9, color: '#3D3D3D' }}>· {Object.keys(fileUrls).length} files</span>}
            </div>
          </div>

          {/* Delete button */}
          {!confirmDelete ? (
            <button onClick={e => { e.stopPropagation(); setConfirmDelete(true) }}
              style={{ background: 'none', border: 'none', color: '#3D3D3D', cursor: 'pointer', fontSize: 13, padding: '0 3px', flexShrink: 0, lineHeight: 1 }}
              onMouseEnter={e => e.currentTarget.style.color = '#F87171'}
              onMouseLeave={e => e.currentTarget.style.color = '#3D3D3D'}
              title="Delete artifact">
              🗑
            </button>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
              <span style={{ fontSize: 9, color: '#F87171' }}>Delete?</span>
              <button onClick={e => { e.stopPropagation(); logAction('artifact.deleted', { artifactId: artifact.id }); handleDelete() }} disabled={deleting}
                style={{ background: '#2A0A0A', color: '#F87171', border: '0.5px solid #5F1E1E', borderRadius: 3, fontSize: 9, padding: '2px 6px', cursor: 'pointer', fontFamily: 'inherit' }}>
                {deleting ? '…' : 'Yes'}
              </button>
              <button onClick={e => { e.stopPropagation(); logAction('artifact.delete_cancelled', { artifactId: artifact.id }); setConfirmDelete(false) }}
                style={{ background: '#1A1A1A', color: '#525252', border: '0.5px solid #2A2A2A', borderRadius: 3, fontSize: 9, padding: '2px 6px', cursor: 'pointer', fontFamily: 'inherit' }}>
                No
              </button>
            </div>
          )}

          <button onClick={() => { logAction('artifact.panel_toggled', { expanded: !expanded }); setExpanded(v => !v) }}
            style={{ background: 'none', border: 'none', color: '#3D3D3D', cursor: 'pointer', fontSize: 12, padding: 0, lineHeight: 1, flexShrink: 0, transition: 'transform 0.15s', transform: expanded ? 'rotate(180deg)' : 'none' }}>
            ▾
          </button>
        </div>
      </div>

      {/* Expanded: download buttons */}
      {expanded && (
        <div style={{ padding: '0 16px 12px 30px' }}>
          <div style={{ fontSize: 10, color: '#525252', marginBottom: 8 }}>Downloads</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {formats.map(fmt => {
              const url = fileUrls[fmt]
              return url ? (
                <a key={fmt} href={url} download={`${artifact.title.replace(/[^a-z0-9]/gi, '_')}.${fmt}`} target="_blank" rel="noreferrer"
                  onClick={() => logAction('artifact.downloaded', { artifactId: artifact.id, format: fmt })}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, color: '#A3A3A3', background: '#161616', border: '0.5px solid #2A2A2A', borderRadius: 4, padding: '3px 8px', textDecoration: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#1E1E1E'; e.currentTarget.style.color = '#D4D4D4' }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#161616'; e.currentTarget.style.color = '#A3A3A3' }}>
                  {FORMAT_ICONS[fmt]} {FORMAT_LABELS[fmt]}
                </a>
              ) : (
                <span key={fmt} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, color: '#3D3D3D', background: '#111', border: '0.5px solid #1A1A1A', borderRadius: 4, padding: '3px 8px' }}>
                  {FORMAT_ICONS[fmt]} {FORMAT_LABELS[fmt]}
                </span>
              )
            })}
          </div>
          {!hasFiles && (
            <button onClick={() => { logAction('artifact.files_generated', { artifactId: artifact.id }); onGenerate() }} disabled={generating}
              style={{ marginTop: 8, fontSize: 10, color: generating ? '#525252' : meta.color, background: 'none', border: `0.5px solid ${generating ? '#2A2A2A' : meta.color + '44'}`, borderRadius: 4, padding: '4px 10px', cursor: generating ? 'default' : 'pointer', fontFamily: 'inherit' }}>
              {generating ? 'Generating…' : '⬇ Generate files'}
            </button>
          )}
          <button onClick={() => { logAction('artifact.opened', { artifactId: artifact.id }); onOpen(artifact) }}
            style={{ display: 'block', marginTop: 8, fontSize: 10, color: '#525252', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline' }}>
            Open document ↗
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Main ArtifactPanel ───────────────────────────────────────────────────────
export default function ArtifactPanel({ artifacts = [], conversationId, onOpen, onClose, onArtifactUpdate, onGenerateArtifact, onUploadFile }) {
  const [search, setSearch] = useState('')
  const [generating, setGenerating] = useState({})
  const [showAddModal, setShowAddModal] = useState(false)
  const [localArtifacts, setLocalArtifacts] = useState(artifacts)

  // Sync external artifact changes in
  React.useEffect(() => { setLocalArtifacts(artifacts) }, [artifacts])

  const active = localArtifacts.filter(a => a.status !== 'superseded' && a.status !== 'deleted')
  const filtered = active.filter(a =>
    !search || a.title.toLowerCase().includes(search.toLowerCase())
  )

  const approvedCount = active.filter(a => a.status === 'approved').length
  const allApproved = active.length > 0 && approvedCount === active.length

  // Group by type preserving order
  const typeOrder = Object.keys(TYPE_META)
  const grouped = {}
  filtered.forEach(a => {
    if (!grouped[a.artifact_type]) grouped[a.artifact_type] = []
    grouped[a.artifact_type].push(a)
  })
  const sortedTypes = Object.keys(grouped).sort((a, b) => typeOrder.indexOf(a) - typeOrder.indexOf(b))

  async function handleGenerateFiles(artifact) {
    setGenerating(prev => ({ ...prev, [artifact.id]: true }))
    try {
      const res = await fetch(`${API}/api/artifacts/${artifact.id}/files`, { method: 'POST' })
      const data = await res.json()
      if (data.artifact) {
        onArtifactUpdate?.(data.artifact)
        setLocalArtifacts(prev => prev.map(a => a.id === data.artifact.id ? data.artifact : a))
      }
    } catch (e) { console.error(e) }
    finally { setGenerating(prev => ({ ...prev, [artifact.id]: false })) }
  }

  function handleDelete(id) {
    setLocalArtifacts(prev => prev.filter(a => a.id !== id))
    onArtifactUpdate?.({ id, _deleted: true })
  }

  function handleArtifactCreated(artifact) {
    setLocalArtifacts(prev => [...prev, artifact])
    onArtifactUpdate?.(artifact)
  }

  return (
    <div style={{
      width: 300, height: '100%', background: '#0A0A0A',
      borderLeft: '0.5px solid #1A1A1A', display: 'flex', flexDirection: 'column',
      flexShrink: 0,
    }}>
      {/* Header */}
      <div style={{ padding: '16px 16px 12px', borderBottom: '0.5px solid #1A1A1A', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#D4D4D4', letterSpacing: '0.01em' }}>Project Files</div>
            <div style={{ fontSize: 10, color: '#525252', marginTop: 2 }}>
              {approvedCount}/{active.length} approved
              {allApproved && active.length > 0 && <span style={{ color: '#34D399', marginLeft: 6 }}>· Ready to build</span>}
            </div>
          </div>
          <button onClick={() => { logAction('artifact.panel_closed', {}); onClose() }}
            style={{ background: '#1A1A1A', border: '0.5px solid #2A2A2A', borderRadius: 5, color: '#525252', cursor: 'pointer', fontSize: 14, padding: '4px 7px', lineHeight: 1 }}>✕</button>
        </div>

        {/* Add Document button */}
        <button onClick={() => { logAction('artifact.add_modal_opened', {}); setShowAddModal(true) }}
          style={{ width: '100%', background: '#161616', border: '0.5px solid #2A2A2A', borderRadius: 6, color: '#A78BFA', fontSize: 11, padding: '7px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          onMouseEnter={e => e.currentTarget.style.background = '#1E1E1E'}
          onMouseLeave={e => e.currentTarget.style.background = '#161616'}>
          + Add Document
        </button>

        <input value={search} onChange={e => { logAction('artifact.searched', { query: e.target.value.slice(0, 50) }); setSearch(e.target.value) }}
          placeholder="Search documents…"
          style={{ width: '100%', background: '#161616', border: '0.5px solid #2A2A2A', borderRadius: 5, color: '#D4D4D4', fontSize: 11, padding: '6px 10px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
        />
      </div>

      {/* Document list */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {sortedTypes.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: '#3D3D3D', fontSize: 12 }}>
            No documents yet.<br />Generate a brief to create documents.
          </div>
        ) : (
          sortedTypes.map(type => {
            const meta = TYPE_META[type] || {}
            return (
              <div key={type}>
                {/* Type header */}
                <div style={{ padding: '10px 16px 6px', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11 }}>{meta.icon}</span>
                  <span style={{ fontSize: 9, color: meta.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{meta.label}</span>
                  <div style={{ flex: 1, height: 1, background: `${meta.color}18` }} />
                </div>

                {grouped[type].map(artifact => (
                  <ArtifactRow
                    key={artifact.id}
                    artifact={artifact}
                    meta={meta}
                    generating={!!generating[artifact.id]}
                    onOpen={onOpen}
                    onGenerate={() => handleGenerateFiles(artifact)}
                    onDelete={handleDelete}
                    onArtifactUpdate={updated => {
                      setLocalArtifacts(prev => prev.map(a => a.id === updated.id ? updated : a))
                      onArtifactUpdate?.(updated)
                    }}
                  />
                ))}
              </div>
            )
          })
        )}
      </div>

      {/* Footer */}
      {active.length > 0 && (
        <div style={{ padding: '10px 16px', borderTop: '0.5px solid #1A1A1A', flexShrink: 0 }}>
          {allApproved ? (
            <div style={{ fontSize: 11, color: '#34D399', fontWeight: 600, textAlign: 'center' }}>
              ✓ All {active.length} documents approved — ready to build
            </div>
          ) : (
            <div style={{ fontSize: 10, color: '#525252', textAlign: 'center' }}>
              Approve all documents before building
            </div>
          )}
        </div>
      )}

      {/* Add Document Modal */}
      {showAddModal && (
        <AddDocumentModal
          conversationId={conversationId}
          onClose={() => setShowAddModal(false)}
          onArtifactCreated={handleArtifactCreated}
          onGenerateArtifact={onGenerateArtifact}
          onUploadFile={onUploadFile}
        />
      )}
    </div>
  )
}
