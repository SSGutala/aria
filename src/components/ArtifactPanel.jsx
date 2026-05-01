import React, { useState } from 'react'

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

import { API_URL as API } from '../lib/api'

export default function ArtifactPanel({ artifacts = [], onOpen, onClose, onArtifactUpdate }) {
  const [search, setSearch] = useState('')
  const [generating, setGenerating] = useState({})

  const active = artifacts.filter(a => a.status !== 'superseded')
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
      if (data.artifact) onArtifactUpdate?.(data.artifact)
    } catch (e) { console.error(e) }
    finally { setGenerating(prev => ({ ...prev, [artifact.id]: false })) }
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
          <button onClick={onClose}
            style={{ background: '#1A1A1A', border: '0.5px solid #2A2A2A', borderRadius: 5, color: '#525252', cursor: 'pointer', fontSize: 14, padding: '4px 7px', lineHeight: 1 }}>✕</button>
        </div>

        <input value={search} onChange={e => setSearch(e.target.value)}
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
    </div>
  )
}

function ArtifactRow({ artifact, meta, generating, onOpen, onGenerate }) {
  const [expanded, setExpanded] = useState(false)
  const fileUrls = artifact.file_urls || {}
  const hasFiles = Object.keys(fileUrls).length > 0
  const formats = FORMAT_MAP[artifact.artifact_type] || ['pdf', 'json']

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
              {/* Strip the "AppName — " prefix */}
              {artifact.title.replace(/^.*?—\s*/, '')}
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 3, alignItems: 'center' }}>
              <span style={{ fontSize: 9, color: STATUS_DOT[artifact.status], textTransform: 'capitalize', fontWeight: 600 }}>{artifact.status}</span>
              <span style={{ fontSize: 9, color: '#3D3D3D' }}>v{artifact.version}</span>
              {hasFiles && <span style={{ fontSize: 9, color: '#3D3D3D' }}>· {Object.keys(fileUrls).length} files</span>}
            </div>
          </div>

          <button onClick={() => setExpanded(v => !v)}
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
            <button onClick={onGenerate} disabled={generating}
              style={{ marginTop: 8, fontSize: 10, color: generating ? '#525252' : meta.color, background: 'none', border: `0.5px solid ${generating ? '#2A2A2A' : meta.color + '44'}`, borderRadius: 4, padding: '4px 10px', cursor: generating ? 'default' : 'pointer', fontFamily: 'inherit' }}>
              {generating ? 'Generating…' : '⬇ Generate files'}
            </button>
          )}
          <button onClick={() => onOpen(artifact)}
            style={{ display: 'block', marginTop: 8, fontSize: 10, color: '#525252', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline' }}>
            Open document ↗
          </button>
        </div>
      )}
    </div>
  )
}
