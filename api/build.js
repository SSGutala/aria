import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
)

function generateSlug(title) {
  const base = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
  return `${base}-${Math.random().toString(36).slice(2, 8)}`
}

// ─── Shared infrastructure injected into every layout ─────────────────────────
function buildSharedInfra(spec, appId, apiBase) {
  const primary = spec.colorTheme?.primary || spec.visualTheme?.primaryColor || '#7C3AED'
  const light = spec.colorTheme?.light || '#F5F3FF'
  const fields = spec.fields.filter(f => f.name !== 'status')
  const statusColors = [
    { bg: '#EFF6FF', text: '#1D4ED8', dot: '#3B82F6' },
    { bg: '#F0FDF4', text: '#15803D', dot: '#22C55E' },
    { bg: '#FEF2F2', text: '#B91C1C', dot: '#EF4444' },
    { bg: '#FFF7ED', text: '#C2410C', dot: '#F97316' },
    { bg: '#F5F3FF', text: '#6D28D9', dot: '#8B5CF6' },
    { bg: '#ECFEFF', text: '#0E7490', dot: '#06B6D4' },
    { bg: '#FFF1F2', text: '#BE123C', dot: '#FB7185' },
  ]
  return `
const API = '${apiBase}'
const APP_ID = '${appId}'
const APP_TITLE = '${spec.appTitle.replace(/'/g, "\\'")}'
const APP_TYPE = '${(spec.appType || spec.workflowType || '').replace(/'/g, "\\'")}'
const ACTION_LABEL = '${(spec.primaryActionLabel || 'Add Item').replace(/'/g, "\\'")}'
const PRIMARY = '${primary}'
const LIGHT = '${light}'
const FIELDS = ${JSON.stringify(fields)}
const STATUS_OPTIONS = ${JSON.stringify(spec.statusFlow || [])}
const STATUS_COLORS = ${JSON.stringify(statusColors)}

function statusColor(s) {
  const i = STATUS_OPTIONS.indexOf(s)
  return STATUS_COLORS[Math.max(0, i) % STATUS_COLORS.length]
}
function fmtDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
function fmtDateTime(d) {
  if (!d) return ''
  return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function FieldInput({ field, value, onChange }) {
  const [focused, setFocused] = React.useState(false)
  const base = {
    width: '100%', boxSizing: 'border-box', padding: '9px 12px',
    background: focused ? '#fff' : '#F8FAFC',
    border: \`1.5px solid \${focused ? PRIMARY : '#E5E7EB'}\`,
    borderRadius: 8, fontSize: 13, color: '#111827',
    fontFamily: 'inherit', outline: 'none', transition: 'all 0.15s',
  }
  if (field.type === 'textarea') return (
    <textarea rows={3} value={value || ''} placeholder={field.placeholder || ''}
      onChange={e => onChange(field.name, e.target.value)}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      style={{ ...base, resize: 'vertical' }} />
  )
  if (field.type === 'select') return (
    <select value={value || ''} onChange={e => onChange(field.name, e.target.value)}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      style={{ ...base, cursor: 'pointer', appearance: 'none' }}>
      <option value=''>Select...</option>
      {(field.options || []).map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
  return <input type={field.type || 'text'} value={value || ''}
    placeholder={field.placeholder || ''}
    onChange={e => onChange(field.name, e.target.value)}
    onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
    style={base} />
}

function SubmitForm({ onSuccess, onClose }) {
  const [form, setForm] = React.useState({})
  const [submitting, setSubmitting] = React.useState(false)
  const [done, setDone] = React.useState(null)
  const [error, setError] = React.useState('')
  function update(name, val) { setForm(p => ({ ...p, [name]: val })) }
  async function submit(e) {
    e.preventDefault(); setSubmitting(true); setError('')
    try {
      const res = await fetch(API + '/api/submit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId: APP_ID, formData: form }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Submit failed')
      setDone(data.ticketId); onSuccess && onSuccess()
    } catch(err) { setError(err.message) }
    finally { setSubmitting(false) }
  }
  if (done) return (
    <div style={{ textAlign: 'center', padding: '20px 0' }}>
      <div style={{ width: 44, height: 44, borderRadius: '50%', background: LIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M3 10l4.5 4.5 9-9" stroke={PRIMARY} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </div>
      <p style={{ margin: '0 0 3px', fontWeight: 700, fontSize: 14, color: '#111827' }}>Submitted!</p>
      <p style={{ margin: '0 0 14px', fontSize: 11, color: '#9CA3AF', fontFamily: 'monospace' }}>{done}</p>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
        <button onClick={() => { setForm({}); setDone(null) }} style={{ background: LIGHT, color: PRIMARY, border: 'none', borderRadius: 7, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Submit another</button>
        {onClose && <button onClick={onClose} style={{ background: '#F3F4F6', color: '#374151', border: 'none', borderRadius: 7, padding: '7px 14px', fontSize: 12, cursor: 'pointer' }}>Close</button>}
      </div>
    </div>
  )
  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
      {FIELDS.map(f => (
        <div key={f.name}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
            {f.label}{f.required && <span style={{ color: PRIMARY, marginLeft: 2 }}>*</span>}
          </label>
          <FieldInput field={f} value={form[f.name]} onChange={update} />
        </div>
      ))}
      {error && <p style={{ margin: 0, padding: '8px 12px', background: '#FEF2F2', color: '#DC2626', borderRadius: 7, fontSize: 12 }}>{error}</p>}
      <button type="submit" disabled={submitting} style={{ background: submitting ? '#E5E7EB' : PRIMARY, color: submitting ? '#9CA3AF' : '#fff', border: 'none', borderRadius: 9, padding: '11px', fontSize: 13, fontWeight: 700, cursor: submitting ? 'default' : 'pointer' }}>
        {submitting ? 'Submitting...' : ACTION_LABEL}
      </button>
    </form>
  )
}
`
}

// ─── HTML wrapper ──────────────────────────────────────────────────────────────
function wrapHtml(title, infra, appCode, extraCss = '') {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<script src="https://unpkg.com/react@18/umd/react.production.min.js" crossorigin></script>
<script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js" crossorigin></script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body,#root{height:100%}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Inter',sans-serif}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
@keyframes slideRight{from{opacity:0;transform:translateX(-10px)}to{opacity:1;transform:translateX(0)}}
@keyframes slideUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
::-webkit-scrollbar{width:5px;height:5px}
::-webkit-scrollbar-thumb{background:#CBD5E1;border-radius:3px}
select{appearance:none;-webkit-appearance:none}
${extraCss}
</style>
</head>
<body>
<div id="root"></div>
<script>
window.onerror = function(msg,src,line,col,err){
  document.getElementById('root').innerHTML='<div style="padding:40px;color:#DC2626;font-family:monospace;font-size:13px;white-space:pre-wrap;background:#FEF2F2;min-height:100vh"><strong>Error</strong>\\n\\n'+msg+'\\n\\n'+(err&&err.stack||'')+'</div>'
}
</script>
<script type="text/babel">
${infra}
${appCode}
try{ReactDOM.createRoot(document.getElementById('root')).render(<App/>)}
catch(e){document.getElementById('root').innerHTML='<div style="padding:40px;color:#DC2626;font-family:monospace;font-size:13px;white-space:pre-wrap;background:#FEF2F2;min-height:100vh"><strong>Render Error</strong>\\n\\n'+e.message+'\\n\\n'+(e.stack||'')+'</div>'}
</script>
</body>
</html>`
}

// ═══════════════════════════════════════════════════════════════════════════════
// LAYOUT RENDERERS
// Each function returns complete self-contained HTML for a structurally distinct UI
// ═══════════════════════════════════════════════════════════════════════════════

// ─── 1. KANBAN BOARD ─ horizontal columns, cards, FAB ─────────────────────────
function renderKanban(spec, appId, apiBase) {
  const primary = spec.colorTheme?.primary || '#7C3AED'
  const infra = buildSharedInfra(spec, appId, apiBase)
  const app = `
function Modal({ open, onClose, onSuccess }) {
  if (!open) return null
  return (
    <div onClick={e => e.target===e.currentTarget&&onClose()} style={{position:'fixed',inset:0,background:'rgba(15,23,42,0.55)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:50,padding:20,backdropFilter:'blur(4px)'}}>
      <div style={{background:'#fff',borderRadius:18,width:'100%',maxWidth:480,maxHeight:'90vh',overflow:'auto',animation:'slideUp 0.2s ease',boxShadow:'0 24px 60px rgba(0,0,0,0.2)'}}>
        <div style={{background:PRIMARY,padding:'18px 22px',borderRadius:'18px 18px 0 0',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <span style={{fontWeight:700,fontSize:16,color:'#fff'}}>{ACTION_LABEL}</span>
          <button onClick={onClose} style={{background:'rgba(255,255,255,0.2)',border:'none',borderRadius:6,width:28,height:28,color:'#fff',cursor:'pointer',fontSize:20,display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>
        </div>
        <div style={{padding:22}}><SubmitForm onSuccess={()=>{onSuccess();setTimeout(onClose,1200)}} onClose={onClose}/></div>
      </div>
    </div>
  )
}
function KanbanCard({ sub, onStatusChange, updating }) {
  const sc = statusColor(sub.status)
  return (
    <div style={{background:'#fff',borderRadius:10,padding:'12px 14px',border:'1px solid #E2E8F0',boxShadow:'0 1px 4px rgba(0,0,0,0.06)',animation:'fadeIn 0.2s ease',marginBottom:8}}>
      <p style={{margin:'0 0 5px',fontWeight:600,fontSize:13,color:'#0F172A',lineHeight:1.35}}>{sub.data?.[FIELDS[0]?.name]||sub.ticket_id}</p>
      {FIELDS[1]&&<p style={{margin:'0 0 8px',fontSize:11,color:'#64748B',lineHeight:1.4,overflow:'hidden',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical'}}>{sub.data?.[FIELDS[1]?.name]}</p>}
      <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
        <span style={{fontSize:10,color:'#94A3B8',fontFamily:'monospace'}}>{sub.ticket_id}</span>
        <span style={{fontSize:10,color:'#94A3B8'}}>{fmtDate(sub.submitted_at)}</span>
      </div>
      <select value={sub.status} onChange={e=>onStatusChange(sub.id,e.target.value)} disabled={updating}
        style={{width:'100%',background:sc.bg,color:sc.text,border:\`1px solid \${sc.dot}55\`,borderRadius:6,padding:'5px 8px',fontSize:11,fontWeight:700,cursor:'pointer',opacity:updating?0.5:1}}>
        {STATUS_OPTIONS.map(o=><option key={o}>{o}</option>)}
      </select>
    </div>
  )
}
function App() {
  const [subs,setSubs]=React.useState([])
  const [loading,setLoading]=React.useState(true)
  const [modal,setModal]=React.useState(false)
  const [updatingId,setUpdatingId]=React.useState(null)
  async function load(){
    try{const r=await fetch(API+'/api/submissions?appId='+APP_ID);const d=await r.json();setSubs(d.submissions||[])}catch(e){}finally{setLoading(false)}
  }
  React.useEffect(()=>{load()},[])
  async function updateStatus(id,status){
    setUpdatingId(id)
    await fetch(API+'/api/update-status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({submissionId:id,status,appId:APP_ID})})
    setSubs(p=>p.map(s=>s.id===id?{...s,status}:s))
    setUpdatingId(null)
  }
  return (
    <div style={{display:'flex',flexDirection:'column',height:'100vh',background:'#F1F5F9'}}>
      <div style={{background:PRIMARY,padding:'0 24px',height:52,display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <span style={{fontWeight:800,fontSize:15,color:'#fff'}}>{APP_TITLE}</span>
          <span style={{background:'rgba(255,255,255,0.2)',color:'rgba(255,255,255,0.9)',borderRadius:4,padding:'2px 8px',fontSize:10,fontWeight:700}}>{APP_TYPE.toUpperCase()}</span>
        </div>
        <div style={{display:'flex',gap:10,alignItems:'center'}}>
          <span style={{color:'rgba(255,255,255,0.7)',fontSize:12}}>{subs.length} items</span>
          <button onClick={()=>setModal(true)} style={{background:'rgba(255,255,255,0.15)',color:'#fff',border:'1px solid rgba(255,255,255,0.3)',borderRadius:7,padding:'6px 14px',fontSize:12,fontWeight:600,cursor:'pointer'}}>+ {ACTION_LABEL}</button>
        </div>
      </div>
      {loading?(
        <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <div style={{width:32,height:32,border:\`3px solid ${primary}33\`,borderTopColor:PRIMARY,borderRadius:'50%',animation:'spin 0.7s linear infinite'}}/>
        </div>
      ):(
        <div style={{flex:1,overflow:'auto',padding:'20px 24px',display:'flex',gap:16,alignItems:'flex-start'}}>
          {STATUS_OPTIONS.map((status,i)=>{
            const sc=STATUS_COLORS[i%STATUS_COLORS.length]
            const cards=subs.filter(s=>s.status===status)
            return (
              <div key={status} style={{width:272,flexShrink:0}}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10,padding:'8px 12px',background:'#fff',borderRadius:8,border:'1px solid #E2E8F0'}}>
                  <span style={{width:8,height:8,borderRadius:'50%',background:sc.dot,flexShrink:0}}/>
                  <span style={{fontSize:12,fontWeight:700,color:'#1E293B',flex:1,textTransform:'uppercase',letterSpacing:'0.05em'}}>{status}</span>
                  <span style={{background:sc.bg,color:sc.text,borderRadius:10,padding:'2px 8px',fontSize:11,fontWeight:700}}>{cards.length}</span>
                </div>
                {cards.length===0?(
                  <div onClick={()=>setModal(true)} style={{border:'2px dashed #CBD5E1',borderRadius:10,padding:'20px',textAlign:'center',color:'#94A3B8',fontSize:12,cursor:'pointer',minHeight:80,display:'flex',alignItems:'center',justifyContent:'center'}}>Drop items here</div>
                ):cards.map(sub=><KanbanCard key={sub.id} sub={sub} onStatusChange={updateStatus} updating={updatingId===sub.id}/>)}
              </div>
            )
          })}
        </div>
      )}
      <button onClick={()=>setModal(true)} style={{position:'fixed',bottom:28,right:28,width:52,height:52,borderRadius:'50%',background:PRIMARY,color:'#fff',border:'none',fontSize:24,cursor:'pointer',boxShadow:\`0 4px 20px \${PRIMARY}66\`,zIndex:40,display:'flex',alignItems:'center',justifyContent:'center'}}>+</button>
      <Modal open={modal} onClose={()=>setModal(false)} onSuccess={load}/>
    </div>
  )
}`
  return wrapHtml(spec.appTitle, infra, app)
}

// ─── 2. QUEUE/DETAIL ─ inbox list left + full detail panel right ───────────────
function renderQueueDetail(spec, appId, apiBase) {
  const infra = buildSharedInfra(spec, appId, apiBase)
  const app = `
function App() {
  const [subs,setSubs]=React.useState([])
  const [loading,setLoading]=React.useState(true)
  const [selected,setSelected]=React.useState(null)
  const [showForm,setShowForm]=React.useState(false)
  const [filter,setFilter]=React.useState('All')
  const [updatingId,setUpdatingId]=React.useState(null)
  async function load(){
    const r=await fetch(API+'/api/submissions?appId='+APP_ID);const d=await r.json()
    setSubs(d.submissions||[]);setLoading(false)
  }
  React.useEffect(()=>{load()},[])
  async function updateStatus(id,status){
    setUpdatingId(id)
    await fetch(API+'/api/update-status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({submissionId:id,status,appId:APP_ID})})
    setSubs(p=>p.map(s=>s.id===id?{...s,status}:s))
    if(selected?.id===id)setSelected(p=>({...p,status}))
    setUpdatingId(null)
  }
  const visible=filter==='All'?subs:subs.filter(s=>s.status===filter)
  const pending=subs.filter(s=>s.status===STATUS_OPTIONS[0]).length
  return (
    <div style={{display:'flex',flexDirection:'column',height:'100vh',background:'#F8FAFC'}}>
      <div style={{background:'#fff',borderBottom:'1px solid #E2E8F0',padding:'0 20px',height:54,display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0,boxShadow:'0 1px 4px rgba(0,0,0,0.04)'}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{width:30,height:30,borderRadius:8,background:PRIMARY,display:'flex',alignItems:'center',justifyContent:'center'}}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 3h12M1 7h12M1 11h8" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"/></svg>
          </div>
          <span style={{fontWeight:800,fontSize:16,color:'#0F172A'}}>{APP_TITLE}</span>
          {pending>0&&<span style={{background:'#EF4444',color:'#fff',borderRadius:10,padding:'1px 8px',fontSize:11,fontWeight:700}}>{pending}</span>}
        </div>
        <button onClick={()=>setShowForm(true)} style={{background:PRIMARY,color:'#fff',border:'none',borderRadius:8,padding:'8px 16px',fontSize:13,fontWeight:600,cursor:'pointer'}}>+ {ACTION_LABEL}</button>
      </div>
      <div style={{flex:1,display:'flex',overflow:'hidden'}}>
        <div style={{width:300,flexShrink:0,background:'#fff',borderRight:'1px solid #E2E8F0',display:'flex',flexDirection:'column'}}>
          <div style={{padding:'10px 14px',borderBottom:'1px solid #F1F5F9',display:'flex',gap:5,flexWrap:'wrap'}}>
            {['All',...STATUS_OPTIONS].map(s=>(
              <button key={s} onClick={()=>setFilter(s)} style={{background:filter===s?PRIMARY:'#F8FAFC',color:filter===s?'#fff':'#64748B',border:\`1px solid \${filter===s?PRIMARY:'#E2E8F0'}\`,borderRadius:5,padding:'3px 9px',fontSize:11,fontWeight:600,cursor:'pointer'}}>{s}</button>
            ))}
          </div>
          <div style={{flex:1,overflowY:'auto'}}>
            {loading?<div style={{padding:20,textAlign:'center',color:'#94A3B8',fontSize:12}}>Loading...</div>
            :visible.length===0?<div style={{padding:40,textAlign:'center',color:'#94A3B8',fontSize:13}}>No items</div>
            :visible.map(sub=>{
              const sc=statusColor(sub.status)
              const isSelected=selected?.id===sub.id
              return (
                <div key={sub.id} onClick={()=>setSelected(sub)} style={{padding:'12px 16px',borderBottom:'1px solid #F1F5F9',cursor:'pointer',background:isSelected?LIGHT:'transparent',borderLeft:\`3px solid \${isSelected?PRIMARY:'transparent'}\`,transition:'background 0.1s'}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
                    <span style={{fontWeight:isSelected?700:600,fontSize:13,color:'#0F172A',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',paddingRight:8}}>{sub.data?.[FIELDS[0]?.name]||sub.ticket_id}</span>
                    <span style={{fontSize:10,color:'#94A3B8',whiteSpace:'nowrap'}}>{fmtDate(sub.submitted_at)}</span>
                  </div>
                  {FIELDS[1]&&<p style={{margin:'0 0 5px',fontSize:11,color:'#64748B',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{sub.data?.[FIELDS[1]?.name]}</p>}
                  <span style={{background:sc.bg,color:sc.text,borderRadius:4,padding:'1px 7px',fontSize:10,fontWeight:700}}>{sub.status}</span>
                </div>
              )
            })}
          </div>
        </div>
        <div style={{flex:1,overflow:'auto',padding:28}}>
          {!selected?(
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',color:'#94A3B8',textAlign:'center'}}>
              <div style={{width:64,height:64,borderRadius:16,background:LIGHT,display:'flex',alignItems:'center',justifyContent:'center',marginBottom:16,fontSize:28}}>📋</div>
              <p style={{fontWeight:600,fontSize:16,color:'#475569',margin:'0 0 6px'}}>Select an item to review</p>
              <p style={{fontSize:13,margin:0}}>Choose from the queue on the left</p>
            </div>
          ):(
            <div style={{maxWidth:640}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:24}}>
                <div>
                  <h2 style={{fontSize:22,fontWeight:800,color:'#0F172A',margin:'0 0 6px'}}>{selected.data?.[FIELDS[0]?.name]||selected.ticket_id}</h2>
                  <span style={{fontFamily:'monospace',fontSize:11,color:'#94A3B8'}}>{selected.ticket_id}</span>
                  <span style={{color:'#CBD5E1',margin:'0 8px'}}>·</span>
                  <span style={{fontSize:12,color:'#64748B'}}>{fmtDateTime(selected.submitted_at)}</span>
                </div>
                <select value={selected.status} onChange={e=>updateStatus(selected.id,e.target.value)} disabled={updatingId===selected.id}
                  style={{background:statusColor(selected.status).bg,color:statusColor(selected.status).text,border:\`1.5px solid \${statusColor(selected.status).dot}66\`,borderRadius:8,padding:'8px 14px',fontSize:13,fontWeight:700,cursor:'pointer'}}>
                  {STATUS_OPTIONS.map(o=><option key={o}>{o}</option>)}
                </select>
              </div>
              <div style={{background:'#fff',borderRadius:14,border:'1px solid #E2E8F0',padding:'22px 26px',display:'grid',gridTemplateColumns:'1fr 1fr',gap:'18px 28px'}}>
                {FIELDS.map(f=>(
                  <div key={f.name} style={{gridColumn:f.type==='textarea'?'1 / -1':'auto'}}>
                    <div style={{fontSize:10,fontWeight:700,color:'#94A3B8',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:5}}>{f.label}</div>
                    <div style={{fontSize:14,color:'#1E293B',fontWeight:500,lineHeight:1.5}}>{String(selected.data?.[f.name]??'—')}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      {showForm&&(
        <div onClick={e=>e.target===e.currentTarget&&setShowForm(false)} style={{position:'fixed',inset:0,background:'rgba(15,23,42,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:50,padding:20,backdropFilter:'blur(4px)'}}>
          <div style={{background:'#fff',borderRadius:16,width:'100%',maxWidth:480,maxHeight:'90vh',overflow:'auto',animation:'slideUp 0.2s ease'}}>
            <div style={{background:PRIMARY,padding:'18px 22px',borderRadius:'16px 16px 0 0',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{fontWeight:700,fontSize:16,color:'#fff'}}>{ACTION_LABEL}</span>
              <button onClick={()=>setShowForm(false)} style={{background:'rgba(255,255,255,0.2)',border:'none',borderRadius:6,width:28,height:28,color:'#fff',cursor:'pointer',fontSize:20}}>×</button>
            </div>
            <div style={{padding:22}}><SubmitForm onSuccess={()=>{load();setTimeout(()=>setShowForm(false),1200)}} onClose={()=>setShowForm(false)}/></div>
          </div>
        </div>
      )}
    </div>
  )
}`
  return wrapHtml(spec.appTitle, infra, app)
}

// ─── 3. COMMAND CENTER ─ dark ops panel, stats, live queue ────────────────────
function renderCommandCenter(spec, appId, apiBase) {
  const primary = spec.colorTheme?.primary || '#7C3AED'
  const infra = buildSharedInfra(spec, appId, apiBase)
  const app = `
function App() {
  const [subs,setSubs]=React.useState([])
  const [loading,setLoading]=React.useState(true)
  const [selected,setSelected]=React.useState(null)
  const [showForm,setShowForm]=React.useState(false)
  const [updatingId,setUpdatingId]=React.useState(null)
  async function load(){
    const r=await fetch(API+'/api/submissions?appId='+APP_ID);const d=await r.json()
    setSubs(d.submissions||[]);setLoading(false)
  }
  React.useEffect(()=>{load();const t=setInterval(load,30000);return()=>clearInterval(t)},[])
  async function updateStatus(id,status){
    setUpdatingId(id)
    await fetch(API+'/api/update-status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({submissionId:id,status,appId:APP_ID})})
    setSubs(p=>p.map(s=>s.id===id?{...s,status}:s))
    if(selected?.id===id)setSelected(p=>({...p,status}))
    setUpdatingId(null)
  }
  const stats=STATUS_OPTIONS.map(s=>({label:s,count:subs.filter(x=>x.status===s).length,color:statusColor(s)}))
  const urgent=subs.filter(s=>s.status===STATUS_OPTIONS[0])
  return (
    <div style={{display:'flex',flexDirection:'column',height:'100vh',background:'#0F172A',color:'#E2E8F0'}}>
      <div style={{padding:'0 24px',height:54,display:'flex',alignItems:'center',justifyContent:'space-between',borderBottom:'1px solid #1E293B',flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <div style={{width:8,height:8,borderRadius:'50%',background:'#22C55E',boxShadow:'0 0 6px #22C55E'}}/>
          <span style={{fontWeight:800,fontSize:16,color:'#F8FAFC'}}>{APP_TITLE}</span>
          <span style={{fontSize:11,color:'#475569',background:'#1E293B',borderRadius:4,padding:'2px 8px'}}>{APP_TYPE}</span>
        </div>
        <button onClick={()=>setShowForm(true)} style={{background:PRIMARY,color:'#fff',border:'none',borderRadius:7,padding:'7px 16px',fontSize:12,fontWeight:600,cursor:'pointer'}}>+ {ACTION_LABEL}</button>
      </div>
      <div style={{display:'flex',gap:1,padding:'16px 24px',background:'#0F172A',borderBottom:'1px solid #1E293B',flexShrink:0}}>
        {stats.map((st,i)=>(
          <div key={st.label} style={{flex:1,padding:'12px 16px',background:'#1E293B',borderRadius:i===0?'8px 0 0 8px':i===stats.length-1?'0 8px 8px 0':'0',marginRight:1}}>
            <div style={{fontSize:24,fontWeight:800,color:st.color.dot,marginBottom:2}}>{st.count}</div>
            <div style={{fontSize:11,color:'#64748B',textTransform:'uppercase',letterSpacing:'0.05em'}}>{st.label}</div>
          </div>
        ))}
      </div>
      <div style={{flex:1,display:'flex',overflow:'hidden'}}>
        <div style={{width:320,flexShrink:0,borderRight:'1px solid #1E293B',display:'flex',flexDirection:'column'}}>
          <div style={{padding:'12px 16px',borderBottom:'1px solid #1E293B',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <span style={{fontSize:12,fontWeight:700,color:'#94A3B8',textTransform:'uppercase',letterSpacing:'0.05em'}}>Live Queue</span>
            <span style={{background:urgent.length>0?'#EF444422':'#1E293B',color:urgent.length>0?'#EF4444':'#475569',borderRadius:10,padding:'1px 8px',fontSize:11,fontWeight:700}}>{subs.length}</span>
          </div>
          <div style={{flex:1,overflowY:'auto'}}>
            {loading?<div style={{padding:20,textAlign:'center',color:'#475569',fontSize:12}}>Loading...</div>
            :subs.length===0?<div style={{padding:40,textAlign:'center',color:'#334155',fontSize:13}}>Queue is empty</div>
            :subs.map(sub=>{
              const sc=statusColor(sub.status)
              const isSelected=selected?.id===sub.id
              return (
                <div key={sub.id} onClick={()=>setSelected(sub)} style={{padding:'11px 16px',borderBottom:'1px solid #1E293B',cursor:'pointer',background:isSelected?'#1E293B':'transparent',borderLeft:\`3px solid \${isSelected?PRIMARY:'transparent'}\`}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                    <span style={{fontWeight:600,fontSize:13,color:'#F1F5F9',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flex:1,paddingRight:8}}>{sub.data?.[FIELDS[0]?.name]||sub.ticket_id}</span>
                    <span style={{fontSize:10,color:'#475569',whiteSpace:'nowrap'}}>{fmtDate(sub.submitted_at)}</span>
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:6}}>
                    <span style={{width:6,height:6,borderRadius:'50%',background:sc.dot,flexShrink:0}}/>
                    <span style={{fontSize:11,color:sc.dot,fontWeight:600}}>{sub.status}</span>
                    <span style={{fontSize:10,color:'#334155',fontFamily:'monospace',marginLeft:'auto'}}>{sub.ticket_id}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        <div style={{flex:1,overflow:'auto',padding:24}}>
          {!selected?(
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',color:'#334155',textAlign:'center'}}>
              <div style={{width:60,height:60,borderRadius:14,background:'#1E293B',display:'flex',alignItems:'center',justifyContent:'center',marginBottom:14,fontSize:26}}>⚡</div>
              <p style={{fontWeight:600,fontSize:15,color:'#475569',margin:'0 0 6px'}}>Select an item from the queue</p>
              <p style={{fontSize:12,margin:0,color:'#334155'}}>Details and controls will appear here</p>
            </div>
          ):(
            <div>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:20}}>
                <div>
                  <h2 style={{fontSize:20,fontWeight:800,color:'#F1F5F9',margin:'0 0 5px'}}>{selected.data?.[FIELDS[0]?.name]||selected.ticket_id}</h2>
                  <span style={{fontFamily:'monospace',fontSize:11,color:'#475569'}}>{selected.ticket_id}</span>
                  <span style={{color:'#1E293B',margin:'0 8px'}}>·</span>
                  <span style={{fontSize:12,color:'#64748B'}}>{fmtDateTime(selected.submitted_at)}</span>
                </div>
                <select value={selected.status} onChange={e=>updateStatus(selected.id,e.target.value)} disabled={updatingId===selected.id}
                  style={{background:statusColor(selected.status).dot,color:'#fff',border:'none',borderRadius:7,padding:'8px 14px',fontSize:13,fontWeight:700,cursor:'pointer'}}>
                  {STATUS_OPTIONS.map(o=><option key={o}>{o}</option>)}
                </select>
              </div>
              <div style={{background:'#1E293B',borderRadius:12,border:'1px solid #334155',padding:'20px 24px',display:'grid',gridTemplateColumns:'1fr 1fr',gap:'16px 24px'}}>
                {FIELDS.map(f=>(
                  <div key={f.name} style={{gridColumn:f.type==='textarea'?'1 / -1':'auto'}}>
                    <div style={{fontSize:10,fontWeight:700,color:'#475569',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:5}}>{f.label}</div>
                    <div style={{fontSize:14,color:'#CBD5E1',fontWeight:500}}>{String(selected.data?.[f.name]??'—')}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      {showForm&&(
        <div onClick={e=>e.target===e.currentTarget&&setShowForm(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:50,padding:20}}>
          <div style={{background:'#1E293B',borderRadius:16,width:'100%',maxWidth:480,maxHeight:'90vh',overflow:'auto',border:'1px solid #334155'}}>
            <div style={{background:PRIMARY,padding:'18px 22px',borderRadius:'16px 16px 0 0',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{fontWeight:700,fontSize:16,color:'#fff'}}>{ACTION_LABEL}</span>
              <button onClick={()=>setShowForm(false)} style={{background:'rgba(255,255,255,0.2)',border:'none',borderRadius:6,width:28,height:28,color:'#fff',cursor:'pointer',fontSize:20}}>×</button>
            </div>
            <div style={{padding:22}}><SubmitForm onSuccess={()=>{load();setTimeout(()=>setShowForm(false),1200)}} onClose={()=>setShowForm(false)}/></div>
          </div>
        </div>
      )}
    </div>
  )
}`
  return wrapHtml(spec.appTitle, infra, app)
}

// ─── 4. TIMELINE VIEW ─ vertical chronological, date markers ─────────────────
function renderTimeline(spec, appId, apiBase) {
  const primary = spec.colorTheme?.primary || '#7C3AED'
  const infra = buildSharedInfra(spec, appId, apiBase)
  const app = `
function App() {
  const [subs,setSubs]=React.useState([])
  const [loading,setLoading]=React.useState(true)
  const [showForm,setShowForm]=React.useState(false)
  const [filter,setFilter]=React.useState('All')
  const [updatingId,setUpdatingId]=React.useState(null)
  async function load(){
    const r=await fetch(API+'/api/submissions?appId='+APP_ID);const d=await r.json()
    setSubs(d.submissions||[]);setLoading(false)
  }
  React.useEffect(()=>{load()},[])
  async function updateStatus(id,status){
    setUpdatingId(id)
    await fetch(API+'/api/update-status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({submissionId:id,status,appId:APP_ID})})
    setSubs(p=>p.map(s=>s.id===id?{...s,status}:s))
    setUpdatingId(null)
  }
  const visible=filter==='All'?subs:subs.filter(s=>s.status===filter)
  function groupByDate(items){
    const groups={}
    items.forEach(item=>{
      const d=new Date(item.submitted_at)
      const today=new Date();const yesterday=new Date(today);yesterday.setDate(today.getDate()-1)
      let key
      if(d.toDateString()===today.toDateString())key='Today'
      else if(d.toDateString()===yesterday.toDateString())key='Yesterday'
      else key=d.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})
      if(!groups[key])groups[key]=[]
      groups[key].push(item)
    })
    return groups
  }
  const grouped=groupByDate(visible)
  return (
    <div style={{minHeight:'100vh',background:'#FAFAFA'}}>
      <div style={{background:'#fff',borderBottom:'1px solid #F1F5F9',padding:'0 24px',height:56,display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:20,boxShadow:'0 1px 4px rgba(0,0,0,0.06)'}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{width:8,height:8,borderRadius:'50%',background:PRIMARY}}/>
          <span style={{fontWeight:800,fontSize:16,color:'#0F172A'}}>{APP_TITLE}</span>
        </div>
        <div style={{display:'flex',gap:6,alignItems:'center'}}>
          {['All',...STATUS_OPTIONS].map(s=>(
            <button key={s} onClick={()=>setFilter(s)} style={{background:filter===s?PRIMARY:'transparent',color:filter===s?'#fff':'#64748B',border:\`1px solid \${filter===s?PRIMARY:'#E2E8F0'}\`,borderRadius:20,padding:'4px 12px',fontSize:11,fontWeight:600,cursor:'pointer'}}>{s}</button>
          ))}
          <div style={{width:1,height:20,background:'#E2E8F0',margin:'0 4px'}}/>
          <button onClick={()=>setShowForm(true)} style={{background:PRIMARY,color:'#fff',border:'none',borderRadius:8,padding:'7px 14px',fontSize:12,fontWeight:600,cursor:'pointer'}}>+ {ACTION_LABEL}</button>
        </div>
      </div>
      <div style={{maxWidth:700,margin:'0 auto',padding:'28px 24px'}}>
        {loading?(
          <div style={{textAlign:'center',padding:48,color:'#94A3B8'}}>Loading...</div>
        ):visible.length===0?(
          <div style={{textAlign:'center',padding:'60px 24px'}}>
            <div style={{width:60,height:60,borderRadius:14,background:PRIMARY+'22',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 14px',fontSize:26}}>📋</div>
            <p style={{fontWeight:600,fontSize:16,color:'#475569',margin:'0 0 6px'}}>Nothing here yet</p>
            <p style={{fontSize:13,color:'#94A3B8',margin:'0 0 20px'}}>Entries will appear in chronological order</p>
            <button onClick={()=>setShowForm(true)} style={{background:PRIMARY,color:'#fff',border:'none',borderRadius:8,padding:'10px 22px',fontSize:13,fontWeight:600,cursor:'pointer'}}>+ {ACTION_LABEL}</button>
          </div>
        ):Object.entries(grouped).map(([date,items])=>(
          <div key={date} style={{marginBottom:32}}>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16}}>
              <span style={{fontSize:12,fontWeight:700,color:'#94A3B8',textTransform:'uppercase',letterSpacing:'0.06em',whiteSpace:'nowrap'}}>{date}</span>
              <div style={{flex:1,height:1,background:'#E2E8F0'}}/>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:10,paddingLeft:20,borderLeft:\`2px solid \${PRIMARY}33\`}}>
              {items.map(sub=>{
                const sc=statusColor(sub.status)
                return (
                  <div key={sub.id} style={{background:'#fff',borderRadius:12,border:'1px solid #F1F5F9',padding:'14px 18px',boxShadow:'0 1px 4px rgba(0,0,0,0.05)',animation:'fadeIn 0.2s ease',position:'relative',marginLeft:-8}}>
                    <div style={{position:'absolute',left:-14,top:16,width:8,height:8,borderRadius:'50%',background:sc.dot,border:'2px solid #fff'}}/>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
                      <div>
                        <p style={{margin:'0 0 3px',fontWeight:700,fontSize:14,color:'#0F172A'}}>{sub.data?.[FIELDS[0]?.name]||sub.ticket_id}</p>
                        {FIELDS[1]&&<p style={{margin:0,fontSize:12,color:'#64748B'}}>{sub.data?.[FIELDS[1]?.name]}</p>}
                      </div>
                      <div style={{display:'flex',gap:8,alignItems:'center',flexShrink:0,marginLeft:12}}>
                        <span style={{background:sc.bg,color:sc.text,borderRadius:5,padding:'3px 9px',fontSize:11,fontWeight:700}}>{sub.status}</span>
                        <select value={sub.status} onChange={e=>updateStatus(sub.id,e.target.value)} disabled={updatingId===sub.id}
                          style={{background:'#F8FAFC',color:'#475569',border:'1px solid #E2E8F0',borderRadius:6,padding:'3px 8px',fontSize:11,cursor:'pointer',opacity:updatingId===sub.id?0.5:1}}>
                          {STATUS_OPTIONS.map(o=><option key={o}>{o}</option>)}
                        </select>
                      </div>
                    </div>
                    <div style={{display:'flex',gap:16,flexWrap:'wrap',paddingTop:8,borderTop:'1px solid #F8FAFC'}}>
                      {FIELDS.slice(2,5).filter(f=>sub.data?.[f.name]).map(f=>(
                        <div key={f.name}>
                          <span style={{fontSize:10,color:'#94A3B8',textTransform:'uppercase',letterSpacing:'0.05em',marginRight:4}}>{f.label}:</span>
                          <span style={{fontSize:12,color:'#475569'}}>{String(sub.data[f.name])}</span>
                        </div>
                      ))}
                      <span style={{marginLeft:'auto',fontSize:10,color:'#94A3B8',fontFamily:'monospace'}}>{sub.ticket_id}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
      {showForm&&(
        <div onClick={e=>e.target===e.currentTarget&&setShowForm(false)} style={{position:'fixed',inset:0,background:'rgba(15,23,42,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:50,padding:20,backdropFilter:'blur(4px)'}}>
          <div style={{background:'#fff',borderRadius:16,width:'100%',maxWidth:480,maxHeight:'90vh',overflow:'auto',animation:'slideUp 0.2s ease'}}>
            <div style={{background:PRIMARY,padding:'18px 22px',borderRadius:'16px 16px 0 0',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{fontWeight:700,fontSize:16,color:'#fff'}}>{ACTION_LABEL}</span>
              <button onClick={()=>setShowForm(false)} style={{background:'rgba(255,255,255,0.2)',border:'none',borderRadius:6,width:28,height:28,color:'#fff',cursor:'pointer',fontSize:20}}>×</button>
            </div>
            <div style={{padding:22}}><SubmitForm onSuccess={()=>{load();setTimeout(()=>setShowForm(false),1200)}} onClose={()=>setShowForm(false)}/></div>
          </div>
        </div>
      )}
    </div>
  )
}`
  return wrapHtml(spec.appTitle, infra, app)
}

// ─── 5. TABLE ADMIN ─ full-width data table, filters, drawer ─────────────────
function renderTableAdmin(spec, appId, apiBase) {
  const infra = buildSharedInfra(spec, appId, apiBase)
  const app = `
function App() {
  const [subs,setSubs]=React.useState([])
  const [loading,setLoading]=React.useState(true)
  const [filter,setFilter]=React.useState('All')
  const [search,setSearch]=React.useState('')
  const [drawer,setDrawer]=React.useState(null)
  const [showForm,setShowForm]=React.useState(false)
  const [updatingId,setUpdatingId]=React.useState(null)
  async function load(){
    const r=await fetch(API+'/api/submissions?appId='+APP_ID);const d=await r.json()
    setSubs(d.submissions||[]);setLoading(false)
  }
  React.useEffect(()=>{load()},[])
  async function updateStatus(id,status){
    setUpdatingId(id)
    await fetch(API+'/api/update-status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({submissionId:id,status,appId:APP_ID})})
    setSubs(p=>p.map(s=>s.id===id?{...s,status}:s))
    if(drawer?.id===id)setDrawer(p=>({...p,status}))
    setUpdatingId(null)
  }
  const visible=subs
    .filter(s=>filter==='All'||s.status===filter)
    .filter(s=>!search||JSON.stringify(s.data).toLowerCase().includes(search.toLowerCase())||s.ticket_id.toLowerCase().includes(search.toLowerCase()))
  const displayCols=FIELDS.slice(0,5)
  return (
    <div style={{display:'flex',flexDirection:'column',height:'100vh',background:'#F9FAFB'}}>
      <div style={{background:'#fff',borderBottom:'1px solid #E5E7EB',padding:'0 24px',height:56,display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
        <span style={{fontWeight:800,fontSize:16,color:'#111827'}}>{APP_TITLE}</span>
        <button onClick={()=>setShowForm(true)} style={{background:PRIMARY,color:'#fff',border:'none',borderRadius:8,padding:'8px 16px',fontSize:13,fontWeight:600,cursor:'pointer'}}>+ {ACTION_LABEL}</button>
      </div>
      <div style={{padding:'14px 24px',background:'#fff',borderBottom:'1px solid #F3F4F6',display:'flex',gap:10,alignItems:'center',flexShrink:0}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder='Search...'
          style={{padding:'7px 12px',border:'1px solid #E5E7EB',borderRadius:7,fontSize:13,outline:'none',width:220,background:'#F9FAFB'}}/>
        <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
          {['All',...STATUS_OPTIONS].map(s=>(
            <button key={s} onClick={()=>setFilter(s)} style={{background:filter===s?PRIMARY:'transparent',color:filter===s?'#fff':'#6B7280',border:\`1px solid \${filter===s?PRIMARY:'#E5E7EB'}\`,borderRadius:6,padding:'5px 11px',fontSize:12,fontWeight:600,cursor:'pointer'}}>{s}</button>
          ))}
        </div>
        <span style={{marginLeft:'auto',fontSize:12,color:'#9CA3AF'}}>{visible.length} records</span>
      </div>
      <div style={{flex:1,overflow:'auto'}}>
        {loading?(
          <div style={{display:'flex',justifyContent:'center',padding:48}}><div style={{width:28,height:28,border:\`3px solid \${LIGHT}\`,borderTopColor:PRIMARY,borderRadius:'50%',animation:'spin 0.7s linear infinite'}}/></div>
        ):(
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
            <thead>
              <tr style={{background:'#F9FAFB',borderBottom:'2px solid #F3F4F6',position:'sticky',top:0}}>
                <th style={{padding:'10px 16px',textAlign:'left',fontSize:11,color:'#9CA3AF',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.05em',whiteSpace:'nowrap'}}>#</th>
                {displayCols.map(f=><th key={f.name} style={{padding:'10px 16px',textAlign:'left',fontSize:11,color:'#9CA3AF',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.05em',whiteSpace:'nowrap'}}>{f.label}</th>)}
                <th style={{padding:'10px 16px',textAlign:'left',fontSize:11,color:'#9CA3AF',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.05em'}}>Status</th>
                <th style={{padding:'10px 16px',textAlign:'left',fontSize:11,color:'#9CA3AF',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.05em'}}>Date</th>
                <th style={{padding:'10px 16px'}}/>
              </tr>
            </thead>
            <tbody>
              {visible.length===0?(
                <tr><td colSpan={displayCols.length+4} style={{padding:'48px 16px',textAlign:'center',color:'#9CA3AF'}}>No records found</td></tr>
              ):visible.map(sub=>{
                const sc=statusColor(sub.status)
                return (
                  <tr key={sub.id} style={{borderBottom:'1px solid #F9FAFB',cursor:'pointer'}} onClick={()=>setDrawer(sub)}>
                    <td style={{padding:'12px 16px',fontSize:10,fontFamily:'monospace',color:'#9CA3AF'}}>{sub.ticket_id}</td>
                    {displayCols.map(f=><td key={f.name} style={{padding:'12px 16px',color:'#374151',maxWidth:160,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{String(sub.data?.[f.name]??'')}</td>)}
                    <td style={{padding:'12px 16px'}} onClick={e=>{e.stopPropagation()}}>
                      <select value={sub.status} onChange={e=>updateStatus(sub.id,e.target.value)} disabled={updatingId===sub.id}
                        style={{background:sc.bg,color:sc.text,border:\`1px solid \${sc.dot}44\`,borderRadius:6,padding:'4px 8px',fontSize:11,fontWeight:600,cursor:'pointer',opacity:updatingId===sub.id?0.5:1}}>
                        {STATUS_OPTIONS.map(o=><option key={o}>{o}</option>)}
                      </select>
                    </td>
                    <td style={{padding:'12px 16px',fontSize:11,color:'#9CA3AF',whiteSpace:'nowrap'}}>{fmtDate(sub.submitted_at)}</td>
                    <td style={{padding:'12px 16px'}}>
                      <button onClick={e=>{e.stopPropagation();setDrawer(sub)}} style={{background:'#F3F4F6',color:'#6B7280',border:'none',borderRadius:5,padding:'4px 10px',fontSize:11,cursor:'pointer'}}>View</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
      {drawer&&(
        <div style={{position:'fixed',inset:0,zIndex:40}} onClick={()=>setDrawer(null)}>
          <div onClick={e=>e.stopPropagation()} style={{position:'absolute',right:0,top:0,bottom:0,width:420,background:'#fff',boxShadow:'-4px 0 24px rgba(0,0,0,0.12)',display:'flex',flexDirection:'column',animation:'slideRight 0.2s ease'}}>
            <div style={{padding:'18px 22px',borderBottom:'1px solid #F3F4F6',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div>
                <p style={{margin:'0 0 2px',fontWeight:700,fontSize:16,color:'#111827'}}>{drawer.data?.[FIELDS[0]?.name]||drawer.ticket_id}</p>
                <span style={{fontSize:11,color:'#9CA3AF',fontFamily:'monospace'}}>{drawer.ticket_id}</span>
              </div>
              <button onClick={()=>setDrawer(null)} style={{background:'#F3F4F6',border:'none',borderRadius:7,width:30,height:30,cursor:'pointer',fontSize:18,color:'#6B7280',display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>
            </div>
            <div style={{padding:'18px 22px',borderBottom:'1px solid #F9FAFB'}}>
              <select value={drawer.status} onChange={e=>updateStatus(drawer.id,e.target.value)} disabled={updatingId===drawer.id}
                style={{background:statusColor(drawer.status).bg,color:statusColor(drawer.status).text,border:\`1.5px solid \${statusColor(drawer.status).dot}55\`,borderRadius:8,padding:'8px 14px',fontSize:13,fontWeight:700,cursor:'pointer',width:'100%'}}>
                {STATUS_OPTIONS.map(o=><option key={o}>{o}</option>)}
              </select>
            </div>
            <div style={{flex:1,overflow:'auto',padding:'18px 22px',display:'flex',flexDirection:'column',gap:14}}>
              {FIELDS.map(f=>(
                <div key={f.name}>
                  <div style={{fontSize:10,fontWeight:700,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:4}}>{f.label}</div>
                  <div style={{fontSize:14,color:'#374151'}}>{String(drawer.data?.[f.name]??'—')}</div>
                </div>
              ))}
              <div style={{marginTop:4}}>
                <div style={{fontSize:10,fontWeight:700,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:4}}>Submitted</div>
                <div style={{fontSize:13,color:'#374151'}}>{fmtDateTime(drawer.submitted_at)}</div>
              </div>
            </div>
          </div>
        </div>
      )}
      {showForm&&(
        <div onClick={e=>e.target===e.currentTarget&&setShowForm(false)} style={{position:'fixed',inset:0,background:'rgba(15,23,42,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:50,padding:20}}>
          <div style={{background:'#fff',borderRadius:16,width:'100%',maxWidth:480,maxHeight:'90vh',overflow:'auto'}}>
            <div style={{background:PRIMARY,padding:'18px 22px',borderRadius:'16px 16px 0 0',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{fontWeight:700,fontSize:16,color:'#fff'}}>{ACTION_LABEL}</span>
              <button onClick={()=>setShowForm(false)} style={{background:'rgba(255,255,255,0.2)',border:'none',borderRadius:6,width:28,height:28,color:'#fff',cursor:'pointer',fontSize:20}}>×</button>
            </div>
            <div style={{padding:22}}><SubmitForm onSuccess={()=>{load();setTimeout(()=>setShowForm(false),1200)}} onClose={()=>setShowForm(false)}/></div>
          </div>
        </div>
      )}
    </div>
  )
}`
  return wrapHtml(spec.appTitle, infra, app)
}

// ─── 6. WIZARD FLOW ─ step-by-step centered form with progress ────────────────
function renderWizard(spec, appId, apiBase) {
  const primary = spec.colorTheme?.primary || '#7C3AED'
  const infra = buildSharedInfra(spec, appId, apiBase)
  const chunkSize = 3
  const app = `
const STEPS = (function(){
  const chunks=[];const total=FIELDS.length;const size=${chunkSize}
  for(let i=0;i<total;i+=size)chunks.push(FIELDS.slice(i,i+size))
  return chunks.length>0?chunks:[FIELDS]
})()
const STEP_LABELS=STEPS.map((_,i)=>\`Step \${i+1}\`)
function App() {
  const [step,setStep]=React.useState(0)
  const [form,setForm]=React.useState({})
  const [submitting,setSubmitting]=React.useState(false)
  const [done,setDone]=React.useState(null)
  const [error,setError]=React.useState('')
  const [history,setHistory]=React.useState([])
  const [loadingHistory,setLoadingHistory]=React.useState(true)
  function update(name,val){setForm(p=>({...p,[name]:val}))}
  async function loadHistory(){
    const r=await fetch(API+'/api/submissions?appId='+APP_ID);const d=await r.json()
    setHistory(d.submissions||[]);setLoadingHistory(false)
  }
  React.useEffect(()=>{loadHistory()},[])
  async function submit(){
    setSubmitting(true);setError('')
    try{
      const res=await fetch(API+'/api/submit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({appId:APP_ID,formData:form})})
      const data=await res.json()
      if(!res.ok)throw new Error(data.error||'Submit failed')
      setDone(data.ticketId);loadHistory()
    }catch(err){setError(err.message)}
    finally{setSubmitting(false)}
  }
  const isLast=step===STEPS.length-1
  if(done) return (
    <div style={{minHeight:'100vh',background:'#F8FAFC',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{background:'#fff',borderRadius:20,padding:'48px 40px',maxWidth:440,width:'100%',textAlign:'center',boxShadow:'0 8px 40px rgba(0,0,0,0.1)'}}>
        <div style={{width:64,height:64,borderRadius:'50%',background:LIGHT,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 20px'}}>
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="M4 14l6.5 6.5 13-13" stroke={PRIMARY} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
        <h2 style={{margin:'0 0 8px',fontSize:22,fontWeight:800,color:'#111827'}}>Submitted!</h2>
        <p style={{margin:'0 0 6px',fontSize:14,color:'#6B7280'}}>Your reference number</p>
        <p style={{margin:'0 0 28px',fontSize:18,fontWeight:700,color:PRIMARY,fontFamily:'monospace'}}>{done}</p>
        <button onClick={()=>{setDone(null);setForm({});setStep(0)}} style={{background:PRIMARY,color:'#fff',border:'none',borderRadius:10,padding:'12px 28px',fontSize:14,fontWeight:700,cursor:'pointer'}}>Submit another</button>
      </div>
    </div>
  )
  return (
    <div style={{minHeight:'100vh',background:'#F8FAFC',display:'flex',flexDirection:'column'}}>
      <div style={{background:'#fff',borderBottom:'1px solid #F1F5F9',padding:'0 24px',height:56,display:'flex',alignItems:'center',boxShadow:'0 1px 4px rgba(0,0,0,0.04)'}}>
        <span style={{fontWeight:800,fontSize:16,color:'#0F172A'}}>{APP_TITLE}</span>
      </div>
      <div style={{flex:1,display:'flex',alignItems:'flex-start',justifyContent:'center',padding:'40px 24px',gap:32}}>
        <div style={{background:'#fff',borderRadius:20,padding:'36px 40px',maxWidth:520,width:'100%',boxShadow:'0 4px 24px rgba(0,0,0,0.08)'}}>
          <div style={{marginBottom:32}}>
            <div style={{display:'flex',gap:0,marginBottom:24}}>
              {STEPS.map((_,i)=>(
                <React.Fragment key={i}>
                  <div style={{display:'flex',flexDirection:'column',alignItems:'center',flex:1}}>
                    <div style={{width:32,height:32,borderRadius:'50%',background:i<step?PRIMARY:i===step?PRIMARY:LIGHT,border:\`2px solid \${i<=step?PRIMARY:LIGHT}\`,display:'flex',alignItems:'center',justifyContent:'center',marginBottom:6}}>
                      {i<step?<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7l3.5 3.5 6.5-6.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        :<span style={{fontSize:12,fontWeight:700,color:i===step?'#fff':PRIMARY}}>{i+1}</span>}
                    </div>
                    <span style={{fontSize:10,color:i===step?PRIMARY:'#94A3B8',fontWeight:i===step?700:400}}>{STEP_LABELS[i]}</span>
                  </div>
                  {i<STEPS.length-1&&<div style={{flex:2,height:2,background:i<step?PRIMARY:LIGHT,marginTop:16,alignSelf:'flex-start'}}/>}
                </React.Fragment>
              ))}
            </div>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:18,marginBottom:28}}>
            {STEPS[step].map(f=>(
              <div key={f.name}>
                <label style={{display:'block',fontSize:12,fontWeight:700,color:'#374151',marginBottom:6}}>{f.label}{f.required&&<span style={{color:PRIMARY,marginLeft:2}}>*</span>}</label>
                <FieldInput field={f} value={form[f.name]} onChange={update}/>
              </div>
            ))}
          </div>
          {error&&<p style={{margin:'0 0 16px',padding:'10px 14px',background:'#FEF2F2',color:'#DC2626',borderRadius:8,fontSize:13}}>{error}</p>}
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <button onClick={()=>setStep(p=>Math.max(0,p-1))} disabled={step===0} style={{background:'#F3F4F6',color:'#6B7280',border:'none',borderRadius:9,padding:'10px 20px',fontSize:13,fontWeight:600,cursor:step===0?'default':'pointer',opacity:step===0?0.5:1}}>← Back</button>
            {isLast?(
              <button onClick={submit} disabled={submitting} style={{background:PRIMARY,color:'#fff',border:'none',borderRadius:9,padding:'10px 24px',fontSize:13,fontWeight:700,cursor:'pointer'}}>{submitting?'Submitting...':ACTION_LABEL}</button>
            ):(
              <button onClick={()=>setStep(p=>p+1)} style={{background:PRIMARY,color:'#fff',border:'none',borderRadius:9,padding:'10px 24px',fontSize:13,fontWeight:700,cursor:'pointer'}}>Continue →</button>
            )}
          </div>
        </div>
        {history.length>0&&(
          <div style={{width:280,flexShrink:0,display:'none'}}/>
        )}
      </div>
      {!loadingHistory&&history.length>0&&(
        <div style={{background:'#fff',borderTop:'1px solid #F1F5F9',padding:'20px 24px'}}>
          <p style={{margin:'0 0 12px',fontSize:12,fontWeight:700,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'0.05em'}}>Recent Submissions</p>
          <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
            {history.slice(0,6).map(sub=>{
              const sc=statusColor(sub.status)
              return(
                <div key={sub.id} style={{background:'#F9FAFB',borderRadius:8,padding:'8px 12px',border:'1px solid #F3F4F6'}}>
                  <p style={{margin:'0 0 3px',fontSize:12,fontWeight:600,color:'#374151'}}>{sub.data?.[FIELDS[0]?.name]||sub.ticket_id}</p>
                  <div style={{display:'flex',alignItems:'center',gap:6}}>
                    <span style={{background:sc.bg,color:sc.text,borderRadius:4,padding:'1px 6px',fontSize:10,fontWeight:700}}>{sub.status}</span>
                    <span style={{fontSize:10,color:'#9CA3AF',fontFamily:'monospace'}}>{sub.ticket_id}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}`
  return wrapHtml(spec.appTitle, infra, app)
}

// ─── 7. SPLIT PANEL REVIEW ─ form/intake left + review/approval right ─────────
function renderSplitReview(spec, appId, apiBase) {
  const primary = spec.colorTheme?.primary || '#7C3AED'
  const infra = buildSharedInfra(spec, appId, apiBase)
  const app = `
function App() {
  const [subs,setSubs]=React.useState([])
  const [loading,setLoading]=React.useState(true)
  const [filter,setFilter]=React.useState('All')
  const [updatingId,setUpdatingId]=React.useState(null)
  async function load(){
    const r=await fetch(API+'/api/submissions?appId='+APP_ID);const d=await r.json()
    setSubs(d.submissions||[]);setLoading(false)
  }
  React.useEffect(()=>{load()},[])
  async function updateStatus(id,status){
    setUpdatingId(id)
    await fetch(API+'/api/update-status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({submissionId:id,status,appId:APP_ID})})
    setSubs(p=>p.map(s=>s.id===id?{...s,status}:s))
    setUpdatingId(null)
  }
  const visible=filter==='All'?subs:subs.filter(s=>s.status===filter)
  const firstStatus=STATUS_OPTIONS[0]
  const approveStatus=STATUS_OPTIONS[1]||STATUS_OPTIONS[STATUS_OPTIONS.length-1]
  const rejectStatus=STATUS_OPTIONS[STATUS_OPTIONS.length-1]
  return (
    <div style={{display:'flex',height:'100vh',background:'#F8FAFC'}}>
      <div style={{width:400,flexShrink:0,background:'#fff',borderRight:'1px solid #E2E8F0',display:'flex',flexDirection:'column'}}>
        <div style={{background:\`linear-gradient(135deg, \${PRIMARY}, \${PRIMARY}CC)\`,padding:'20px 24px'}}>
          <p style={{margin:'0 0 2px',fontWeight:800,fontSize:18,color:'#fff'}}>{APP_TITLE}</p>
          <p style={{margin:0,fontSize:13,color:'rgba(255,255,255,0.75)'}}>Submit a new entry for review</p>
        </div>
        <div style={{padding:'22px 24px',flex:1,overflow:'auto'}}>
          <SubmitForm onSuccess={load}/>
        </div>
      </div>
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
        <div style={{background:'#fff',borderBottom:'1px solid #E2E8F0',padding:'12px 20px',display:'flex',gap:6,alignItems:'center',flexShrink:0}}>
          <span style={{fontSize:13,fontWeight:700,color:'#374151',marginRight:6}}>Review Queue</span>
          {['All',...STATUS_OPTIONS].map(s=>{
            const cnt=s==='All'?subs.length:subs.filter(x=>x.status===s).length
            return(
              <button key={s} onClick={()=>setFilter(s)} style={{background:filter===s?PRIMARY:'#F9FAFB',color:filter===s?'#fff':'#6B7280',border:\`1px solid \${filter===s?PRIMARY:'#E5E7EB'}\`,borderRadius:6,padding:'4px 11px',fontSize:11,fontWeight:600,cursor:'pointer'}}>{s} ({cnt})</button>
            )
          })}
        </div>
        <div style={{flex:1,overflow:'auto',padding:'16px 20px',display:'flex',flexDirection:'column',gap:10}}>
          {loading?<div style={{padding:32,textAlign:'center',color:'#9CA3AF'}}>Loading...</div>
          :visible.length===0?<div style={{padding:48,textAlign:'center',color:'#9CA3AF',fontSize:13}}>No submissions to review</div>
          :visible.map(sub=>{
            const sc=statusColor(sub.status)
            const isPending=sub.status===firstStatus
            return(
              <div key={sub.id} style={{background:'#fff',borderRadius:12,border:\`1px solid \${isPending?PRIMARY+'44':'#E2E8F0'}\`,padding:'16px 20px',animation:'fadeIn 0.2s ease',boxShadow:isPending?'0 0 0 3px '+PRIMARY+'11':'none'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
                  <div>
                    <p style={{margin:'0 0 3px',fontWeight:700,fontSize:15,color:'#0F172A'}}>{sub.data?.[FIELDS[0]?.name]||sub.ticket_id}</p>
                    {FIELDS[1]&&<p style={{margin:0,fontSize:12,color:'#64748B'}}>{sub.data?.[FIELDS[1]?.name]}</p>}
                  </div>
                  <span style={{background:sc.bg,color:sc.text,borderRadius:6,padding:'4px 10px',fontSize:12,fontWeight:700,flexShrink:0,marginLeft:12}}>{sub.status}</span>
                </div>
                <div style={{display:'flex',gap:16,marginBottom:10,flexWrap:'wrap'}}>
                  {FIELDS.slice(2,5).filter(f=>sub.data?.[f.name]).map(f=>(
                    <div key={f.name}>
                      <span style={{fontSize:10,color:'#94A3B8',textTransform:'uppercase',letterSpacing:'0.05em'}}>{f.label}: </span>
                      <span style={{fontSize:12,color:'#374151',fontWeight:500}}>{String(sub.data[f.name])}</span>
                    </div>
                  ))}
                </div>
                {isPending&&(
                  <div style={{display:'flex',gap:8,paddingTop:10,borderTop:'1px solid #F1F5F9'}}>
                    <button onClick={()=>updateStatus(sub.id,approveStatus)} disabled={updatingId===sub.id}
                      style={{flex:1,background:'#F0FDF4',color:'#15803D',border:'1px solid #86EFAC',borderRadius:7,padding:'8px 0',fontSize:12,fontWeight:700,cursor:'pointer'}}>✓ {approveStatus}</button>
                    <button onClick={()=>updateStatus(sub.id,rejectStatus)} disabled={updatingId===sub.id}
                      style={{flex:1,background:'#FEF2F2',color:'#B91C1C',border:'1px solid #FCA5A5',borderRadius:7,padding:'8px 0',fontSize:12,fontWeight:700,cursor:'pointer'}}>✗ {rejectStatus}</button>
                    <select value={sub.status} onChange={e=>updateStatus(sub.id,e.target.value)} disabled={updatingId===sub.id}
                      style={{padding:'7px 10px',border:'1px solid #E2E8F0',borderRadius:7,fontSize:11,color:'#6B7280',cursor:'pointer',background:'#F9FAFB'}}>
                      {STATUS_OPTIONS.map(o=><option key={o}>{o}</option>)}
                    </select>
                  </div>
                )}
                <div style={{display:'flex',justifyContent:'space-between',marginTop:8}}>
                  <span style={{fontSize:10,color:'#94A3B8',fontFamily:'monospace'}}>{sub.ticket_id}</span>
                  <span style={{fontSize:10,color:'#94A3B8'}}>{fmtDate(sub.submitted_at)}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}`
  return wrapHtml(spec.appTitle, infra, app)
}

// ─── 8. WORKFLOW PIPELINE ─ horizontal stage funnel with counts ────────────────
function renderPipeline(spec, appId, apiBase) {
  const primary = spec.colorTheme?.primary || '#7C3AED'
  const infra = buildSharedInfra(spec, appId, apiBase)
  const app = `
function App() {
  const [subs,setSubs]=React.useState([])
  const [loading,setLoading]=React.useState(true)
  const [activeStage,setActiveStage]=React.useState(null)
  const [showForm,setShowForm]=React.useState(false)
  const [updatingId,setUpdatingId]=React.useState(null)
  async function load(){
    const r=await fetch(API+'/api/submissions?appId='+APP_ID);const d=await r.json()
    setSubs(d.submissions||[]);setLoading(false)
  }
  React.useEffect(()=>{load()},[])
  async function updateStatus(id,status){
    setUpdatingId(id)
    await fetch(API+'/api/update-status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({submissionId:id,status,appId:APP_ID})})
    setSubs(p=>p.map(s=>s.id===id?{...s,status}:s))
    setUpdatingId(null)
  }
  const stageCounts=STATUS_OPTIONS.map(s=>({status:s,count:subs.filter(x=>x.status===s).length,items:subs.filter(x=>x.status===s)}))
  const displayItems=activeStage?subs.filter(s=>s.status===activeStage):subs
  return (
    <div style={{display:'flex',flexDirection:'column',height:'100vh',background:'#F8FAFC'}}>
      <div style={{background:'#fff',borderBottom:'1px solid #E5E7EB',padding:'0 24px',height:56,display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
        <span style={{fontWeight:800,fontSize:16,color:'#111827'}}>{APP_TITLE}</span>
        <div style={{display:'flex',gap:10,alignItems:'center'}}>
          <span style={{fontSize:12,color:'#9CA3AF'}}>{subs.length} total</span>
          <button onClick={()=>setShowForm(true)} style={{background:PRIMARY,color:'#fff',border:'none',borderRadius:8,padding:'8px 16px',fontSize:13,fontWeight:600,cursor:'pointer'}}>+ {ACTION_LABEL}</button>
        </div>
      </div>
      <div style={{background:'#fff',borderBottom:'1px solid #E5E7EB',padding:'16px 24px',flexShrink:0}}>
        <div style={{display:'flex',alignItems:'stretch',gap:0}}>
          {stageCounts.map((stage,i)=>{
            const sc=STATUS_COLORS[i%STATUS_COLORS.length]
            const isActive=activeStage===stage.status
            const pct=subs.length>0?Math.round(stage.count/subs.length*100):0
            return(
              <React.Fragment key={stage.status}>
                <div onClick={()=>setActiveStage(isActive?null:stage.status)} style={{flex:1,padding:'14px 18px',cursor:'pointer',background:isActive?LIGHT:'transparent',borderRadius:isActive?8:0,border:isActive?\`2px solid \${PRIMARY}\`:'2px solid transparent',transition:'all 0.15s'}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
                    <span style={{fontSize:12,color:'#6B7280',fontWeight:600}}>{stage.status}</span>
                    <span style={{fontSize:20,fontWeight:800,color:isActive?PRIMARY:'#111827'}}>{stage.count}</span>
                  </div>
                  <div style={{height:4,background:'#F3F4F6',borderRadius:2,overflow:'hidden'}}>
                    <div style={{height:'100%',width:pct+'%',background:sc.dot,borderRadius:2,transition:'width 0.3s'}}/>
                  </div>
                  <div style={{fontSize:10,color:'#9CA3AF',marginTop:4}}>{pct}% of total</div>
                </div>
                {i<stageCounts.length-1&&<div style={{display:'flex',alignItems:'center',padding:'0 4px',color:'#D1D5DB',fontSize:18}}>›</div>}
              </React.Fragment>
            )
          })}
        </div>
      </div>
      <div style={{flex:1,overflow:'auto',padding:'16px 24px'}}>
        {activeStage&&<div style={{marginBottom:12,display:'flex',alignItems:'center',gap:8}}>
          <span style={{fontSize:14,fontWeight:700,color:'#374151'}}>{activeStage}</span>
          <span style={{fontSize:12,color:'#9CA3AF'}}>({displayItems.length} items)</span>
          <button onClick={()=>setActiveStage(null)} style={{marginLeft:8,background:'#F3F4F6',color:'#6B7280',border:'none',borderRadius:5,padding:'3px 8px',fontSize:11,cursor:'pointer'}}>× clear</button>
        </div>}
        {loading?<div style={{padding:32,textAlign:'center',color:'#9CA3AF'}}>Loading...</div>
        :displayItems.length===0?<div style={{padding:48,textAlign:'center',color:'#9CA3AF',fontSize:13}}>No items in this stage</div>
        :<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:12}}>
          {displayItems.map(sub=>{
            const sc=statusColor(sub.status)
            return(
              <div key={sub.id} style={{background:'#fff',borderRadius:12,padding:'14px 16px',border:'1px solid #E5E7EB',boxShadow:'0 1px 4px rgba(0,0,0,0.05)',animation:'fadeIn 0.2s ease'}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
                  <p style={{margin:0,fontWeight:700,fontSize:14,color:'#111827',flex:1,paddingRight:8}}>{sub.data?.[FIELDS[0]?.name]||sub.ticket_id}</p>
                  <span style={{background:sc.bg,color:sc.text,borderRadius:5,padding:'3px 8px',fontSize:10,fontWeight:700,flexShrink:0,height:'fit-content'}}>{sub.status}</span>
                </div>
                {FIELDS.slice(1,4).map(f=>sub.data?.[f.name]&&(
                  <div key={f.name} style={{fontSize:12,color:'#6B7280',marginBottom:3}}>
                    <span style={{fontWeight:600}}>{f.label}:</span> {String(sub.data[f.name])}
                  </div>
                ))}
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:10,paddingTop:8,borderTop:'1px solid #F9FAFB'}}>
                  <span style={{fontSize:10,color:'#9CA3AF',fontFamily:'monospace'}}>{sub.ticket_id}</span>
                  <select value={sub.status} onChange={e=>updateStatus(sub.id,e.target.value)} disabled={updatingId===sub.id}
                    style={{background:'#F9FAFB',color:'#374151',border:'1px solid #E5E7EB',borderRadius:6,padding:'4px 8px',fontSize:11,cursor:'pointer',opacity:updatingId===sub.id?0.5:1}}>
                    {STATUS_OPTIONS.map(o=><option key={o}>{o}</option>)}
                  </select>
                </div>
              </div>
            )
          })}
        </div>}
      </div>
      {showForm&&(
        <div onClick={e=>e.target===e.currentTarget&&setShowForm(false)} style={{position:'fixed',inset:0,background:'rgba(15,23,42,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:50,padding:20}}>
          <div style={{background:'#fff',borderRadius:16,width:'100%',maxWidth:480,maxHeight:'90vh',overflow:'auto'}}>
            <div style={{background:PRIMARY,padding:'18px 22px',borderRadius:'16px 16px 0 0',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{fontWeight:700,fontSize:16,color:'#fff'}}>{ACTION_LABEL}</span>
              <button onClick={()=>setShowForm(false)} style={{background:'rgba(255,255,255,0.2)',border:'none',borderRadius:6,width:28,height:28,color:'#fff',cursor:'pointer',fontSize:20}}>×</button>
            </div>
            <div style={{padding:22}}><SubmitForm onSuccess={()=>{load();setTimeout(()=>setShowForm(false),1200)}} onClose={()=>setShowForm(false)}/></div>
          </div>
        </div>
      )}
    </div>
  )
}`
  return wrapHtml(spec.appTitle, infra, app)
}

// ─── 9. FORM FIRST ADMIN ─ prominent form top, recent submissions below ────────
function renderFormAdmin(spec, appId, apiBase) {
  const infra = buildSharedInfra(spec, appId, apiBase)
  const app = `
function App() {
  const [subs,setSubs]=React.useState([])
  const [loading,setLoading]=React.useState(true)
  const [updatingId,setUpdatingId]=React.useState(null)
  async function load(){
    const r=await fetch(API+'/api/submissions?appId='+APP_ID);const d=await r.json()
    setSubs(d.submissions||[]);setLoading(false)
  }
  React.useEffect(()=>{load()},[])
  async function updateStatus(id,status){
    setUpdatingId(id)
    await fetch(API+'/api/update-status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({submissionId:id,status,appId:APP_ID})})
    setSubs(p=>p.map(s=>s.id===id?{...s,status}:s))
    setUpdatingId(null)
  }
  return (
    <div style={{minHeight:'100vh',background:'#F8FAFC'}}>
      <div style={{background:'#fff',borderBottom:'1px solid #F1F5F9',padding:'0 24px',height:56,display:'flex',alignItems:'center',boxShadow:'0 1px 4px rgba(0,0,0,0.04)'}}>
        <span style={{fontWeight:800,fontSize:16,color:'#0F172A'}}>{APP_TITLE}</span>
        <span style={{marginLeft:10,fontSize:12,color:'#94A3B8',background:'#F1F5F9',borderRadius:4,padding:'2px 8px'}}>{APP_TYPE}</span>
      </div>
      <div style={{maxWidth:840,margin:'0 auto',padding:'28px 24px'}}>
        <div style={{background:'#fff',borderRadius:16,border:'1px solid #E2E8F0',overflow:'hidden',marginBottom:28,boxShadow:'0 2px 12px rgba(0,0,0,0.06)'}}>
          <div style={{background:\`linear-gradient(135deg, \${PRIMARY}, \${PRIMARY}DD)\`,padding:'20px 28px'}}>
            <p style={{margin:'0 0 3px',fontWeight:800,fontSize:18,color:'#fff'}}>{ACTION_LABEL}</p>
            <p style={{margin:0,fontSize:13,color:'rgba(255,255,255,0.75)'}}>Fill in the details below to submit</p>
          </div>
          <div style={{padding:'24px 28px'}}>
            <SubmitForm onSuccess={load}/>
          </div>
        </div>
        <div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
            <p style={{margin:0,fontWeight:700,fontSize:14,color:'#374151'}}>Recent Submissions</p>
            <span style={{fontSize:12,color:'#94A3B8'}}>{subs.length} total</span>
          </div>
          {loading?<div style={{padding:32,textAlign:'center',color:'#94A3B8'}}>Loading...</div>
          :subs.length===0?<div style={{padding:'32px 24px',textAlign:'center',color:'#94A3B8',background:'#fff',borderRadius:12,border:'1px solid #F1F5F9',fontSize:13}}>No submissions yet — fill in the form above to get started.</div>
          :<div style={{display:'flex',flexDirection:'column',gap:8}}>
            {subs.map(sub=>{
              const sc=statusColor(sub.status)
              return(
                <div key={sub.id} style={{background:'#fff',borderRadius:10,padding:'14px 18px',border:'1px solid #F1F5F9',display:'flex',alignItems:'center',gap:16,animation:'fadeIn 0.2s ease'}}>
                  <div style={{width:3,alignSelf:'stretch',borderRadius:2,background:sc.dot,flexShrink:0}}/>
                  <div style={{flex:1,minWidth:0}}>
                    <p style={{margin:'0 0 3px',fontWeight:600,fontSize:14,color:'#0F172A'}}>{sub.data?.[FIELDS[0]?.name]||sub.ticket_id}</p>
                    <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
                      {FIELDS.slice(1,4).filter(f=>sub.data?.[f.name]).map(f=>(
                        <span key={f.name} style={{fontSize:11,color:'#64748B'}}>{f.label}: {String(sub.data[f.name])}</span>
                      ))}
                    </div>
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:8,flexShrink:0}}>
                    <span style={{fontSize:10,color:'#94A3B8',fontFamily:'monospace'}}>{sub.ticket_id}</span>
                    <select value={sub.status} onChange={e=>updateStatus(sub.id,e.target.value)} disabled={updatingId===sub.id}
                      style={{background:sc.bg,color:sc.text,border:\`1px solid \${sc.dot}44\`,borderRadius:6,padding:'4px 9px',fontSize:11,fontWeight:700,cursor:'pointer',opacity:updatingId===sub.id?0.5:1}}>
                      {STATUS_OPTIONS.map(o=><option key={o}>{o}</option>)}
                    </select>
                  </div>
                </div>
              )
            })}
          </div>}
        </div>
      </div>
    </div>
  )
}`
  return wrapHtml(spec.appTitle, infra, app)
}

// ─── 10. DOCUMENT WORKSPACE ─ document preview left + annotation/action right ─
function renderDocument(spec, appId, apiBase) {
  const infra = buildSharedInfra(spec, appId, apiBase)
  const app = `
function App() {
  const [subs,setSubs]=React.useState([])
  const [selected,setSelected]=React.useState(null)
  const [loading,setLoading]=React.useState(true)
  const [showForm,setShowForm]=React.useState(false)
  const [updatingId,setUpdatingId]=React.useState(null)
  async function load(){
    const r=await fetch(API+'/api/submissions?appId='+APP_ID);const d=await r.json()
    const items=d.submissions||[];setSubs(items)
    if(items.length>0&&!selected)setSelected(items[0])
    setLoading(false)
  }
  React.useEffect(()=>{load()},[])
  async function updateStatus(id,status){
    setUpdatingId(id)
    await fetch(API+'/api/update-status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({submissionId:id,status,appId:APP_ID})})
    setSubs(p=>p.map(s=>s.id===id?{...s,status}:s))
    if(selected?.id===id)setSelected(p=>({...p,status}))
    setUpdatingId(null)
  }
  const sc=selected?statusColor(selected.status):null
  return (
    <div style={{height:'100vh',display:'flex',flexDirection:'column',background:'#F8FAFC',fontFamily:'system-ui,sans-serif'}}>
      <div style={{background:'#1E293B',padding:'0 20px',height:52,display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <span style={{fontWeight:800,fontSize:15,color:'#fff'}}>{APP_TITLE}</span>
          <span style={{fontSize:11,color:'#64748B',background:'#0F172A',borderRadius:4,padding:'2px 7px'}}>{APP_TYPE}</span>
        </div>
        <button onClick={()=>setShowForm(true)} style={{background:PRIMARY,color:'#fff',border:'none',borderRadius:7,padding:'7px 16px',fontSize:12,fontWeight:700,cursor:'pointer'}}>{ACTION_LABEL}</button>
      </div>
      <div style={{flex:1,display:'flex',minHeight:0}}>
        {/* Left: document list */}
        <div style={{width:260,borderRight:'1px solid #E2E8F0',background:'#fff',display:'flex',flexDirection:'column',flexShrink:0,overflowY:'auto'}}>
          <div style={{padding:'14px 16px',borderBottom:'1px solid #F1F5F9'}}>
            <p style={{margin:0,fontSize:11,fontWeight:700,color:'#94A3B8',letterSpacing:'0.05em',textTransform:'uppercase'}}>Documents ({subs.length})</p>
          </div>
          {loading?<div style={{padding:20,textAlign:'center',color:'#94A3B8',fontSize:12}}>Loading...</div>
          :subs.length===0?<div style={{padding:20,textAlign:'center',color:'#94A3B8',fontSize:12}}>No documents yet</div>
          :subs.map(sub=>{
            const s=statusColor(sub.status)
            const isActive=selected?.id===sub.id
            return(
              <div key={sub.id} onClick={()=>setSelected(sub)} style={{padding:'12px 16px',cursor:'pointer',borderBottom:'1px solid #F8FAFC',background:isActive?LIGHT:'transparent',borderLeft:isActive?\`3px solid \${PRIMARY}\`:'3px solid transparent'}}>
                <p style={{margin:'0 0 4px',fontWeight:600,fontSize:13,color:'#0F172A',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{sub.data?.[FIELDS[0]?.name]||sub.ticket_id}</p>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <span style={{fontSize:10,color:s.text,background:s.bg,borderRadius:4,padding:'2px 6px',fontWeight:600}}>{sub.status}</span>
                  <span style={{fontSize:10,color:'#94A3B8'}}>{fmtDate(sub.created_at)}</span>
                </div>
              </div>
            )
          })}
        </div>
        {/* Right: document detail */}
        <div style={{flex:1,display:'flex',flexDirection:'column',overflowY:'auto',padding:32}}>
          {!selected?(
            <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:12,color:'#94A3B8'}}>
              <div style={{width:56,height:56,borderRadius:14,background:'#F1F5F9',display:'flex',alignItems:'center',justifyContent:'center',fontSize:24}}>📄</div>
              <p style={{margin:0,fontSize:14,fontWeight:500}}>Select a document to review</p>
            </div>
          ):(
            <div style={{maxWidth:720}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:24}}>
                <div>
                  <p style={{margin:'0 0 6px',fontWeight:800,fontSize:22,color:'#0F172A'}}>{selected.data?.[FIELDS[0]?.name]||selected.ticket_id}</p>
                  <div style={{display:'flex',gap:8,alignItems:'center'}}>
                    <span style={{fontSize:11,fontFamily:'monospace',color:'#94A3B8'}}>{selected.ticket_id}</span>
                    <span>·</span>
                    <span style={{fontSize:12,color:'#64748B'}}>{fmtDateTime(selected.created_at)}</span>
                  </div>
                </div>
                <div style={{display:'flex',gap:8}}>
                  {STATUS_OPTIONS.map(opt=>{
                    const s=statusColor(opt)
                    const isActive=selected.status===opt
                    return(
                      <button key={opt} disabled={updatingId===selected.id} onClick={()=>updateStatus(selected.id,opt)}
                        style={{background:isActive?s.dot:'#fff',color:isActive?'#fff':s.text,border:\`1.5px solid \${s.dot}\`,borderRadius:6,padding:'6px 14px',fontSize:12,fontWeight:700,cursor:'pointer',opacity:updatingId===selected.id?0.5:1}}>
                        {opt}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div style={{background:'#fff',borderRadius:14,border:'1px solid #E2E8F0',overflow:'hidden',boxShadow:'0 2px 12px rgba(0,0,0,0.05)'}}>
                <div style={{background:\`linear-gradient(135deg,\${PRIMARY}18,\${PRIMARY}08)\`,borderBottom:'1px solid #E2E8F0',padding:'16px 24px'}}>
                  <p style={{margin:0,fontSize:12,fontWeight:700,color:PRIMARY,textTransform:'uppercase',letterSpacing:'0.06em'}}>Document Details</p>
                </div>
                <div style={{padding:24,display:'grid',gridTemplateColumns:'1fr 1fr',gap:'20px 32px'}}>
                  {FIELDS.map(f=>(
                    <div key={f.name}>
                      <p style={{margin:'0 0 4px',fontSize:11,fontWeight:700,color:'#94A3B8',textTransform:'uppercase',letterSpacing:'0.05em'}}>{f.label}</p>
                      <p style={{margin:0,fontSize:14,color:'#0F172A',fontWeight:500}}>{selected.data?.[f.name]||'—'}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      {showForm&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:50}}>
          <div style={{background:'#fff',borderRadius:16,width:520,maxHeight:'85vh',overflowY:'auto',boxShadow:'0 20px 60px rgba(0,0,0,0.3)'}}>
            <div style={{padding:'20px 24px',borderBottom:'1px solid #F1F5F9',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <p style={{margin:0,fontWeight:800,fontSize:16,color:'#0F172A'}}>{ACTION_LABEL}</p>
              <button onClick={()=>setShowForm(false)} style={{background:'none',border:'none',fontSize:20,cursor:'pointer',color:'#94A3B8',lineHeight:1}}>×</button>
            </div>
            <div style={{padding:'20px 24px'}}>
              <SubmitForm onSuccess={()=>{setShowForm(false);load()}}/>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}`
  return wrapHtml(spec.appTitle, infra, app)
}

// ─── 11. CALENDAR SCHEDULER ─ time-based grid, resource + slot management ─────
function renderCalendar(spec, appId, apiBase) {
  const infra = buildSharedInfra(spec, appId, apiBase)
  const app = `
function App() {
  const [subs,setSubs]=React.useState([])
  const [loading,setLoading]=React.useState(true)
  const [showForm,setShowForm]=React.useState(false)
  const [selectedDay,setSelectedDay]=React.useState(null)
  const [updatingId,setUpdatingId]=React.useState(null)
  const today=new Date()
  const [viewMonth,setViewMonth]=React.useState(today.getMonth())
  const [viewYear,setViewYear]=React.useState(today.getFullYear())
  async function load(){
    const r=await fetch(API+'/api/submissions?appId='+APP_ID);const d=await r.json()
    setSubs(d.submissions||[]);setLoading(false)
  }
  React.useEffect(()=>{load()},[])
  async function updateStatus(id,status){
    setUpdatingId(id)
    await fetch(API+'/api/update-status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({submissionId:id,status,appId:APP_ID})})
    setSubs(p=>p.map(s=>s.id===id?{...s,status}:s))
    setUpdatingId(null)
  }
  const monthNames=['January','February','March','April','May','June','July','August','September','October','November','December']
  const daysInMonth=new Date(viewYear,viewMonth+1,0).getDate()
  const firstDayOfWeek=new Date(viewYear,viewMonth,1).getDay()
  const dateKey=d=>\`\${viewYear}-\${String(viewMonth+1).padStart(2,'0')}-\${String(d).padStart(2,'0')}\`
  const subsByDate=React.useMemo(()=>{
    const m={}
    subs.forEach(s=>{
      const d=s.created_at?.split('T')[0]
      if(d)m[d]=(m[d]||[]).concat(s)
    })
    return m
  },[subs])
  const dayItems=selectedDay?subsByDate[selectedDay]||[]:[]
  return(
    <div style={{height:'100vh',display:'flex',flexDirection:'column',background:'#F8FAFC',fontFamily:'system-ui,sans-serif'}}>
      <div style={{background:'#fff',borderBottom:'1px solid #E2E8F0',padding:'0 24px',height:56,display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0,boxShadow:'0 1px 4px rgba(0,0,0,0.04)'}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <span style={{fontWeight:800,fontSize:16,color:'#0F172A'}}>{APP_TITLE}</span>
          <span style={{fontSize:11,color:'#94A3B8',background:'#F1F5F9',borderRadius:4,padding:'2px 7px'}}>{APP_TYPE}</span>
        </div>
        <button onClick={()=>setShowForm(true)} style={{background:PRIMARY,color:'#fff',border:'none',borderRadius:7,padding:'8px 18px',fontSize:13,fontWeight:700,cursor:'pointer'}}>{ACTION_LABEL}</button>
      </div>
      <div style={{flex:1,display:'flex',minHeight:0}}>
        {/* Calendar Grid */}
        <div style={{flex:1,padding:24,display:'flex',flexDirection:'column',minWidth:0}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
            <button onClick={()=>{if(viewMonth===0){setViewMonth(11);setViewYear(y=>y-1)}else setViewMonth(m=>m-1)}}
              style={{background:'#F1F5F9',border:'none',borderRadius:6,padding:'6px 12px',cursor:'pointer',fontWeight:700,fontSize:14,color:'#374151'}}>‹</button>
            <p style={{margin:0,fontWeight:800,fontSize:18,color:'#0F172A'}}>{monthNames[viewMonth]} {viewYear}</p>
            <button onClick={()=>{if(viewMonth===11){setViewMonth(0);setViewYear(y=>y+1)}else setViewMonth(m=>m+1)}}
              style={{background:'#F1F5F9',border:'none',borderRadius:6,padding:'6px 12px',cursor:'pointer',fontWeight:700,fontSize:14,color:'#374151'}}>›</button>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:2,flex:1}}>
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=>(
              <div key={d} style={{textAlign:'center',padding:'8px 0',fontSize:11,fontWeight:700,color:'#94A3B8',textTransform:'uppercase',letterSpacing:'0.05em'}}>{d}</div>
            ))}
            {Array(firstDayOfWeek).fill(null).map((_,i)=><div key={'e'+i}/>)}
            {Array(daysInMonth).fill(null).map((_,i)=>{
              const day=i+1
              const key=dateKey(day)
              const items=subsByDate[key]||[]
              const isToday=today.getDate()===day&&today.getMonth()===viewMonth&&today.getFullYear()===viewYear
              const isSelected=selectedDay===key
              return(
                <div key={day} onClick={()=>setSelectedDay(isSelected?null:key)}
                  style={{minHeight:70,padding:'6px 8px',background:isSelected?LIGHT:isToday?'#FFF7ED':'#fff',borderRadius:8,cursor:'pointer',border:isSelected?\`2px solid \${PRIMARY}\`:isToday?'2px solid #FB923C':'1px solid #E2E8F0',transition:'all 0.1s'}}>
                  <p style={{margin:'0 0 4px',fontWeight:isToday?800:600,fontSize:13,color:isToday?'#EA580C':isSelected?PRIMARY:'#374151'}}>{day}</p>
                  {items.slice(0,2).map(s=>{
                    const sc=statusColor(s.status)
                    return <div key={s.id} style={{fontSize:10,padding:'2px 4px',borderRadius:3,background:sc.bg,color:sc.text,marginBottom:2,overflow:'hidden',whiteSpace:'nowrap',textOverflow:'ellipsis',fontWeight:600}}>{s.data?.[FIELDS[0]?.name]||s.ticket_id}</div>
                  })}
                  {items.length>2&&<div style={{fontSize:10,color:'#94A3B8',fontWeight:600}}>+{items.length-2} more</div>}
                </div>
              )
            })}
          </div>
        </div>
        {/* Right panel */}
        <div style={{width:300,borderLeft:'1px solid #E2E8F0',background:'#fff',display:'flex',flexDirection:'column',flexShrink:0}}>
          <div style={{padding:'16px 20px',borderBottom:'1px solid #F1F5F9'}}>
            <p style={{margin:0,fontWeight:700,fontSize:13,color:'#0F172A'}}>{selectedDay?selectedDay:'Select a day'}</p>
            <p style={{margin:'2px 0 0',fontSize:11,color:'#94A3B8'}}>{dayItems.length} item{dayItems.length!==1?'s':''}</p>
          </div>
          <div style={{flex:1,overflowY:'auto',padding:'12px 16px'}}>
            {!selectedDay?<p style={{textAlign:'center',color:'#CBD5E1',fontSize:12,marginTop:32}}>Click a day to see items</p>
            :dayItems.length===0?<p style={{textAlign:'center',color:'#CBD5E1',fontSize:12,marginTop:32}}>No items on this day</p>
            :dayItems.map(sub=>{
              const sc=statusColor(sub.status)
              return(
                <div key={sub.id} style={{background:'#F8FAFC',borderRadius:8,padding:'10px 12px',marginBottom:8,border:'1px solid #F1F5F9'}}>
                  <p style={{margin:'0 0 4px',fontWeight:600,fontSize:13,color:'#0F172A'}}>{sub.data?.[FIELDS[0]?.name]||sub.ticket_id}</p>
                  <span style={{fontSize:10,fontFamily:'monospace',color:'#94A3B8'}}>{sub.ticket_id}</span>
                  <div style={{marginTop:8}}>
                    <select value={sub.status} onChange={e=>updateStatus(sub.id,e.target.value)} disabled={updatingId===sub.id}
                      style={{background:sc.bg,color:sc.text,border:\`1px solid \${sc.dot}55\`,borderRadius:5,padding:'3px 8px',fontSize:11,fontWeight:700,cursor:'pointer',width:'100%',opacity:updatingId===sub.id?0.5:1}}>
                      {STATUS_OPTIONS.map(o=><option key={o}>{o}</option>)}
                    </select>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
      {showForm&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:50}}>
          <div style={{background:'#fff',borderRadius:16,width:520,maxHeight:'85vh',overflowY:'auto',boxShadow:'0 20px 60px rgba(0,0,0,0.3)'}}>
            <div style={{padding:'20px 24px',borderBottom:'1px solid #F1F5F9',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <p style={{margin:0,fontWeight:800,fontSize:16,color:'#0F172A'}}>{ACTION_LABEL}</p>
              <button onClick={()=>setShowForm(false)} style={{background:'none',border:'none',fontSize:20,cursor:'pointer',color:'#94A3B8',lineHeight:1}}>×</button>
            </div>
            <div style={{padding:'20px 24px'}}>
              <SubmitForm onSuccess={()=>{setShowForm(false);load()}}/>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}`
  return wrapHtml(spec.appTitle, infra, app)
}

// ═══════════════════════════════════════════════════════════════════════════════
// LAYOUT ROUTER
// ═══════════════════════════════════════════════════════════════════════════════

const RENDERERS = {
  kanban_board: renderKanban,
  queue_detail: renderQueueDetail,
  command_center: renderCommandCenter,
  timeline_view: renderTimeline,
  table_admin: renderTableAdmin,
  wizard_flow: renderWizard,
  split_panel_review: renderSplitReview,
  workflow_pipeline: renderPipeline,
  form_first_admin: renderFormAdmin,
  // Aliases for spec.js variants
  kanban: renderKanban,
  split: renderSplitReview,
  feed: renderFormAdmin,
  inbox: renderQueueDetail,
  table: renderTableAdmin,
  wizard: renderWizard,
  pipeline: renderPipeline,
  command: renderCommandCenter,
  timeline: renderTimeline,
  document_workspace: renderDocument,
  calendar_scheduler: renderCalendar,
  document: renderDocument,
  calendar: renderCalendar,
  portal: renderQueueDetail,
}

function routeToRenderer(spec, appId, apiBase) {
  const layout = (spec.layoutType || 'form_first_admin').toLowerCase().replace(/[^a-z_]/g, '_')
  const renderer = RENDERERS[layout] || RENDERERS['form_first_admin']
  return renderer(spec, appId, apiBase)
}

// ─── Anti-template: check last N apps for this user ──────────────────────────
async function getRecentLayouts(userId) {
  if (!userId) return []
  const { data } = await supabase
    .from('generated_apps')
    .select('schema')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(4)
  return (data || []).map(a => a.schema?.layoutType).filter(Boolean)
}

function enforceUniqueness(spec, usedLayouts) {
  if (!usedLayouts.includes(spec.layoutType)) return spec
  // Force a different layout
  const allLayouts = Object.keys(RENDERERS).filter(k => !['kanban','split','feed','inbox','table','wizard','pipeline','command','timeline'].includes(k))
  const available = allLayouts.filter(l => !usedLayouts.includes(l))
  if (available.length > 0) {
    const pick = available[Math.floor(Math.random() * available.length)]
    console.log(`[anti-template] Changed layout from ${spec.layoutType} → ${pick}`)
    return { ...spec, layoutType: pick }
  }
  return spec
}

// ─── Schema builder ───────────────────────────────────────────────────────────
function buildSchema(spec) {
  return {
    appTitle: spec.appTitle,
    appType: spec.appType,
    workflowType: spec.workflowType,
    layoutType: spec.layoutType,
    businessWorkflow: spec.businessWorkflow,
    primaryUsers: spec.primaryUsers,
    colorTheme: spec.colorTheme,
    visualTheme: spec.visualTheme,
    designRationale: spec.designRationale,
    fields: spec.fields,
    statusOptions: spec.statusFlow,
    defaultStatus: spec.statusFlow?.[0],
    primaryActionLabel: spec.primaryActionLabel || 'Submit',
    integrations: spec.integrations || {},
    roles: spec.roles || [],
  }
}

// ─── Main handler ──────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { prompt, conversationId, spec, clarificationAnswers } = req.body
  if (!prompt || !conversationId || !spec) return res.status(400).json({ error: 'Missing fields' })

  try {
    const slug = generateSlug(spec.appTitle)
    const apiBase = process.env.API_BASE_URL || 'https://aria-api-de8c.onrender.com'

    const convData = await supabase
      .from('conversations').select('user_id').eq('id', conversationId).single()
    const userId = convData.data?.user_id

    // Anti-template: avoid repeating layouts
    const recentLayouts = await getRecentLayouts(userId)
    const finalSpec = enforceUniqueness(spec, recentLayouts)

    // Insert app record
    const { data: appData, error: appError } = await supabase
      .from('generated_apps')
      .insert({
        conversation_id: conversationId,
        user_id: userId,
        title: finalSpec.appTitle,
        workflow_type: finalSpec.workflowType,
        schema: buildSchema(finalSpec),
        table_name: 'app_' + slug.replace(/-/g, '_'),
        notification_config: {},
        status: 'deployed',
        slug,
      })
      .select().single()

    if (appError) throw new Error(appError.message)

    // Route to the correct layout renderer — no Claude call for layout
    const generatedHtml = routeToRenderer(finalSpec, appData.id, apiBase)

    await supabase.from('generated_apps')
      .update({ generated_html: generatedHtml })
      .eq('id', appData.id)

    await supabase.from('messages').insert({
      conversation_id: conversationId,
      role: 'assistant',
      content: '',
      message_type: 'app_card',
      metadata: { schema: buildSchema(finalSpec), slug, appId: appData.id },
    })

    await supabase.from('conversations').update({
      title: finalSpec.appTitle,
      updated_at: new Date().toISOString(),
    }).eq('id', conversationId)

    return res.json({ type: 'app_card', schema: buildSchema(finalSpec), slug, appId: appData.id })

  } catch (err) {
    console.error('Build error:', err)
    const userMessage = err.message?.includes('timeout')
      ? 'Request timed out. The AI service is busy. Please try again.'
      : err.message || 'Build failed. Please try again.'
    return res.status(500).json({ error: userMessage, userMessage })
  }
}
