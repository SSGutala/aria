import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { logAction } from '../lib/devlog'
import { useProfile } from '../hooks/useProfile'

const glareGradient = 'linear-gradient(110deg, #4A4A4A 0%, #8A8A8A 18%, #FFFFFF 34%, #E8E8E8 44%, #9A9A9A 58%, #5A5A5A 78%, #888888 100%)'

function Dot({ variant }) {
  return (
    <div style={{
      width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
      background: variant === 'deployed' ? '#34D399' : variant === 'active' ? '#A3A3A3' : '#2A2A2A',
      border: variant === 'deployed' ? '1px solid #34D39966' : variant === 'active' ? '1px solid #3D3D3D' : '1px solid #2A2A2A',
    }} />
  )
}

function PinDot() {
  return (
    <svg width="9" height="9" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0, color: '#9CA3AF' }} title="Pinned">
      <path d="M6 1.5l1.2 2.6 2.8.3-2.1 1.9.6 2.8L6 9.6 3.5 9.1l.6-2.8L2 4.4l2.8-.3L6 1.5z" fill="currentColor"/>
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
      <path d="M1.5 3h9M4.5 3V2h3v1M2.5 3l.5 7h6l.5-7H2.5z" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function Tag({ label, color }) {
  const colors = {
    chat: { bg: '#0D1A2A', text: '#60A5FA', border: '#1E3A5F' },
    app:  { bg: '#0D2A1A', text: '#34D399', border: '#1E5F3A' },
  }
  const c = colors[color] || colors.chat
  return (
    <span style={{
      fontSize: 9, fontWeight: 600, letterSpacing: '0.04em',
      textTransform: 'uppercase',
      background: c.bg, color: c.text, border: `0.5px solid ${c.border}`,
      borderRadius: 4, padding: '1px 5px', flexShrink: 0,
    }}>{label}</span>
  )
}

function ConfirmDialog({ title, message, onConfirm, onCancel }) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onCancel}
    >
      <div onClick={e => e.stopPropagation()} style={{
        background: '#161616', border: '0.5px solid #2A2A2A', borderRadius: 12,
        padding: '24px', maxWidth: 340, width: '90vw',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}>
        <h3 style={{ margin: '0 0 8px', color: '#F5F5F5', fontSize: 14, fontWeight: 600 }}>{title}</h3>
        <p style={{ margin: '0 0 20px', color: '#A8A8A8', fontSize: 12, lineHeight: 1.6 }}>{message}</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{ background: '#FFFFFF', color: '#111111', border: '0.5px solid #D1D5DB', borderRadius: 7, padding: '8px 16px', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
          <button onClick={onConfirm} style={{ background: '#991B1B', color: '#FFFFFF', border: 'none', borderRadius: 7, padding: '8px 16px', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>Delete</button>
        </div>
      </div>
    </div>
  )
}

function InlineRename({ value, onSave, onCancel }) {
  const [val, setVal] = useState(value)
  const ref = useRef(null)
  useEffect(() => { ref.current?.focus(); ref.current?.select() }, [])

  function commit() {
    const trimmed = val.trim()
    if (trimmed && trimmed !== value) onSave(trimmed)
    else onCancel()
  }

  return (
    <input
      ref={ref}
      value={val}
      onChange={e => setVal(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') onCancel() }}
      onClick={e => e.stopPropagation()}
      style={{
        flex: 1, background: 'transparent', border: 'none', outline: 'none',
        borderBottom: '0.5px solid #3D3D3D',
        color: '#F5F5F5', fontSize: 12, fontFamily: 'inherit',
        padding: '0 2px', minWidth: 0,
      }}
    />
  )
}

function Chevron({ open }) {
  return (
    <svg width="9" height="9" viewBox="0 0 10 10" fill="none" style={{ flexShrink: 0, transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.12s' }}>
      <path d="M3.5 2l3 3-3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

/**
 * KebabMenu — the ⋮ control on each chat/app/folder row. Renders a small dropdown
 * with Rename / Pin / (Add to project) / Delete. The parent owns which menu is open
 * (via `open`/`onToggle`) so only one is visible at a time.
 */
function KebabMenu({ open, onToggle, onRename, onPin, pinned, onDelete, folders, onMove, currentFolderId, showProjectMove = true }) {
  const [showFolders, setShowFolders] = useState(false)
  useEffect(() => { if (!open) setShowFolders(false) }, [open])

  const itemStyle = (danger) => ({
    width: '100%', textAlign: 'left', background: 'transparent', border: 'none',
    color: danger ? '#F87171' : '#D4D4D4', fontSize: 11.5, fontFamily: 'inherit',
    padding: '7px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, borderRadius: 5,
  })
  const hov = (e, on) => { e.currentTarget.style.background = on ? '#1F1F1F' : 'transparent' }

  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <button
        onClick={e => { e.stopPropagation(); onToggle() }}
        style={{ background: 'transparent', border: 'none', color: '#9A9A9A', cursor: 'pointer', padding: '2px 4px', borderRadius: 4, display: 'flex', alignItems: 'center', lineHeight: 1, fontSize: 14 }}
        onMouseEnter={e => e.currentTarget.style.color = '#FFFFFF'}
        onMouseLeave={e => e.currentTarget.style.color = '#9A9A9A'}
        title="More"
      >⋮</button>
      {open && (
        <>
          <div onClick={e => { e.stopPropagation(); onToggle() }} style={{ position: 'fixed', inset: 0, zIndex: 60 }} />
          <div onClick={e => e.stopPropagation()} style={{
            position: 'absolute', right: 0, top: 'calc(100% + 2px)', zIndex: 61, minWidth: 158,
            background: '#161616', border: '0.5px solid #2A2A2A', borderRadius: 8, padding: 4,
            boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
          }}>
            <button style={itemStyle(false)} onMouseEnter={e => hov(e, true)} onMouseLeave={e => hov(e, false)}
              onClick={() => { onToggle(); onRename() }}>Rename</button>
            <button style={itemStyle(false)} onMouseEnter={e => hov(e, true)} onMouseLeave={e => hov(e, false)}
              onClick={() => { onToggle(); onPin() }}>{pinned ? 'Unpin' : 'Pin'}</button>

            {showProjectMove && (
              <>
                <button style={itemStyle(false)} onMouseEnter={e => hov(e, true)} onMouseLeave={e => hov(e, false)}
                  onClick={() => setShowFolders(v => !v)}>
                  <span style={{ flex: 1 }}>Add to project</span>
                  <Chevron open={showFolders} />
                </button>
                {showFolders && (
                  <div style={{ paddingLeft: 6, borderLeft: '0.5px solid #262626', margin: '2px 0 2px 8px', maxHeight: 160, overflowY: 'auto' }}>
                    {folders.length === 0 && (
                      <div style={{ fontSize: 10.5, color: '#6B7280', padding: '6px 8px' }}>No projects yet</div>
                    )}
                    {folders.map(f => (
                      <button key={f.id} style={{ ...itemStyle(false), opacity: currentFolderId === f.id ? 0.5 : 1 }}
                        disabled={currentFolderId === f.id}
                        onMouseEnter={e => hov(e, true)} onMouseLeave={e => hov(e, false)}
                        onClick={() => { onToggle(); onMove(f.id) }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                      </button>
                    ))}
                    {currentFolderId && (
                      <button style={itemStyle(false)} onMouseEnter={e => hov(e, true)} onMouseLeave={e => hov(e, false)}
                        onClick={() => { onToggle(); onMove(null) }}>Remove from project</button>
                    )}
                  </div>
                )}
              </>
            )}

            <div style={{ height: 0.5, background: '#262626', margin: '4px 6px' }} />
            <button style={itemStyle(true)} onMouseEnter={e => hov(e, true)} onMouseLeave={e => hov(e, false)}
              onClick={() => { onToggle(); onDelete() }}>Delete</button>
          </div>
        </>
      )}
    </div>
  )
}

export default function Sidebar({ user, conversations, apps, appProjects = [], onOpenProject, onDeleteProject, onProjectsChange, onConversationsChange, onAppsChange, onConversationRename, onAppRename, onClose, folders = [], onCreateFolder, onRenameFolder, onDeleteFolder, onMoveToFolder, onPinItem, onNewApp }) {
  const navigate = useNavigate()
  const { convId } = useParams()
  const { profile } = useProfile()

  const [hoveredId, setHoveredId]       = useState(null)
  const [renamingId, setRenamingId]     = useState(null)
  const [confirmDelete, setConfirmDelete]         = useState(null)
  const [showTrash, setShowTrash]                 = useState(false)
  const [trashedItems, setTrashedItems]           = useState([]) // { id, title, type, deleted_at }
  const [confirmClearTrash, setConfirmClearTrash] = useState(false)
  const [confirmPermDelete, setConfirmPermDelete] = useState(null)
  const [confirmClearAll, setConfirmClearAll]     = useState(null) // 'chats' | 'apps' | 'all'

  // ── Folder / menu UI state ──────────────────────────────────────────────
  const [showNewMenu, setShowNewMenu]       = useState(false)   // "+ New" dropdown
  const [openMenu, setOpenMenu]             = useState(null)    // key of the kebab menu that's open
  const [collapsedFolders, setCollapsedFolders] = useState(() => new Set()) // folder ids collapsed
  const [confirmDeleteFolder, setConfirmDeleteFolder] = useState(null)

  useEffect(() => { if (showTrash && user) loadTrash() }, [showTrash, user])

  const toggleFolder = (fid) => setCollapsedFolders(prev => {
    const next = new Set(prev)
    if (next.has(fid)) next.delete(fid); else next.add(fid)
    return next
  })

  // Pinned items float to the top of whatever section they're in.
  const sortPinned = (arr) => [...arr].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0))
  const fid = (x) => x.folder_id || null

  // An app "branches" from a chat when its conversation_id points at a visible chat.
  // Apps built via "New app" point at a hidden app-shell conversation (kind='app',
  // already filtered out of `conversations`), so those read as standalone.
  const chatIdSet = new Set(conversations.map(c => c.id))
  const isBranchApp = (p) => p.conversation_id && chatIdSet.has(p.conversation_id)
  const appsForChat = (cid) => sortPinned(appProjects.filter(p => p.conversation_id === cid))
  const standaloneApps = appProjects.filter(p => !isBranchApp(p))

  const unfiledChats = sortPinned(conversations.filter(c => !fid(c)))
  const unfiledApps  = sortPinned(standaloneApps.filter(p => !fid(p)))
  const chatsInFolder = (id) => sortPinned(conversations.filter(c => fid(c) === id))
  const appsInFolder  = (id) => sortPinned(standaloneApps.filter(p => fid(p) === id))
  const sortedFolders = sortPinned(folders)

  // ── Row renderers (shared between Recent sections and folder contents) ────
  // A chat renders its own row PLUS any apps that branched from it, nested below.
  const renderChatRow = (conv, indent = 0) => {
    const isActive   = conv.id === convId
    const isHovered  = hoveredId === conv.id
    const hasApp     = apps.some(a => a.conversation_id === conv.id)
    const isRenaming = renamingId === conv.id
    const menuKey    = `chat-${conv.id}`
    const branches   = appsForChat(conv.id)
    return (
      <div key={conv.id}>
        <div
          onMouseEnter={() => setHoveredId(conv.id)}
          onMouseLeave={() => setHoveredId(null)}
          onClick={() => { if (!isRenaming) { logAction('conversation.opened', { conversationId: conv.id }); navigate(`/workspace/${conv.id}`) } }}
          onDoubleClick={() => setRenamingId(conv.id)}
          style={{
            padding: '7px 10px', borderRadius: 6, fontSize: 12, marginLeft: indent,
            display: 'flex', alignItems: 'center', gap: 8, cursor: isRenaming ? 'text' : 'pointer',
            background: isActive ? '#1F1F1F' : isHovered ? '#141414' : 'transparent',
            color: isActive ? '#FFFFFF' : '#B5B5B5',
            border: isActive ? '0.5px solid #2E2E2E' : '0.5px solid transparent', marginBottom: 1,
          }}
        >
          {conv.pinned && <PinDot />}
          <Dot variant={hasApp || branches.length ? 'deployed' : isActive ? 'active' : 'default'} />
          {isRenaming ? (
            <InlineRename value={conv.title} onSave={title => renameConversation(conv.id, title)} onCancel={() => setRenamingId(null)} />
          ) : (
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{conv.title}</span>
          )}
          {(isHovered || openMenu === menuKey) && !isRenaming && (
            <KebabMenu
              open={openMenu === menuKey}
              onToggle={() => setOpenMenu(openMenu === menuKey ? null : menuKey)}
              onRename={() => setRenamingId(conv.id)}
              onPin={() => onPinItem?.('chat', conv.id, !conv.pinned)}
              pinned={conv.pinned}
              onDelete={() => requestDelete(conv.id, conv.title, 'chat')}
              folders={sortedFolders}
              currentFolderId={fid(conv)}
              onMove={(folderId) => onMoveToFolder?.('chat', conv.id, folderId)}
            />
          )}
        </div>
        {branches.map(proj => renderProjectRow(proj, { indent: indent + 14, branch: true }))}
      </div>
    )
  }

  const renderProjectRow = (proj, opts = {}) => {
    const { indent = 0, branch = false } = opts
    const isHovered = hoveredId === `proj-${proj.id}`
    const isRenaming = renamingId === `proj-${proj.id}`
    const hasErrors = (proj.generation_errors || []).length > 0
    const menuKey = `proj-${proj.id}`
    return (
      <div
        key={proj.id}
        onMouseEnter={() => setHoveredId(`proj-${proj.id}`)}
        onMouseLeave={() => setHoveredId(null)}
        onClick={() => { if (!isRenaming) { logAction('app.project_reopened', { projectId: proj.id }); onOpenProject?.(proj) } }}
        onDoubleClick={() => setRenamingId(`proj-${proj.id}`)}
        style={{
          padding: '6px 10px', borderRadius: 6, fontSize: 12, marginLeft: indent,
          display: 'flex', alignItems: 'center', gap: 7, cursor: isRenaming ? 'text' : 'pointer',
          color: '#9A9A9A', marginBottom: 1,
          background: isHovered ? '#141414' : 'transparent', border: '0.5px solid transparent',
        }}
        title={proj.summary || proj.title}
      >
        {branch && <span style={{ color: '#3D3D3D', fontSize: 11, flexShrink: 0, marginRight: -2 }}>↳</span>}
        {proj.pinned && <PinDot />}
        <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: hasErrors ? '#F59E0B' : '#34D399' }} />
        {isRenaming ? (
          <InlineRename value={proj.title || 'Untitled App'} onSave={title => renameProject(proj.id, title)} onCancel={() => setRenamingId(null)} />
        ) : (
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{proj.title || 'Untitled App'}</span>
        )}
        {(isHovered || openMenu === menuKey) && !isRenaming && (
          <KebabMenu
            open={openMenu === menuKey}
            onToggle={() => setOpenMenu(openMenu === menuKey ? null : menuKey)}
            onRename={() => setRenamingId(`proj-${proj.id}`)}
            onPin={() => onPinItem?.('app', proj.id, !proj.pinned)}
            pinned={proj.pinned}
            onDelete={() => requestDelete(proj.id, proj.title || 'Untitled App', 'project')}
            folders={sortedFolders}
            currentFolderId={fid(proj)}
            onMove={(folderId) => onMoveToFolder?.('app', proj.id, folderId)}
            showProjectMove={!branch}
          />
        )}
      </div>
    )
  }

  const sectionHeader = (label, action) => (
    <div style={{ padding: '6px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ fontSize: 10, color: '#9CA3AF', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</span>
      {action}
    </div>
  )

  async function loadTrash() {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    const [{ data: convs }, { data: appsData }, { data: projData }] = await Promise.all([
      supabase.from('conversations').select('id,title,deleted_at').eq('user_id', user.id).eq('deleted', true).gte('deleted_at', cutoff).order('deleted_at', { ascending: false }),
      supabase.from('generated_apps').select('id,title,deleted_at').eq('user_id', user.id).eq('deleted', true).gte('deleted_at', cutoff).order('deleted_at', { ascending: false }),
      // app_projects has no `deleted_at` column — it soft-deletes via status, and
      // `updated_at` records when that happened. Use it as the deletion timestamp.
      supabase.from('app_projects').select('id,title,updated_at').eq('user_id', user.id).eq('status', 'deleted').gte('updated_at', cutoff).order('updated_at', { ascending: false }),
    ])

    const all = [
      ...(convs || []).map(c => ({ ...c, type: 'chat' })),
      ...(appsData || []).map(a => ({ ...a, type: 'app' })),
      ...(projData || []).map(p => ({ id: p.id, title: p.title, deleted_at: p.updated_at, type: 'project' })),
    ].sort((a, b) => new Date(b.deleted_at) - new Date(a.deleted_at))

    setTrashedItems(all)
  }

  async function createConversation() {
    // Freeze the user's current role context onto the new chat so it stays
    // consistent even if they later change their profile role.
    const roleSnapshot = profile ? {
      role_context: profile.selected_role || null,
      custom_role_context: profile.custom_role || null,
      seniority_context: profile.seniority_level || null,
      intended_use_cases: profile.intended_use_cases || profile.use_cases || [],
      role_overridden: false,
    } : {}
    const { data, error } = await supabase.from('conversations')
      .insert({ user_id: user.id, title: 'New conversation', ...roleSnapshot })
      .select().single()
    if (!error && data) {
      logAction('conversation.new_created', { conversationId: data.id, role: profile?.selected_role })
      onConversationsChange()
      navigate(`/workspace/${data.id}`)
    }
  }

  function requestDelete(id, title, type) {
    setConfirmDelete({ id, title, type })
  }

  async function confirmDoDelete() {
    if (!confirmDelete) return
    const { id, type } = confirmDelete
    setConfirmDelete(null)
    if (type === 'project') { onDeleteProject?.(id); return }
    const table = type === 'app' ? 'generated_apps' : 'conversations'
    await supabase.from(table).update({ deleted: true, deleted_at: new Date().toISOString() }).eq('id', id)
    if (type === 'chat') {
      logAction('conversation.deleted', { conversationId: id })
      if (convId === id) navigate('/workspace')
      onConversationsChange()
    } else {
      logAction('app.deleted', { appId: id })
      onAppsChange()
    }
  }

  async function restoreItem(item) {
    if (item.type === 'project') {
      await supabase.from('app_projects').update({ status: 'ready', updated_at: new Date().toISOString() }).eq('id', item.id)
      await loadTrash()
      onProjectsChange?.()
      return
    }
    const table = item.type === 'app' ? 'generated_apps' : 'conversations'
    await supabase.from(table).update({ deleted: false, deleted_at: null }).eq('id', item.id)
    await loadTrash()
    if (item.type === 'chat') onConversationsChange(); else onAppsChange()
  }

  async function permanentlyDeleteItem(item) {
    const table = item.type === 'project' ? 'app_projects' : item.type === 'app' ? 'generated_apps' : 'conversations'
    await supabase.from(table).delete().eq('id', item.id)
    setConfirmPermDelete(null)
    await loadTrash()
    if (item.type === 'project') onProjectsChange?.()
  }

  async function clearAll(type) {
    if (type === 'chats' || type === 'all') {
      const ids = conversations.map(c => c.id)
      if (ids.length) {
        await supabase.from('conversations').update({ deleted: true, deleted_at: new Date().toISOString() }).in('id', ids)
      }
      navigate('/workspace')
      onConversationsChange()
    }
    if (type === 'apps' || type === 'all') {
      const ids = apps.map(a => a.id)
      if (ids.length) {
        await supabase.from('generated_apps').update({ deleted: true, deleted_at: new Date().toISOString() }).in('id', ids)
      }
      onAppsChange()
    }
    setConfirmClearAll(null)
  }

  async function clearTrash() {
    const chatIds = trashedItems.filter(i => i.type === 'chat').map(i => i.id)
    const appIds  = trashedItems.filter(i => i.type === 'app').map(i => i.id)
    const projIds = trashedItems.filter(i => i.type === 'project').map(i => i.id)
    await Promise.all([
      chatIds.length && supabase.from('conversations').delete().in('id', chatIds),
      appIds.length  && supabase.from('generated_apps').delete().in('id', appIds),
      projIds.length && supabase.from('app_projects').delete().in('id', projIds),
    ])
    setConfirmClearTrash(false)
    setTrashedItems([])
    onConversationsChange(); onAppsChange(); onProjectsChange?.()
  }

  async function renameConversation(id, title) {
    await supabase.from('conversations').update({ title }).eq('id', id)
    onConversationRename(id, title)
    setRenamingId(null)
  }

  async function renameApp(id, title) {
    await supabase.from('generated_apps').update({ title }).eq('id', id)
    onAppRename(id, title)
    setRenamingId(null)
  }

  async function renameProject(id, title) {
    await supabase.from('app_projects').update({ title, updated_at: new Date().toISOString() }).eq('id', id)
    onProjectsChange?.()
    setRenamingId(null)
  }

  const daysLeft = (deletedAt) => Math.max(0, 30 - Math.floor((Date.now() - new Date(deletedAt)) / 86400000))
  const initials = user?.email ? user.email.slice(0, 2).toUpperCase() : '??'

  return (
    <>
      {confirmDelete && (
        <ConfirmDialog
          title={confirmDelete.type === 'project' ? 'Delete app?' : `Delete ${confirmDelete.type === 'app' ? 'app' : 'conversation'}?`}
          message={`"${confirmDelete.title}" will be moved to Trash. You can recover it within 30 days.`}
          onConfirm={confirmDoDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
      {confirmClearTrash && (
        <ConfirmDialog
          title="Clear Trash?"
          message="All items in Trash will be permanently deleted. This cannot be undone."
          onConfirm={clearTrash}
          onCancel={() => setConfirmClearTrash(false)}
        />
      )}
      {confirmPermDelete && (
        <ConfirmDialog
          title="Delete permanently?"
          message={`"${confirmPermDelete.title}" will be gone forever. This cannot be undone.`}
          onConfirm={() => permanentlyDeleteItem(confirmPermDelete)}
          onCancel={() => setConfirmPermDelete(null)}
        />
      )}
      {confirmDeleteFolder && (
        <ConfirmDialog
          title="Delete project folder?"
          message={`"${confirmDeleteFolder.name}" will be deleted. Chats and apps inside it are NOT deleted — they just move back to Recent.`}
          onConfirm={() => { onDeleteFolder?.(confirmDeleteFolder.id); setConfirmDeleteFolder(null) }}
          onCancel={() => setConfirmDeleteFolder(null)}
        />
      )}
      {confirmClearAll && (
        <ConfirmDialog
          title={confirmClearAll === 'chats' ? 'Clear all chats?' : confirmClearAll === 'apps' ? 'Clear all apps?' : 'Clear everything?'}
          message={
            confirmClearAll === 'chats' ? `All ${conversations.length} chat${conversations.length !== 1 ? 's' : ''} will be moved to Trash. You can recover them within 30 days.`
            : confirmClearAll === 'apps' ? `All ${apps.length} app${apps.length !== 1 ? 's' : ''} will be moved to Trash. You can recover them within 30 days.`
            : `All ${conversations.length} chat${conversations.length !== 1 ? 's' : ''} and ${apps.length} app${apps.length !== 1 ? 's' : ''} will be moved to Trash. You can recover them within 30 days.`
          }
          onConfirm={() => clearAll(confirmClearAll)}
          onCancel={() => setConfirmClearAll(null)}
        />
      )}

      <div style={{ width: 220, flexShrink: 0, background: '#0A0A0A', borderRight: '0.5px solid #1A1A1A', display: 'flex', flexDirection: 'column', height: '100vh' }}>

        {/* Logo + New dropdown */}
        <div style={{ padding: '18px 16px 12px' }}>
          <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 16, fontWeight: 500, letterSpacing: '-0.4px', background: glareGradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>aria.</span>
            {onClose && (
              <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#3D3D3D', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '2px 4px' }}
                onMouseEnter={e => e.currentTarget.style.color = '#A3A3A3'}
                onMouseLeave={e => e.currentTarget.style.color = '#3D3D3D'}>✕</button>
            )}
          </div>
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowNewMenu(v => !v)}
              style={{ width: '100%', background: glareGradient, color: '#111111', border: '0.5px solid #484848', borderRadius: 7, fontSize: 12, fontWeight: 500, padding: '7px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontFamily: 'inherit' }}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M5 1v8M1 5h8" stroke="#111" strokeWidth="1.5" strokeLinecap="round"/></svg>
              New
            </button>
            {showNewMenu && (
              <>
                <div onClick={() => setShowNewMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 60 }} />
                <div style={{ position: 'relative', zIndex: 61, marginTop: 6, background: '#161616', border: '0.5px solid #2A2A2A', borderRadius: 8, padding: 4, boxShadow: '0 12px 32px rgba(0,0,0,0.5)' }}>
                  {[
                    { label: 'New chat', desc: 'Blank conversation', onClick: () => { setShowNewMenu(false); createConversation() } },
                    { label: 'New app', desc: 'Build an app directly', onClick: () => { setShowNewMenu(false); onNewApp?.() } },
                    { label: 'New project folder', desc: 'Group chats & apps', onClick: () => { setShowNewMenu(false); onCreateFolder?.() } },
                  ].map(opt => (
                    <button key={opt.label} onClick={opt.onClick}
                      style={{ width: '100%', textAlign: 'left', background: 'transparent', border: 'none', borderRadius: 5, padding: '7px 9px', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', flexDirection: 'column', gap: 1 }}
                      onMouseEnter={e => e.currentTarget.style.background = '#1F1F1F'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <span style={{ fontSize: 12, color: '#E5E5E5' }}>{opt.label}</span>
                      <span style={{ fontSize: 10, color: '#6B7280' }}>{opt.desc}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Scrollable list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>

          {/* Recent Chats — unfiled conversations */}
          {unfiledChats.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              {sectionHeader('Recent Chats',
                <button
                  onClick={() => { logAction('conversations.clear_all_initiated', {}); setConfirmClearAll('chats') }}
                  style={{ background: 'none', border: 'none', fontSize: 9, color: '#9CA3AF', cursor: 'pointer', padding: '1px 4px', borderRadius: 3, fontFamily: 'inherit', letterSpacing: '0.03em' }}
                  onMouseEnter={e => e.currentTarget.style.color = '#F87171'}
                  onMouseLeave={e => e.currentTarget.style.color = '#9CA3AF'}
                  title="Clear all chats"
                >Clear all</button>
              )}
              {unfiledChats.map(conv => renderChatRow(conv))}
            </div>
          )}

          {/* Recent Apps — unfiled generated projects (new engine) */}
          {unfiledApps.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              {sectionHeader('Recent Apps')}
              {unfiledApps.map(proj => renderProjectRow(proj))}
            </div>
          )}

          {/* Projects — folders, each expandable into nested Chats + Apps */}
          {sortedFolders.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              {sectionHeader('Projects')}
              {sortedFolders.map(folder => {
                const collapsed = collapsedFolders.has(folder.id)
                const fChats = chatsInFolder(folder.id)
                const fApps  = appsInFolder(folder.id)
                const count  = fChats.length + fApps.length
                const isHovered = hoveredId === `folder-${folder.id}`
                const isRenaming = renamingId === `folder-${folder.id}`
                const menuKey = `folder-${folder.id}`
                return (
                  <div key={folder.id} style={{ marginBottom: 2 }}>
                    <div
                      onMouseEnter={() => setHoveredId(`folder-${folder.id}`)}
                      onMouseLeave={() => setHoveredId(null)}
                      onClick={() => { if (!isRenaming) toggleFolder(folder.id) }}
                      onDoubleClick={() => setRenamingId(`folder-${folder.id}`)}
                      style={{
                        padding: '7px 8px', borderRadius: 6, fontSize: 12,
                        display: 'flex', alignItems: 'center', gap: 6, cursor: isRenaming ? 'text' : 'pointer',
                        color: '#D4D4D4', background: isHovered ? '#141414' : 'transparent',
                        border: '0.5px solid transparent',
                      }}
                    >
                      <span style={{ color: '#6B7280', display: 'flex' }}><Chevron open={!collapsed} /></span>
                      <span style={{ fontSize: 12, display: 'flex' }}>📁</span>
                      {folder.pinned && <PinDot />}
                      {isRenaming ? (
                        <InlineRename value={folder.name} onSave={name => { onRenameFolder?.(folder.id, name); setRenamingId(null) }} onCancel={() => setRenamingId(null)} />
                      ) : (
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{folder.name}</span>
                      )}
                      {!isRenaming && count > 0 && (
                        <span style={{ fontSize: 10, color: '#525252', flexShrink: 0 }}>{count}</span>
                      )}
                      {(isHovered || openMenu === menuKey) && !isRenaming && (
                        <KebabMenu
                          open={openMenu === menuKey}
                          onToggle={() => setOpenMenu(openMenu === menuKey ? null : menuKey)}
                          onRename={() => setRenamingId(`folder-${folder.id}`)}
                          onPin={() => onPinItem?.('folder', folder.id, !folder.pinned)}
                          pinned={folder.pinned}
                          onDelete={() => setConfirmDeleteFolder(folder)}
                          showProjectMove={false}
                        />
                      )}
                    </div>

                    {!collapsed && (
                      <div style={{ marginLeft: 8, paddingLeft: 6, borderLeft: '0.5px solid #1A1A1A' }}>
                        {count === 0 && (
                          <div style={{ fontSize: 10.5, color: '#525252', padding: '6px 10px' }}>Empty — add chats or apps via their ⋮ menu</div>
                        )}
                        {fChats.length > 0 && (
                          <div style={{ fontSize: 9, color: '#525252', letterSpacing: '0.05em', textTransform: 'uppercase', padding: '5px 10px 2px' }}>Chats</div>
                        )}
                        {fChats.map(conv => renderChatRow(conv, 8))}
                        {fApps.length > 0 && (
                          <div style={{ fontSize: 9, color: '#525252', letterSpacing: '0.05em', textTransform: 'uppercase', padding: '5px 10px 2px' }}>Apps</div>
                        )}
                        {fApps.map(proj => renderProjectRow(proj, { indent: 8 }))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Deployed Apps — legacy generated_apps (open at /app/:slug) */}
          {apps.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              {sectionHeader('Deployed Apps',
                <button
                  onClick={() => setConfirmClearAll('apps')}
                  style={{ background: 'none', border: 'none', fontSize: 9, color: '#9CA3AF', cursor: 'pointer', padding: '1px 4px', borderRadius: 3, fontFamily: 'inherit', letterSpacing: '0.03em' }}
                  onMouseEnter={e => e.currentTarget.style.color = '#F87171'}
                  onMouseLeave={e => e.currentTarget.style.color = '#9CA3AF'}
                  title="Clear all apps"
                >Clear all</button>
              )}
              {apps.map(app => {
                const isHovered  = hoveredId === `app-${app.id}`
                const isRenaming = renamingId === `app-${app.id}`
                return (
                  <div
                    key={app.id}
                    onMouseEnter={() => setHoveredId(`app-${app.id}`)}
                    onMouseLeave={() => setHoveredId(null)}
                    onClick={() => { if (!isRenaming) { logAction('app.opened', { appId: app.id, slug: app.slug }); window.open(`/app/${app.slug}`, '_blank') } }}
                    onDoubleClick={() => setRenamingId(`app-${app.id}`)}
                    style={{
                      padding: '7px 10px', borderRadius: 6, fontSize: 12,
                      display: 'flex', alignItems: 'center', gap: 8,
                      cursor: isRenaming ? 'text' : 'pointer',
                      color: '#9A9A9A', marginBottom: 1,
                      background: isHovered ? '#141414' : 'transparent',
                      border: '0.5px solid transparent',
                    }}
                  >
                    <Dot variant="deployed" />
                    {isRenaming ? (
                      <InlineRename value={app.title} onSave={title => renameApp(app.id, title)} onCancel={() => setRenamingId(null)} />
                    ) : (
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{app.title}</span>
                    )}
                    {isHovered && !isRenaming && (
                      <button
                        onClick={e => { e.stopPropagation(); requestDelete(app.id, app.title, 'app') }}
                        style={{ background: 'transparent', border: 'none', color: '#9A9A9A', cursor: 'pointer', padding: '2px', borderRadius: 4, display: 'flex', alignItems: 'center', flexShrink: 0 }}
                        onMouseEnter={e => e.currentTarget.style.color = '#F87171'}
                        onMouseLeave={e => e.currentTarget.style.color = '#525252'}
                      >
                        <TrashIcon />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Empty state */}
          {unfiledChats.length === 0 && unfiledApps.length === 0 && sortedFolders.length === 0 && apps.length === 0 && (
            <div style={{ padding: '24px 12px', textAlign: 'center', color: '#525252', fontSize: 11.5, lineHeight: 1.6 }}>
              Nothing here yet.<br />Use <span style={{ color: '#9CA3AF' }}>+ New</span> to start a chat or build an app.
            </div>
          )}
        </div>

        {/* Trash */}
        <div style={{ padding: '0 8px 4px' }}>
          <button
            onClick={() => { logAction('trash.toggled', { open: !showTrash }); setShowTrash(v => !v); if (!showTrash) loadTrash() }}
            style={{ width: '100%', background: 'transparent', border: 'none', borderRadius: 6, padding: '7px 10px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: '#C4C4C4', fontSize: 12, fontFamily: 'inherit' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#141414'; e.currentTarget.style.color = '#FFFFFF' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#C4C4C4' }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1.5 3h9M4.5 3V2h3v1M2.5 3l.5 7h6l.5-7H2.5z" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Trash
            {trashedItems.length > 0 && (
              <span style={{ marginLeft: 'auto', fontSize: 10, background: '#1F1F1F', color: '#9A9A9A', borderRadius: 10, padding: '1px 6px' }}>
                {trashedItems.length}
              </span>
            )}
          </button>

          {showTrash && (
            <div style={{ background: '#111', border: '0.5px solid #1E1E1E', borderRadius: 8, padding: '8px', marginBottom: 4, maxHeight: 240, overflowY: 'auto' }}>
              {trashedItems.length === 0 ? (
                <p style={{ margin: 0, fontSize: 11, color: '#9CA3AF', textAlign: 'center', padding: '12px 0' }}>Trash is empty</p>
              ) : (
                <>
                  {trashedItems.map(item => (
                    <div key={`${item.type}-${item.id}`} style={{ padding: '7px 8px', borderRadius: 5, marginBottom: 3, background: '#161616', display: 'flex', flexDirection: 'column', gap: 5 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Tag label={item.type === 'chat' ? 'Chat' : 'App'} color={item.type === 'chat' ? 'chat' : 'app'} />
                        <span style={{ fontSize: 11, color: '#A8A8A8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{item.title}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 10, color: '#9CA3AF' }}>{daysLeft(item.deleted_at)}d left</span>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            onClick={() => { logAction('trash.item_restored', { itemId: item.id, type: item.type }); restoreItem(item) }}
                            style={{ background: 'transparent', border: 'none', color: '#9A9A9A', fontSize: 10, cursor: 'pointer', padding: '1px 4px', fontFamily: 'inherit' }}
                            onMouseEnter={e => e.currentTarget.style.color = '#34D399'}
                            onMouseLeave={e => e.currentTarget.style.color = '#525252'}
                          >Restore</button>
                          <button
                            onClick={() => { logAction('trash.item_permanently_deleted', { itemId: item.id, type: item.type }); setConfirmPermDelete(item) }}
                            style={{ background: 'transparent', border: 'none', color: '#9A9A9A', fontSize: 10, cursor: 'pointer', padding: '1px 4px', fontFamily: 'inherit' }}
                            onMouseEnter={e => e.currentTarget.style.color = '#F87171'}
                            onMouseLeave={e => e.currentTarget.style.color = '#525252'}
                          >Delete</button>
                        </div>
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={() => { logAction('trash.cleared', {}); setConfirmClearTrash(true) }}
                    style={{ width: '100%', background: 'transparent', border: '0.5px solid #2A2A2A', borderRadius: 5, color: '#F87171', fontSize: 10, cursor: 'pointer', padding: '6px', marginTop: 4, fontFamily: 'inherit' }}
                  >
                    Clear Trash
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Settings link */}
        <div style={{ padding: '0 8px 6px' }}>
          <button
            onClick={() => { logAction('settings.opened', {}); window.location.href = '/settings' }}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, background: 'transparent', border: 'none', borderRadius: 7, padding: '7px 8px', cursor: 'pointer', color: '#C4C4C4', fontSize: 12, fontFamily: 'inherit', textAlign: 'left' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#1A1A1A'; e.currentTarget.style.color = '#FFFFFF' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#C4C4C4' }}
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <circle cx="6.5" cy="6.5" r="2" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M6.5 1v1.5M6.5 10.5V12M1 6.5h1.5M10.5 6.5H12M2.6 2.6l1.1 1.1M9.3 9.3l1.1 1.1M9.3 3.7L8.2 4.8M3.7 9.3L2.6 10.4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            Settings & Integrations
          </button>
        </div>

        {/* Profile */}
        <div style={{ borderTop: '0.5px solid #1A1A1A', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, #2A2A2A, #4A4A4A)', border: '0.5px solid #3D3D3D', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 10, fontWeight: 600, color: '#D4D4D4' }}>
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: '#E5E5E5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email}</div>
            <div style={{ fontSize: 10, color: '#B5B5B5' }}>Pro plan</div>
          </div>
        </div>
      </div>
    </>
  )
}
