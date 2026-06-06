import React, { useState, useMemo, useEffect } from 'react'
import { SandpackProvider, SandpackCodeViewer, useSandpack } from '@codesandbox/sandpack-react'

/**
 * CodePane — IDE-style syntax-highlighted view of the selected file. Reuses
 * Sandpack's CodeMirror viewer (already a dependency) so JS/JSX/CSS/HTML/JSON
 * all get proper token colors, line numbers, and a dark IDE theme — no extra
 * package needed. Driven by the parent's `selected` path.
 */
function CodePane({ selected }) {
  const { sandpack } = useSandpack()
  useEffect(() => {
    if (selected && sandpack.files[selected]) sandpack.setActiveFile(selected)
  }, [selected, sandpack])
  return (
    <SandpackCodeViewer showLineNumbers wrapContent />
  )
}

/**
 * AppProjectViewer — browse a generated multi-file project (the { path: content }
 * files map from the staged generation engine). File tree on the left, read-only
 * code on the right. Aria-styled (dark). No external deps.
 *
 * Reused by Phase 3 (alongside the Sandpack live-preview tab).
 *
 * Props: { files, entry, title, summary }
 */

// Build a nested tree { name, path, isFile, children } from flat "/a/b/c.js" paths.
function buildTree(paths) {
  const root = { name: '', path: '', isFile: false, children: {} }
  for (const full of paths) {
    const parts = full.replace(/^\//, '').split('/')
    let node = root
    let acc = ''
    parts.forEach((part, i) => {
      acc += '/' + part
      const isFile = i === parts.length - 1
      if (!node.children[part]) {
        node.children[part] = { name: part, path: acc, isFile, children: {} }
      }
      node = node.children[part]
    })
  }
  const toArr = (node) => Object.values(node.children)
    .sort((a, b) => (a.isFile === b.isFile ? a.name.localeCompare(b.name) : a.isFile ? 1 : -1))
    .map(n => ({ ...n, children: toArr(n) }))
  return toArr(root)
}

function TreeNode({ node, depth, selected, onSelect, openFolders, toggleFolder }) {
  const isOpen = openFolders[node.path] !== false // default open
  if (node.isFile) {
    const active = selected === node.path
    return (
      <div
        onClick={() => onSelect(node.path)}
        style={{
          padding: '3px 8px', paddingLeft: 10 + depth * 14, cursor: 'pointer',
          fontSize: 12, color: active ? '#E5E5E5' : '#A3A3A3',
          background: active ? '#1C1C1C' : 'transparent', borderRadius: 4,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}
        title={node.path}
      >
        <span style={{ opacity: 0.6, marginRight: 6 }}>{fileIcon(node.name)}</span>{node.name}
      </div>
    )
  }
  return (
    <div>
      <div
        onClick={() => toggleFolder(node.path)}
        style={{ padding: '3px 8px', paddingLeft: 10 + depth * 14, cursor: 'pointer', fontSize: 12, color: '#737373', userSelect: 'none' }}
      >
        <span style={{ marginRight: 6 }}>{isOpen ? '▾' : '▸'}</span>{node.name}/
      </div>
      {isOpen && node.children.map(c => (
        <TreeNode key={c.path} node={c} depth={depth + 1} selected={selected} onSelect={onSelect} openFolders={openFolders} toggleFolder={toggleFolder} />
      ))}
    </div>
  )
}

function fileIcon(name) {
  if (name.endsWith('.jsx') || name.endsWith('.js')) return '⬡'
  if (name.endsWith('.ts') || name.endsWith('.tsx')) return '⬡'
  if (name.endsWith('.html')) return '◆'
  if (name.endsWith('.json')) return '{}'
  if (name.endsWith('.css')) return '▣'
  return '·'
}

export default function AppProjectViewer({ files = {}, entry = '/App.js', title = 'Generated App', summary = '' }) {
  const paths = useMemo(() => Object.keys(files), [files])
  const tree = useMemo(() => buildTree(paths), [paths])
  const [selected, setSelected] = useState(files[entry] ? entry : paths[0] || '')
  const [openFolders, setOpenFolders] = useState({})

  const toggleFolder = (p) => setOpenFolders(prev => ({ ...prev, [p]: prev[p] === false ? true : false }))

  if (!paths.length) {
    return <div style={{ padding: 24, color: '#737373', fontSize: 13 }}>No files in this project yet.</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0D0D0D', border: '0.5px solid #1E1E1E', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', borderBottom: '0.5px solid #1E1E1E' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#F5F5F5' }}>{title}</div>
        {summary && <div style={{ fontSize: 12, color: '#737373', marginTop: 4, lineHeight: 1.5 }}>{summary}</div>}
        <div style={{ fontSize: 11, color: '#525252', marginTop: 4 }}>{paths.length} files</div>
      </div>
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <div style={{ width: 240, borderRight: '0.5px solid #1E1E1E', overflowY: 'auto', padding: '8px 4px', flexShrink: 0 }}>
          {tree.map(n => (
            <TreeNode key={n.path} node={n} depth={0} selected={selected} onSelect={setSelected} openFolders={openFolders} toggleFolder={toggleFolder} />
          ))}
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          <div style={{ padding: '8px 14px', borderBottom: '0.5px solid #161616', fontSize: 11, color: '#737373', fontFamily: 'ui-monospace, monospace', background: '#0D0D0D', flexShrink: 0 }}>{selected}</div>
          <div className="aria-sp-code" style={{ flex: 1, minHeight: 0, overflow: 'auto', background: '#011627' }}>
            <style>{`
              .aria-sp-code, .aria-sp-code .sp-wrapper, .aria-sp-code .sp-stack,
              .aria-sp-code .sp-code-viewer, .aria-sp-code .cm-editor { height: 100% !important; }
              .aria-sp-code .cm-scroller { overflow: auto; }
            `}</style>
            {/* IDE-style highlighted viewer. Keyed on the file set so a regenerated
                project remounts with fresh content. */}
            <SandpackProvider
              key={paths.join('|')}
              template="react"
              theme="dark"
              files={files}
              options={{ activeFile: files[selected] ? selected : undefined }}
            >
              <CodePane selected={selected} />
            </SandpackProvider>
          </div>
        </div>
      </div>
    </div>
  )
}
