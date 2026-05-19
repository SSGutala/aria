/**
 * WorkflowDiagramCanvas — interactive, draggable flowchart editor
 *
 * Features:
 *  - Drag nodes to reposition (arrows stay connected)
 *  - Add / delete arrows: drag from any port dot on a shape's edge to connect;
 *    click an arrow to select it, then Delete or the toolbar button to remove
 *  - Zoom (scroll-wheel or buttons), pan (drag empty canvas)
 *  - Double-click any node label to edit inline
 *  - Add Stage — new swimlane row; double-click lane label to rename
 *  - Fully independent SLA/duration tag: drag, resize corners, double-click to edit
 *  - Shape palette: Step, Decision, Hexagon, Parallelogram, Connector
 *  - Resize step/hex/para boxes via corner handles
 *  - Delete selected node or edge
 *  - Properties panel for selected node / edge
 */
import React from 'react'

// ── Swimlane colours ──────────────────────────────────────────────────────────
const SL_FILL   = ['#EFF6FF','#F0FDF4','#FFFBEB','#F5F3FF','#FFF1F2','#ECFDF5']
const SL_ACCENT = ['#2563EB','#16A34A','#D97706','#7C3AED','#E11D48','#059669']
const SL_LABEL  = ['#1E40AF','#14532D','#92400E','#4C1D95','#9F1239','#064E3B']

// ── Shape catalogue ───────────────────────────────────────────────────────────
const SHAPE_DEFS = [
  { type: 'step',          label: 'Process Step',  desc: 'Rounded rectangle',       defW: 164, defH: 68 },
  { type: 'decision',      label: 'Decision',       desc: 'Diamond — yes/no branch', defW: 120, defH: 70 },
  { type: 'decision_hex',  label: 'Preparation',    desc: 'Hexagon — setup/prep',    defW: 134, defH: 60 },
  { type: 'decision_para', label: 'Data / I/O',     desc: 'Parallelogram — data',    defW: 134, defH: 56 },
  { type: 'connector',     label: 'Connector',      desc: 'Circle — cross-reference', defW: 40,  defH: 40 },
]

// ── Layout constants ──────────────────────────────────────────────────────────
const LANE_H = 110, TOP_PAD = 20, LABEL_W = 100, BOX_W = 164, BOX_H = 68

function rowCY(ai) { return TOP_PAD + ai * LANE_H + LANE_H / 2 }
function colCX(i)  { return LABEL_W + 90 + i * (BOX_W + 52) + BOX_W / 2 }

// ── Port positions for a node (all 4 sides) ───────────────────────────────────
function getNodePorts(node) {
  const w = node.w ?? BOX_W, h = node.h ?? BOX_H
  if (node.type === 'start')   return { right: { x: node.x + 34, y: node.y }, left: { x: node.x - 34, y: node.y }, top: { x: node.x, y: node.y - 18 }, bottom: { x: node.x, y: node.y + 18 } }
  if (node.type === 'end')     return { right: { x: node.x + 30, y: node.y }, left: { x: node.x - 30, y: node.y }, top: { x: node.x, y: node.y - 16 }, bottom: { x: node.x, y: node.y + 16 } }
  if (node.type === 'connector') return { right: { x: node.x + 20, y: node.y }, left: { x: node.x - 20, y: node.y }, top: { x: node.x, y: node.y - 20 }, bottom: { x: node.x, y: node.y + 20 } }
  if (node.type === 'decision') {
    const hw = w / 2, hh = h / 2
    return { right: { x: node.x + hw, y: node.y }, left: { x: node.x - hw, y: node.y }, top: { x: node.x, y: node.y - hh }, bottom: { x: node.x, y: node.y + hh } }
  }
  if (node.type === 'decision_hex') {
    const sk = h * 0.35
    return { right: { x: node.x + w / 2, y: node.y }, left: { x: node.x - w / 2, y: node.y }, top: { x: node.x, y: node.y - h / 2 }, bottom: { x: node.x, y: node.y + h / 2 } }
  }
  // step / decision_para / generic box
  return { right: { x: node.x + w / 2, y: node.y }, left: { x: node.x - w / 2, y: node.y }, top: { x: node.x, y: node.y - h / 2 }, bottom: { x: node.x, y: node.y + h / 2 } }
}

// Nearest port on a node to a canvas point
function nearestPort(node, cx, cy) {
  const ports = getNodePorts(node)
  let best = null, bestDist = Infinity
  Object.entries(ports).forEach(([side, pt]) => {
    const d = Math.hypot(pt.x - cx, pt.y - cy)
    if (d < bestDist) { bestDist = d; best = { side, ...pt } }
  })
  return best
}

// Arrow path between two nodes using their nearest facing ports
function arrowPath(n1, n2) {
  const p1out = getNodePorts(n1), p2in = getNodePorts(n2)
  // Pick best out-port on n1 and best in-port on n2
  const sides = ['right','left','top','bottom']
  let best = null, bestDist = Infinity
  sides.forEach(s1 => sides.forEach(s2 => {
    const d = Math.hypot(p1out[s1].x - p2in[s2].x, p1out[s1].y - p2in[s2].y)
    if (d < bestDist) { bestDist = d; best = { p1: p1out[s1], p2: p2in[s2] } }
  }))
  const { p1, p2 } = best
  if (Math.abs(p1.y - p2.y) < 4) return `M${p1.x},${p1.y} L${p2.x},${p2.y}`
  const mx = p1.x + (p2.x - p1.x) * 0.5
  return `M${p1.x},${p1.y} L${mx},${p1.y} L${mx},${p2.y} L${p2.x},${p2.y}`
}

// ── Build initial graph from data ─────────────────────────────────────────────
export function buildInitialGraph(data) {
  const steps = data?.steps || []
  const savedShapes = data?.shapes || []   // non-step shapes from last save
  const savedEdges  = data?._edges  || null // null = not yet saved (auto-wire)

  // Restore saved actors/stages (saved as _actors); fall back to deriving from steps
  const actorList = data?._actors
    ? [...data._actors]
    : (() => {
        const list = []
        steps.forEach(s => { if (s.actor && !list.includes(s.actor)) list.push(s.actor) })
        return list.length ? list : ['Actor']
      })()

  const nodes = {}
  const startAi = steps.length ? Math.max(0, actorList.indexOf(steps[0]?.actor || actorList[0])) : 0
  nodes['__start__'] = { id: '__start__', type: 'start', label: 'START', x: LABEL_W + 45, y: rowCY(startAi) }

  steps.forEach((step, i) => {
    const ai = Math.max(0, actorList.indexOf(step.actor || actorList[0]))
    nodes[`s${i}`] = {
      id: `s${i}`, type: 'step',
      label: step.step || '', actor: step.actor || '',
      action: step.action || '', output: step.output || '', sla: step.sla || '',
      x: colCX(i), y: rowCY(ai), w: BOX_W, h: BOX_H, seqIndex: i,
      slaTag: step.sla ? { x: colCX(i) + BOX_W / 2 + 6, y: rowCY(ai) - BOX_H / 2 - 2, w: 72, h: 20 } : null,
    }
  })

  const sIds = steps.map((_, i) => `s${i}`)
  if (steps.length) {
    const last = steps[steps.length - 1]
    const lastAi = Math.max(0, actorList.indexOf(last?.actor || actorList[0]))
    nodes['__end__'] = { id: '__end__', type: 'end', label: 'END', x: colCX(steps.length - 1) + BOX_W / 2 + 60, y: rowCY(lastAi) }
  } else {
    nodes['__end__'] = { id: '__end__', type: 'end', label: 'END', x: LABEL_W + 90 + BOX_W + 52 + BOX_W / 2, y: rowCY(0) }
  }

  // Restore saved non-step shapes (decision, connector, hexagon, parallelogram)
  savedShapes.forEach(s => {
    if (!nodes[s.id]) {
      nodes[s.id] = { ...s, w: s.w ?? 120, h: s.h ?? 70 }
    }
  })

  // Build edges: use saved _edges if present (custom connections), else auto-wire steps
  let edges
  if (savedEdges && savedEdges.length > 0) {
    edges = savedEdges.filter(e => nodes[e.from] && nodes[e.to])
  } else {
    edges = []
    if (sIds.length) edges.push({ id: 'e_start', from: '__start__', to: sIds[0] })
    sIds.forEach((id, i) => { if (i < sIds.length - 1) edges.push({ id: `e${i}`, from: id, to: sIds[i + 1] }) })
    if (sIds.length) edges.push({ id: 'e_end', from: sIds[sIds.length - 1], to: '__end__' })
    else edges.push({ id: 'e_end', from: '__start__', to: '__end__' })
  }

  return { nodes, edges, actors: actorList }
}

function graphToSteps(nodes) {
  return Object.values(nodes)
    .filter(n => n.type === 'step')
    .sort((a, b) => (a.seqIndex ?? 0) - (b.seqIndex ?? 0))
    .map(n => ({ step: n.label, actor: n.actor || '', action: n.action || '', output: n.output || '', sla: n.sla || null }))
}

// ── Shape icon previews ───────────────────────────────────────────────────────
function ShapeIcon({ type, size = 28 }) {
  const s = size, c = s / 2, st = { overflow: 'visible' }
  if (type === 'step') return <svg width={s} height={s * 0.55} style={st}><rect x={1} y={1} width={s-2} height={s*0.55-2} rx={4} fill="#EFF6FF" stroke="#2563EB" strokeWidth={1.5}/></svg>
  if (type === 'decision') return <svg width={s} height={s * 0.7} style={st}><polygon points={`${c},2 ${s-2},${s*0.35} ${c},${s*0.7-2} 2,${s*0.35}`} fill="#FFFBEB" stroke="#D97706" strokeWidth={1.5}/></svg>
  if (type === 'decision_hex') {
    const hw = s/2-2, hh = s*0.3, sh = s*0.13
    const pts = `${c-hw+sh},2 ${c+hw-sh},2 ${c+hw},${hh+2} ${c+hw-sh},${hh*2+2} ${c-hw+sh},${hh*2+2} ${c-hw},${hh+2}`
    return <svg width={s} height={hh*2+4} style={st}><polygon points={pts} fill="#F5F3FF" stroke="#7C3AED" strokeWidth={1.5}/></svg>
  }
  if (type === 'decision_para') {
    const w = s-4, h = s*0.45, sk = 10
    return <svg width={s+4} height={h+4} style={st}><polygon points={`${2+sk},2 ${w+2},2 ${w+2-sk},${h} 2,${h}`} fill="#ECFDF5" stroke="#059669" strokeWidth={1.5}/></svg>
  }
  if (type === 'connector') return <svg width={s*0.7} height={s*0.7} style={st}><circle cx={s*0.35} cy={s*0.35} r={s*0.35-2} fill="#FFF1F2" stroke="#E11D48" strokeWidth={1.5}/></svg>
  return null
}

// ── Main component ────────────────────────────────────────────────────────────
export default function WorkflowDiagramCanvas({ data, onDataChange }) {
  const [graph, setGraph]               = React.useState(() => buildInitialGraph(data))
  const [selected, setSelected]         = React.useState(null)    // node id
  const [selectedEdge, setSelectedEdge] = React.useState(null)    // edge id
  const [selectedSLA, setSelectedSLA]   = React.useState(null)    // node id whose SLA tag is selected
  const [hoveredNode, setHoveredNode]   = React.useState(null)    // node id for port display
  const [zoom, setZoom]                 = React.useState(0.9)
  const [pan, setPan]                   = React.useState({ x: 24, y: 24 })
  const [shapePalette, setShapePalette]   = React.useState(false)
  const [inlineEdit, setInlineEdit]       = React.useState(null)
  const [selectedLane, setSelectedLane]   = React.useState(null)  // actor index

  // drawing a new edge: { fromId, x2, y2, snapToId }
  const [drawingEdge, setDrawingEdge]   = React.useState(null)

  const dragRef       = React.useRef(null)
  const panRef        = React.useRef(null)
  const resizeRef     = React.useRef(null)
  const slaTagDragRef = React.useRef(null)
  const slaTagResRef  = React.useRef(null)
  const drawRef       = React.useRef(null)   // for edge drawing (avoids stale closure)
  const dataRef       = React.useRef(data)
  const containerRef  = React.useRef(null)
  const svgRef        = React.useRef(null)
  const wheelRef      = React.useRef(null)

  // ── Undo / Redo history ───────────────────────────────────────────────────
  const historyRef  = React.useRef([buildInitialGraph(data)])  // snapshots
  const histIndexRef = React.useRef(0)
  const clipboardRef = React.useRef(null)  // copied node

  // Push to history whenever graph changes via an action (not pan/zoom)
  function pushHistory(g) {
    const stack = historyRef.current.slice(0, histIndexRef.current + 1)
    stack.push(g)
    if (stack.length > 60) stack.shift()  // cap at 60 steps
    historyRef.current = stack
    histIndexRef.current = stack.length - 1
  }

  function undo() {
    const idx = histIndexRef.current
    if (idx <= 0) return
    histIndexRef.current = idx - 1
    const prev = historyRef.current[histIndexRef.current]
    setGraph(prev)
    setSelected(null); setSelectedEdge(null)
    emit(prev.nodes, prev.edges, prev.actors)
  }

  function redo() {
    const idx = histIndexRef.current
    if (idx >= historyRef.current.length - 1) return
    histIndexRef.current = idx + 1
    const next = historyRef.current[histIndexRef.current]
    setGraph(next)
    setSelected(null); setSelectedEdge(null)
    emit(next.nodes, next.edges, next.actors)
  }

  React.useEffect(() => { dataRef.current = data }, [data])

  // Non-passive wheel listener
  wheelRef.current = React.useCallback((e) => {
    e.preventDefault()
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    const mx = e.clientX - rect.left, my = e.clientY - rect.top
    setZoom(prev => {
      const nz = Math.max(0.25, Math.min(3, prev * delta))
      setPan(pp => ({ x: mx - (mx - pp.x) * (nz / prev), y: my - (my - pp.y) * (nz / prev) }))
      return nz
    })
  }, [])
  React.useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const fn = e => wheelRef.current(e)
    el.addEventListener('wheel', fn, { passive: false })
    return () => el.removeEventListener('wheel', fn)
  }, [])

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  // Use refs so the handler always reads latest state without re-registering
  const selRef      = React.useRef(selected)
  const selEdgeRef  = React.useRef(selectedEdge)
  const graphRef    = React.useRef(graph)
  React.useEffect(() => { selRef.current = selected }, [selected])
  React.useEffect(() => { selEdgeRef.current = selectedEdge }, [selectedEdge])
  React.useEffect(() => { graphRef.current = graph }, [graph])

  React.useEffect(() => {
    function onKey(e) {
      // Don't intercept when user is typing in an input/textarea
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.contentEditable === 'true') return

      const meta = e.metaKey || e.ctrlKey

      // ── Undo ──
      if (meta && !e.shiftKey && e.key === 'z') { e.preventDefault(); undo(); return }

      // ── Redo ──
      if (meta && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); redo(); return }

      // ── Copy ──
      if (meta && e.key === 'c') {
        const id = selRef.current
        if (!id) return
        const n = graphRef.current.nodes[id]
        if (n && !['start','end'].includes(n.type)) {
          clipboardRef.current = { ...n }
        }
        return
      }

      // ── Cut ──
      if (meta && e.key === 'x') {
        const id = selRef.current
        if (!id || id === '__start__' || id === '__end__') return
        const n = graphRef.current.nodes[id]
        if (n && !['start','end'].includes(n.type)) {
          clipboardRef.current = { ...n }
          // Use the deleteNode logic inline to avoid stale closure
          const { nodes: ns, edges: es } = graphRef.current
          const inE = es.find(e => e.to === id), outE = es.find(e => e.from === id)
          const newEdges = es.filter(e => e.from !== id && e.to !== id)
          if (inE && outE) newEdges.push({ id: `e_${Date.now()}`, from: inE.from, to: outE.to })
          const newNodes = { ...ns }; delete newNodes[id]
          let si = 0
          Object.values(newNodes).filter(n => n.type === 'step').sort((a, b) => (a.seqIndex??0)-(b.seqIndex??0)).forEach(n => { newNodes[n.id] = { ...n, seqIndex: si++ } })
          setGraph(prev => ({ ...prev, nodes: newNodes, edges: newEdges }))
          setSelected(null)
          emit(newNodes, newEdges)
        }
        return
      }

      // ── Paste ──
      if (meta && e.key === 'v') {
        const clip = clipboardRef.current
        if (!clip) return
        const id = `n${Date.now()}`
        const { nodes: ns, edges: es, actors: ac } = graphRef.current
        const stepNodes = Object.values(ns).filter(n => ['step','decision','decision_hex','decision_para','connector'].includes(n.type)).sort((a,b)=>(a.seqIndex??0)-(b.seqIndex??0))
        const seqIndex = stepNodes.length ? (stepNodes[stepNodes.length-1].seqIndex ?? 0) + 1 : 0
        const newNode = { ...clip, id, x: clip.x + 24, y: clip.y + 24, seqIndex, slaTag: clip.slaTag ? { ...clip.slaTag, x: clip.slaTag.x + 24, y: clip.slaTag.y + 24 } : null }
        const newNodes = { ...ns, [id]: newNode }
        setGraph(prev => ({ ...prev, nodes: newNodes }))
        setSelected(id)
        emit(newNodes, es)
        return
      }

      // ── Delete / Backspace ──
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const id = selRef.current
        const eid = selEdgeRef.current
        if (id && id !== '__start__' && id !== '__end__') {
          e.preventDefault()
          const { nodes: ns, edges: es } = graphRef.current
          const inE = es.find(e => e.to === id), outE = es.find(e => e.from === id)
          const newEdges = es.filter(e => e.from !== id && e.to !== id)
          if (inE && outE) newEdges.push({ id: `e_${Date.now()}`, from: inE.from, to: outE.to })
          const newNodes = { ...ns }; delete newNodes[id]
          let si = 0
          Object.values(newNodes).filter(n => n.type === 'step').sort((a,b)=>(a.seqIndex??0)-(b.seqIndex??0)).forEach(n => { newNodes[n.id] = { ...n, seqIndex: si++ } })
          setGraph(prev => ({ ...prev, nodes: newNodes, edges: newEdges }))
          setSelected(null)
          emit(newNodes, newEdges)
        } else if (eid) {
          e.preventDefault()
          const { nodes: ns, edges: es } = graphRef.current
          const newEdges = es.filter(e => e.id !== eid)
          setGraph(prev => ({ ...prev, edges: newEdges }))
          setSelectedEdge(null)
          emit(ns, newEdges)
        }
        return
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, []) // empty deps — all state accessed via refs

  const { nodes, edges } = graph
  const actors = graph.actors || []

  // ── Coord helpers ─────────────────────────────────────────────────────────
  function toCanvas(clientX, clientY) {
    const rect = containerRef.current?.getBoundingClientRect() || { left: 0, top: 0 }
    return { x: (clientX - rect.left - pan.x) / zoom, y: (clientY - rect.top - pan.y) / zoom }
  }
  function toScreen(cx, cy) {
    return { x: pan.x + cx * zoom, y: pan.y + cy * zoom }
  }

  function emit(newNodes, newEdges, newActors, skipHistory = false) {
    const g = { nodes: newNodes ?? nodes, edges: newEdges ?? edges, actors: newActors ?? graph.actors }
    if (!skipHistory) pushHistory(g)
    // Serialize non-step shapes so they survive round-trips through Done/Edit
    const shapes = Object.values(g.nodes)
      .filter(n => !['step', 'start', 'end'].includes(n.type))
      .map(n => ({ id: n.id, type: n.type, label: n.label || '', actor: n.actor || '', x: n.x, y: n.y, w: n.w, h: n.h, seqIndex: n.seqIndex ?? 0, sla: n.sla || '', slaTag: n.slaTag || null }))
    const _edges = g.edges.map(e => ({ id: e.id, from: e.from, to: e.to }))
    onDataChange({
      ...dataRef.current,
      steps: graphToSteps(g.nodes),
      shapes,
      _edges,
      _actors: g.actors,
    })
  }

  // ── Node drag ─────────────────────────────────────────────────────────────
  function onNodeDown(e, nodeId) {
    if (drawRef.current) return  // don't drag while drawing edge
    e.preventDefault(); e.stopPropagation()
    setInlineEdit(null); setSelectedSLA(null); setSelectedEdge(null)
    const pt = toCanvas(e.clientX, e.clientY)
    const n = nodes[nodeId]
    dragRef.current = { nodeId, sx: pt.x, sy: pt.y, ox: n.x, oy: n.y, moved: false }
    setSelected(nodeId)
  }

  // ── Node resize ───────────────────────────────────────────────────────────
  function onResizeDown(e, nodeId, corner) {
    e.preventDefault(); e.stopPropagation()
    const pt = toCanvas(e.clientX, e.clientY)
    const n = nodes[nodeId]
    resizeRef.current = { nodeId, corner, sx: pt.x, sy: pt.y, ow: n.w ?? BOX_W, oh: n.h ?? BOX_H }
  }

  // ── SLA tag drag ──────────────────────────────────────────────────────────
  function onSLATagDown(e, nodeId) {
    e.preventDefault(); e.stopPropagation()
    setSelected(null); setSelectedSLA(nodeId); setSelectedEdge(null); setInlineEdit(null)
    const pt = toCanvas(e.clientX, e.clientY)
    const tag = nodes[nodeId]?.slaTag
    if (!tag) return
    slaTagDragRef.current = { nodeId, sx: pt.x, sy: pt.y, ox: tag.x, oy: tag.y }
  }

  function onSLATagResizeDown(e, nodeId, corner) {
    e.preventDefault(); e.stopPropagation()
    const pt = toCanvas(e.clientX, e.clientY)
    const tag = nodes[nodeId]?.slaTag
    if (!tag) return
    slaTagResRef.current = { nodeId, corner, sx: pt.x, sy: pt.y, ox: tag.x, oy: tag.y, ow: tag.w, oh: tag.h }
  }

  // ── Port drag — start drawing a new arrow ─────────────────────────────────
  function onPortDown(e, nodeId) {
    e.preventDefault(); e.stopPropagation()
    setSelected(null); setSelectedEdge(null); setSelectedSLA(null)
    const pt = toCanvas(e.clientX, e.clientY)
    drawRef.current = { fromId: nodeId, x2: pt.x, y2: pt.y, snapToId: null }
    setDrawingEdge({ fromId: nodeId, x2: pt.x, y2: pt.y, snapToId: null })
  }

  // ── Canvas pan ────────────────────────────────────────────────────────────
  function onSVGDown(e) {
    if (dragRef.current || resizeRef.current || slaTagDragRef.current || slaTagResRef.current || drawRef.current) return
    setSelected(null); setSelectedSLA(null); setSelectedEdge(null); setInlineEdit(null); setSelectedLane(null)
    panRef.current = { sx: e.clientX, sy: e.clientY, px: pan.x, py: pan.y }
  }

  // ── Unified mouse move ────────────────────────────────────────────────────
  function onMouseMove(e) {
    const pt = toCanvas(e.clientX, e.clientY)

    if (dragRef.current) {
      const d = dragRef.current
      const dx = pt.x - d.sx, dy = pt.y - d.sy
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) d.moved = true
      setGraph(prev => ({ ...prev, nodes: { ...prev.nodes, [d.nodeId]: { ...prev.nodes[d.nodeId], x: d.ox + dx, y: d.oy + dy } } }))
      return
    }

    if (resizeRef.current) {
      const d = resizeRef.current
      const isRight = d.corner.includes('r'), isBottom = d.corner.includes('b')
      const nw = Math.max(80, d.ow + (pt.x - d.sx) * (isRight ? 2 : -2))
      const nh = Math.max(36, d.oh + (pt.y - d.sy) * (isBottom ? 2 : -2))
      setGraph(prev => ({ ...prev, nodes: { ...prev.nodes, [d.nodeId]: { ...prev.nodes[d.nodeId], w: nw, h: nh } } }))
      return
    }

    if (slaTagDragRef.current) {
      const d = slaTagDragRef.current
      setGraph(prev => {
        const n = prev.nodes[d.nodeId]; if (!n?.slaTag) return prev
        return { ...prev, nodes: { ...prev.nodes, [d.nodeId]: { ...n, slaTag: { ...n.slaTag, x: d.ox + (pt.x - d.sx), y: d.oy + (pt.y - d.sy) } } } }
      })
      return
    }

    if (slaTagResRef.current) {
      const d = slaTagResRef.current, dx = pt.x - d.sx, dy = pt.y - d.sy
      const isRight = d.corner.includes('r'), isBottom = d.corner.includes('b')
      const nw = Math.max(40, d.ow + (isRight ? dx : -dx))
      const nh = Math.max(14, d.oh + (isBottom ? dy : -dy))
      setGraph(prev => {
        const n = prev.nodes[d.nodeId]; if (!n) return prev
        return { ...prev, nodes: { ...prev.nodes, [d.nodeId]: { ...n, slaTag: { x: isRight ? d.ox : d.ox + d.ow - nw, y: isBottom ? d.oy : d.oy + d.oh - nh, w: nw, h: nh } } } }
      })
      return
    }

    if (drawRef.current) {
      // Find if hovering over a target node (snap)
      let snapToId = null
      Object.values(nodes).forEach(n => {
        if (n.id === drawRef.current.fromId) return
        const p = nearestPort(n, pt.x, pt.y)
        if (p && Math.hypot(p.x - pt.x, p.y - pt.y) < 32) snapToId = n.id
      })
      drawRef.current = { ...drawRef.current, x2: pt.x, y2: pt.y, snapToId }
      setDrawingEdge({ ...drawRef.current })
      return
    }

    if (panRef.current) {
      const d = panRef.current
      setPan({ x: d.px + (e.clientX - d.sx), y: d.py + (e.clientY - d.sy) })
    }
  }

  function onMouseUp(e) {
    const wasDrag = dragRef.current?.moved
    const wasDrawing = drawRef.current

    dragRef.current = null; resizeRef.current = null
    slaTagDragRef.current = null; slaTagResRef.current = null
    panRef.current = null

    if (wasDrag) setGraph(prev => { emit(prev.nodes, prev.edges); return prev })

    if (wasDrawing) {
      const { fromId, snapToId } = wasDrawing
      drawRef.current = null
      setDrawingEdge(null)
      if (snapToId && snapToId !== fromId) {
        // Check if this exact edge already exists
        setGraph(prev => {
          const exists = prev.edges.some(e => e.from === fromId && e.to === snapToId)
          if (exists) return prev
          const newEdge = { id: `e_${Date.now()}`, from: fromId, to: snapToId }
          const newEdges = [...prev.edges, newEdge]
          emit(prev.nodes, newEdges)
          return { ...prev, edges: newEdges }
        })
      }
    }
  }

  // ── Inline edit ───────────────────────────────────────────────────────────
  function startNodeEdit(e, nodeId, field) {
    e.stopPropagation(); e.preventDefault()
    const n = nodes[nodeId]; if (!n) return
    const nw = n.w ?? BOX_W, nh = n.h ?? BOX_H
    let cy = n.y; if (field === 'actor') cy = n.y + nh / 2 - 14
    const sc = toScreen(n.x - nw / 2 + 30, cy - 10)
    setInlineEdit({ type: 'node', id: nodeId, field, bx: sc.x, by: sc.y, bw: (nw - 32) * zoom, val: n[field] || '' })
  }

  function startSLAEdit(e, nodeId) {
    e.stopPropagation(); e.preventDefault()
    const tag = nodes[nodeId]?.slaTag, n = nodes[nodeId]; if (!tag || !n) return
    const sc = toScreen(tag.x + 4, tag.y + 2)
    setInlineEdit({ type: 'sla', id: nodeId, bx: sc.x, by: sc.y, bw: (tag.w - 8) * zoom, val: n.sla || '' })
  }

  function startActorEdit(e, actorIndex) {
    e.stopPropagation(); e.preventDefault()
    const laneY = TOP_PAD + actorIndex * LANE_H
    const sc = toScreen(4, laneY + LANE_H / 2 - 9)
    setInlineEdit({ type: 'actor', id: actorIndex, bx: sc.x, by: sc.y, bw: (LABEL_W - 8) * zoom, val: actors[actorIndex] || '' })
  }

  function commitEdit(val) {
    if (!inlineEdit) return
    const { type, id, field } = inlineEdit
    if (type === 'node') {
      setGraph(prev => {
        const updated = { ...prev.nodes, [id]: { ...prev.nodes[id], [field]: val } }
        emit(updated, prev.edges)
        return { ...prev, nodes: updated }
      })
    }
    if (type === 'sla') {
      setGraph(prev => {
        const n = prev.nodes[id]; if (!n) return prev
        const newTag = val.trim() ? (n.slaTag || { x: n.x + (n.w ?? BOX_W) / 2 + 6, y: n.y - (n.h ?? BOX_H) / 2 - 2, w: 72, h: 20 }) : null
        const updated = { ...prev.nodes, [id]: { ...n, sla: val, slaTag: newTag } }
        emit(updated, prev.edges)
        return { ...prev, nodes: updated }
      })
    }
    if (type === 'actor') {
      const oldName = actors[id]
      const newActors = actors.map((a, i) => i === id ? val : a)
      setGraph(prev => {
        const newNodes = {}
        Object.values(prev.nodes).forEach(n => { newNodes[n.id] = n.actor === oldName ? { ...n, actor: val } : n })
        emit(newNodes, prev.edges, newActors)
        return { ...prev, nodes: newNodes, actors: newActors }
      })
    }
    setInlineEdit(null)
  }

  // ── Add shape ─────────────────────────────────────────────────────────────
  function addShape(type) {
    const def = SHAPE_DEFS.find(s => s.type === type) || SHAPE_DEFS[0]
    const id = `n${Date.now()}`
    const isStep = type === 'step'

    // Use selected lane for placement; fall back to lane 0
    const laneIndex = selectedLane !== null ? selectedLane : 0
    const actor = actors[laneIndex] || actors[0] || ''

    // All step-like nodes globally (for seqIndex)
    const stepLike = Object.values(nodes)
      .filter(n => ['step','decision','decision_hex','decision_para','connector'].includes(n.type))
      .sort((a, b) => (a.seqIndex ?? 0) - (b.seqIndex ?? 0))
    const lastGlobal = stepLike[stepLike.length - 1]
    const seqIndex = lastGlobal ? (lastGlobal.seqIndex ?? 0) + 1 : 0

    // Rightmost node in the selected lane (for X positioning)
    const laneNodes = Object.values(nodes)
      .filter(n => ['step','decision','decision_hex','decision_para','connector'].includes(n.type) && n.actor === actor)
      .sort((a, b) => a.x - b.x)
    const lastInLane = laneNodes[laneNodes.length - 1]

    const x = lastInLane
      ? lastInLane.x + (lastInLane.w ?? def.defW) / 2 + 80 + def.defW / 2
      : LABEL_W + 200
    const y = rowCY(laneIndex)

    const newNode = {
      id, type,
      label: isStep ? 'New Step' : (type === 'connector' ? 'A' : 'Decision?'),
      actor: isStep ? actor : '',
      action: '', output: '', sla: '', slaTag: null,
      x, y, w: def.defW, h: def.defH, seqIndex,
    }

    // Only auto-wire step nodes; non-step shapes get arrows drawn manually
    let newEdges = [...edges]
    let newNodes = { ...nodes, [id]: newNode }
    if (isStep) {
      const endNode = nodes['__end__']
      newEdges = edges.filter(e => e.to !== '__end__')
      if (lastGlobal) newEdges.push({ id: `e_${Date.now()}a`, from: lastGlobal.id, to: id })
      else if (nodes['__start__']) newEdges.push({ id: `e_${Date.now()}a`, from: '__start__', to: id })
      if (endNode) {
        newEdges.push({ id: `e_${Date.now()}b`, from: id, to: '__end__' })
        newNodes['__end__'] = { ...endNode, x: x + def.defW / 2 + 60, y }
      }
    }

    setGraph(prev => ({ ...prev, nodes: newNodes, edges: newEdges }))
    setSelected(id); setShapePalette(false)
    setTimeout(() => emit(newNodes, newEdges), 0)
  }

  // ── Add Stage ─────────────────────────────────────────────────────────────
  function addStage() {
    setGraph(prev => {
      const newActors = [...prev.actors, `Stage ${prev.actors.length + 1}`]
      emit(prev.nodes, prev.edges, newActors)
      return { ...prev, actors: newActors }
    })
  }

  // ── Delete node ───────────────────────────────────────────────────────────
  function deleteNode(nodeId) {
    if (!nodeId || nodeId === '__start__' || nodeId === '__end__') return
    const inE = edges.find(e => e.to === nodeId), outE = edges.find(e => e.from === nodeId)
    const newEdges = edges.filter(e => e.from !== nodeId && e.to !== nodeId)
    if (inE && outE) newEdges.push({ id: `e_${Date.now()}`, from: inE.from, to: outE.to })
    const newNodes = { ...nodes }; delete newNodes[nodeId]
    let si = 0
    Object.values(newNodes).filter(n => n.type === 'step').sort((a, b) => (a.seqIndex ?? 0) - (b.seqIndex ?? 0)).forEach(n => { newNodes[n.id] = { ...n, seqIndex: si++ } })
    setGraph(prev => ({ ...prev, nodes: newNodes, edges: newEdges }))
    setSelected(null); emit(newNodes, newEdges)
  }

  // ── Delete edge ───────────────────────────────────────────────────────────
  function deleteEdge(edgeId) {
    const newEdges = edges.filter(e => e.id !== edgeId)
    setGraph(prev => ({ ...prev, edges: newEdges }))
    setSelectedEdge(null); emit(nodes, newEdges)
  }

  // ── Node property update ──────────────────────────────────────────────────
  function updateNode(updates) {
    setGraph(prev => ({ ...prev, nodes: { ...prev.nodes, [selected]: { ...prev.nodes[selected], ...updates } } }))
  }
  function commitNodeUpdate() {
    setGraph(prev => {
      const n = prev.nodes[selected]; if (!n) return prev
      const slaTag = n.sla && !n.slaTag ? { x: n.x + (n.w ?? BOX_W) / 2 + 6, y: n.y - (n.h ?? BOX_H) / 2 - 2, w: 72, h: 20 } : (n.sla ? n.slaTag : null)
      const updated = { ...prev.nodes, [selected]: { ...n, slaTag } }
      emit(updated, prev.edges)
      return { ...prev, nodes: updated }
    })
  }

  // Canvas bounds
  const allNodes = Object.values(nodes)
  const canvasW = Math.max(...allNodes.map(n => n.x + (n.w ?? 60) / 2 + 120), 900)
  const canvasH = Math.max(...allNodes.map(n => n.y + (n.h ?? 60) / 2 + 80), Math.max(1, actors.length) * LANE_H + TOP_PAD * 2)
  const selectedNode = selected ? nodes[selected] : null
  const MARKER = 'wfdc_arr'
  const MARKER_SEL = 'wfdc_arr_sel'

  // ── Render helpers ────────────────────────────────────────────────────────
  function renderResizeHandles(n) {
    if (!n || !['step','decision_hex','decision_para'].includes(n.type)) return null
    const w = n.w ?? BOX_W, h = n.h ?? BOX_H
    return [['tl', n.x-w/2, n.y-h/2], ['tr', n.x+w/2, n.y-h/2], ['bl', n.x-w/2, n.y+h/2], ['br', n.x+w/2, n.y+h/2]].map(([corner, hx, hy]) => (
      <rect key={corner} x={hx-4} y={hy-4} width={8} height={8} rx={2}
        fill="#fff" stroke="#2563EB" strokeWidth={1.5} style={{ cursor: `${corner}-resize` }}
        onMouseDown={e => onResizeDown(e, n.id, corner)}/>
    ))
  }

  // Port dots — shown when hovering a node; drag them to draw arrows
  function renderPorts(n) {
    const ports = getNodePorts(n)
    return Object.entries(ports).map(([side, pt]) => (
      <circle key={side} cx={pt.x} cy={pt.y} r={6}
        fill="#2563EB" fillOpacity={0.85} stroke="#fff" strokeWidth={1.5}
        style={{ cursor: 'crosshair', pointerEvents: 'all' }}
        onMouseDown={e => onPortDown(e, n.id)}
        title="Drag to connect"/>
    ))
  }

  // Independent SLA tag
  function renderSLATag(n) {
    if (!n.sla || n.sla === 'None' || n.sla === 'null' || !n.slaTag) return null
    const { x, y, w, h } = n.slaTag
    const isSel = selectedSLA === n.id
    const ai = actors.indexOf(n.actor || actors[0])
    const accent = SL_ACCENT[(ai < 0 ? 0 : ai) % SL_ACCENT.length]
    const fontSize = Math.max(8, Math.min(12, h * 0.6))
    return (
      <g key={`sla_${n.id}`}>
        <rect x={x} y={y} width={w} height={h} rx={4}
          fill={accent} fillOpacity={isSel ? 0.2 : 0.12}
          stroke={accent} strokeWidth={isSel ? 1.5 : 0.8} strokeOpacity={isSel ? 0.9 : 0.45}
          style={{ cursor: 'move' }}
          onMouseDown={e => onSLATagDown(e, n.id)}
          onDoubleClick={e => startSLAEdit(e, n.id)}
          onClick={e => { e.stopPropagation(); setSelected(null); setSelectedSLA(n.id) }}/>
        <text x={x+5} y={y+h/2} dominantBaseline="middle"
          fontSize={fontSize} fill={accent} fontWeight="700"
          style={{ pointerEvents: 'none', userSelect: 'none' }}>⏱ {n.sla}</text>
        {isSel && [['tl',x,y],['tr',x+w,y],['bl',x,y+h],['br',x+w,y+h]].map(([corner,hx,hy]) => (
          <rect key={corner} x={hx-4} y={hy-4} width={8} height={8} rx={2}
            fill="#fff" stroke={accent} strokeWidth={1.5}
            style={{ cursor: `${corner}-resize` }}
            onMouseDown={e => onSLATagResizeDown(e, n.id, corner)}/>
        ))}
        <line x1={x+w/2} y1={y+(y>n.y?0:h)} x2={n.x} y2={n.y}
          stroke={accent} strokeWidth={0.8} strokeDasharray="3,3" opacity={0.3}
          style={{ pointerEvents: 'none' }}/>
      </g>
    )
  }

  function renderStep(n) {
    const isSel = selected === n.id, isHov = hoveredNode === n.id
    const w = n.w ?? BOX_W, h = n.h ?? BOX_H
    const bx = n.x - w/2, by = n.y - h/2
    const ai = actors.indexOf(n.actor || actors[0])
    const accent = SL_ACCENT[(ai<0?0:ai)%SL_ACCENT.length]
    const lbl    = SL_LABEL[(ai<0?0:ai)%SL_LABEL.length]
    const raw = n.label||'', line1 = raw.slice(0,22), line2 = raw.length>22?raw.slice(22,44):''
    return (
      <g key={n.id} filter={isSel?'url(#wfdc_sel)':'url(#wfdc_shadow)'}
        onMouseDown={e=>onNodeDown(e,n.id)}
        onDoubleClick={e=>startNodeEdit(e,n.id,'label')}
        onClick={e=>{e.stopPropagation();setSelected(n.id);setSelectedSLA(null);setSelectedEdge(null)}}
        onMouseEnter={()=>setHoveredNode(n.id)} onMouseLeave={()=>setHoveredNode(v=>v===n.id?null:v)}
        style={{cursor:'grab'}}>
        <rect x={bx} y={by} width={w} height={h} rx={7} fill="#fff"
          stroke={isSel?'#2563EB':accent} strokeWidth={isSel?2.5:2}/>
        <rect x={bx+1} y={by+1} width={w-2} height={5} rx={6} fill={accent}/>
        <circle cx={bx+16} cy={by+19} r={11} fill={accent}/>
        <text x={bx+16} y={by+19} textAnchor="middle" dominantBaseline="middle"
          fontSize="9" fontWeight="800" fill="#fff" style={{pointerEvents:'none'}}>
          {(n.seqIndex??0)+1}
        </text>
        <text x={bx+34} y={by+(line2?24:28)} fontSize="11" fontWeight="700" fill="#0F172A" style={{pointerEvents:'none'}}>{line1}</text>
        {line2&&<text x={bx+34} y={by+37} fontSize="11" fontWeight="700" fill="#0F172A" style={{pointerEvents:'none'}}>{line2}</text>}
        {n.actor&&<text x={bx+34} y={by+h-10} fontSize="9" fill={accent} fontWeight="600" opacity={0.85}
          style={{pointerEvents:'all',cursor:'text'}}
          onDoubleClick={e=>startNodeEdit(e,n.id,'actor')}>{n.actor.slice(0,24)}</text>}
        {isSel&&renderResizeHandles(n)}
        {(isSel||isHov)&&renderPorts(n)}
      </g>
    )
  }

  function renderDecision(n) {
    const isSel = selected===n.id, isHov = hoveredNode===n.id
    const hw=(n.w??120)/2, hh=(n.h??70)/2
    const pts=`${n.x},${n.y-hh} ${n.x+hw},${n.y} ${n.x},${n.y+hh} ${n.x-hw},${n.y}`
    return (
      <g key={n.id} filter={isSel?'url(#wfdc_sel)':'url(#wfdc_shadow)'}
        onMouseDown={e=>onNodeDown(e,n.id)}
        onDoubleClick={e=>startNodeEdit(e,n.id,'label')}
        onClick={e=>{e.stopPropagation();setSelected(n.id);setSelectedSLA(null);setSelectedEdge(null)}}
        onMouseEnter={()=>setHoveredNode(n.id)} onMouseLeave={()=>setHoveredNode(v=>v===n.id?null:v)}
        style={{cursor:'grab'}}>
        <polygon points={pts} fill="#FFFBEB" stroke={isSel?'#2563EB':'#D97706'} strokeWidth={isSel?2.5:2}/>
        <text x={n.x} y={n.y} textAnchor="middle" dominantBaseline="middle"
          fontSize="10" fontWeight="700" fill="#92400E" style={{pointerEvents:'none'}}>
          {(n.label||'').slice(0,16)}
        </text>
        {(isSel||isHov)&&renderPorts(n)}
      </g>
    )
  }

  function renderHexagon(n) {
    const isSel=selected===n.id, isHov=hoveredNode===n.id
    const w=n.w??134, h=n.h??60, sk=h*0.35
    const pts=`${n.x-w/2+sk},${n.y-h/2} ${n.x+w/2-sk},${n.y-h/2} ${n.x+w/2},${n.y} ${n.x+w/2-sk},${n.y+h/2} ${n.x-w/2+sk},${n.y+h/2} ${n.x-w/2},${n.y}`
    return (
      <g key={n.id} filter={isSel?'url(#wfdc_sel)':'url(#wfdc_shadow)'}
        onMouseDown={e=>onNodeDown(e,n.id)}
        onDoubleClick={e=>startNodeEdit(e,n.id,'label')}
        onClick={e=>{e.stopPropagation();setSelected(n.id);setSelectedSLA(null);setSelectedEdge(null)}}
        onMouseEnter={()=>setHoveredNode(n.id)} onMouseLeave={()=>setHoveredNode(v=>v===n.id?null:v)}
        style={{cursor:'grab'}}>
        <polygon points={pts} fill="#F5F3FF" stroke={isSel?'#2563EB':'#7C3AED'} strokeWidth={isSel?2.5:2}/>
        <text x={n.x} y={n.y} textAnchor="middle" dominantBaseline="middle"
          fontSize="10" fontWeight="700" fill="#4C1D95" style={{pointerEvents:'none'}}>
          {(n.label||'').slice(0,16)}
        </text>
        {isSel&&renderResizeHandles(n)}
        {(isSel||isHov)&&renderPorts(n)}
      </g>
    )
  }

  function renderParallelogram(n) {
    const isSel=selected===n.id, isHov=hoveredNode===n.id
    const w=n.w??134, h=n.h??56, sk=18
    const pts=`${n.x-w/2+sk},${n.y-h/2} ${n.x+w/2},${n.y-h/2} ${n.x+w/2-sk},${n.y+h/2} ${n.x-w/2},${n.y+h/2}`
    return (
      <g key={n.id} filter={isSel?'url(#wfdc_sel)':'url(#wfdc_shadow)'}
        onMouseDown={e=>onNodeDown(e,n.id)}
        onDoubleClick={e=>startNodeEdit(e,n.id,'label')}
        onClick={e=>{e.stopPropagation();setSelected(n.id);setSelectedSLA(null);setSelectedEdge(null)}}
        onMouseEnter={()=>setHoveredNode(n.id)} onMouseLeave={()=>setHoveredNode(v=>v===n.id?null:v)}
        style={{cursor:'grab'}}>
        <polygon points={pts} fill="#ECFDF5" stroke={isSel?'#2563EB':'#059669'} strokeWidth={isSel?2.5:2}/>
        <text x={n.x} y={n.y} textAnchor="middle" dominantBaseline="middle"
          fontSize="10" fontWeight="700" fill="#064E3B" style={{pointerEvents:'none'}}>
          {(n.label||'').slice(0,16)}
        </text>
        {isSel&&renderResizeHandles(n)}
        {(isSel||isHov)&&renderPorts(n)}
      </g>
    )
  }

  function renderConnector(n) {
    const isSel=selected===n.id, isHov=hoveredNode===n.id
    return (
      <g key={n.id} filter={isSel?'url(#wfdc_sel)':'url(#wfdc_shadow)'}
        onMouseDown={e=>onNodeDown(e,n.id)}
        onDoubleClick={e=>startNodeEdit(e,n.id,'label')}
        onClick={e=>{e.stopPropagation();setSelected(n.id);setSelectedSLA(null);setSelectedEdge(null)}}
        onMouseEnter={()=>setHoveredNode(n.id)} onMouseLeave={()=>setHoveredNode(v=>v===n.id?null:v)}
        style={{cursor:'grab'}}>
        <circle cx={n.x} cy={n.y} r={20} fill="#FFF1F2" stroke={isSel?'#2563EB':'#E11D48'} strokeWidth={isSel?2.5:2}/>
        <text x={n.x} y={n.y} textAnchor="middle" dominantBaseline="middle"
          fontSize="9" fontWeight="700" fill="#9F1239" style={{pointerEvents:'none'}}>
          {(n.label||'').slice(0,4)}
        </text>
        {(isSel||isHov)&&renderPorts(n)}
      </g>
    )
  }

  function renderOval(n, fill, textCol) {
    const isSel=selected===n.id, isHov=hoveredNode===n.id
    const rx=n.type==='start'?34:30, ry=n.type==='start'?18:16
    return (
      <g key={n.id} filter={isSel?'url(#wfdc_sel)':'url(#wfdc_shadow)'}
        onMouseDown={e=>onNodeDown(e,n.id)}
        onClick={e=>{e.stopPropagation();setSelected(n.id);setSelectedSLA(null);setSelectedEdge(null)}}
        onMouseEnter={()=>setHoveredNode(n.id)} onMouseLeave={()=>setHoveredNode(v=>v===n.id?null:v)}
        style={{cursor:'grab'}}>
        <ellipse cx={n.x} cy={n.y} rx={rx} ry={ry} fill={fill}
          stroke={isSel?'#2563EB':'none'} strokeWidth={isSel?2.5:0}/>
        <text x={n.x} y={n.y} textAnchor="middle" dominantBaseline="middle"
          fontSize="9" fontWeight="800" fill={textCol} letterSpacing="0.08em" style={{pointerEvents:'none'}}>
          {n.label}
        </text>
        {(isSel||isHov)&&renderPorts(n)}
      </g>
    )
  }

  // Ghost arrow while drawing
  function renderDrawingGhost() {
    if (!drawingEdge) return null
    const fromNode = nodes[drawingEdge.fromId]
    if (!fromNode) return null
    const snapNode = drawingEdge.snapToId ? nodes[drawingEdge.snapToId] : null
    const p1 = nearestPort(fromNode, drawingEdge.x2, drawingEdge.y2)
    const p2 = snapNode ? nearestPort(snapNode, p1.x, p1.y) : { x: drawingEdge.x2, y: drawingEdge.y2 }
    const mx = p1.x + (p2.x - p1.x) * 0.5
    const d = Math.abs(p1.y - p2.y) < 4 ? `M${p1.x},${p1.y} L${p2.x},${p2.y}` : `M${p1.x},${p1.y} L${mx},${p1.y} L${mx},${p2.y} L${p2.x},${p2.y}`
    return (
      <>
        <path d={d} stroke={snapNode ? '#2563EB' : '#94A3B8'} strokeWidth="2" fill="none"
          strokeDasharray={snapNode ? 'none' : '6,4'}
          markerEnd={`url(#${snapNode ? MARKER_SEL : MARKER})`}
          style={{ pointerEvents: 'none' }}/>
        {snapNode && <circle cx={p2.x} cy={p2.y} r={7} fill="#2563EB" fillOpacity={0.25} stroke="#2563EB" strokeWidth={1.5} style={{ pointerEvents: 'none' }}/>}
      </>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', flexWrap: 'wrap', flexShrink: 0 }}>

        {/* Undo / Redo */}
        <button onClick={undo} style={tbBtn()} title="Undo (⌘Z)">
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1.5 4.5H6a3 3 0 1 1 0 6H3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><path d="M1.5 2L1.5 5H4.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <button onClick={redo} style={tbBtn()} title="Redo (⌘Y)">
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M9.5 4.5H5a3 3 0 1 0 0 6H8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><path d="M9.5 2L9.5 5H6.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>

        <div style={{ width: 1, height: 16, background: '#E2E8F0' }} />

        <button onClick={() => { addShape('step'); setShapePalette(false) }} style={tbBtn()}>
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><rect x="0.5" y="0.5" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1"/><path d="M5.5 3v5M3 5.5h5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
          Add Step
        </button>

        {/* Shape palette */}
        <div style={{ position: 'relative' }}>
          <button onClick={() => setShapePalette(p => !p)} style={tbBtn(shapePalette)}>
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><polygon points="5.5,1 10,5.5 5.5,10 1,5.5" stroke="currentColor" strokeWidth="1" fill="none"/><path d="M5.5 3.5v4M3.5 5.5h4" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/></svg>
            Add Shape ▾
          </button>
          {shapePalette && (
            <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 200, background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', padding: 8, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 220 }}>
              {SHAPE_DEFS.map(def => (
                <button key={def.type} onClick={() => addShape(def.type)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', border: 'none', borderRadius: 6, background: 'transparent', cursor: 'pointer', textAlign: 'left' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#F1F5F9'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <div style={{ width: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ShapeIcon type={def.type} size={32}/></div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#111' }}>{def.label}</div>
                    <div style={{ fontSize: 10, color: '#6B7280' }}>{def.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Add Stage */}
        <button onClick={addStage} style={tbBtn()}>
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <rect x="0.5" y="0.5" width="10" height="4" rx="1" stroke="currentColor" strokeWidth="1" fill="none"/>
            <rect x="0.5" y="6" width="10" height="4.5" rx="1" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.5"/>
            <path d="M5.5 7.5v2M4.5 8.5h2" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
          </svg>
          Add Stage
        </button>

        <div style={{ width: 1, height: 16, background: '#E2E8F0' }} />

        {/* Zoom */}
        <button onClick={() => setZoom(z => Math.min(3, z * 1.2))} style={tbBtn()} title="Zoom in">
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1.2"/><path d="M5 3v4M3 5h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><path d="M8.5 8.5L10.5 10.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
        </button>
        <span style={{ fontSize: 11, color: '#64748B', minWidth: 36, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
        <button onClick={() => setZoom(z => Math.max(0.25, z / 1.2))} style={tbBtn()} title="Zoom out">
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1.2"/><path d="M3 5h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><path d="M8.5 8.5L10.5 10.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
        </button>
        <button onClick={() => { setZoom(0.9); setPan({ x: 24, y: 24 }) }} style={tbBtn()} title="Reset view">
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1 5.5C1 3.01 3.01 1 5.5 1S10 3.01 10 5.5 7.99 10 5.5 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><path d="M1 3V5.5H3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>

        <div style={{ flex: 1 }} />

        {selectedEdge && (
          <button onClick={() => deleteEdge(selectedEdge)} style={tbBtn(false, true)}>
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M2 2l7 7M9 2L2 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            Delete Arrow
          </button>
        )}
        {selected && selected !== '__start__' && selected !== '__end__' && (
          <button onClick={() => deleteNode(selected)} style={tbBtn(false, true)}>
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M2 2l7 7M9 2L2 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            Delete Shape
          </button>
        )}

        <span style={{ fontSize: 10, color: '#CBD5E1', fontStyle: 'italic' }}>
          Hover shape → drag blue dots to connect · Del to delete · ⌘Z undo · ⌘C/X/V copy/cut/paste
        </span>
      </div>

      {/* Canvas + panel */}
      <div style={{ display: 'flex', flex: 1, minHeight: 360, overflow: 'hidden' }}>

        <div ref={containerRef}
          style={{ flex: 1, overflow: 'hidden', position: 'relative', background: '#F8FAFB', cursor: drawingEdge ? 'crosshair' : panRef.current ? 'grabbing' : 'default' }}
          onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}>

          <svg ref={svgRef} width="100%" height="100%"
            style={{ display: 'block', userSelect: 'none' }}
            onMouseDown={onSVGDown}
            onClick={() => { setShapePalette(false); setSelected(null); setSelectedSLA(null); setSelectedEdge(null); setSelectedLane(null) }}>

            <defs>
              <marker id={MARKER} markerWidth="9" markerHeight="9" refX="7" refY="3.5" orient="auto">
                <path d="M0,0.5 L0,6.5 L8,3.5 z" fill="#94A3B8"/>
              </marker>
              <marker id={MARKER_SEL} markerWidth="9" markerHeight="9" refX="7" refY="3.5" orient="auto">
                <path d="M0,0.5 L0,6.5 L8,3.5 z" fill="#2563EB"/>
              </marker>
              <filter id="wfdc_shadow"><feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="#00000012"/></filter>
              <filter id="wfdc_sel"><feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#2563EB55"/></filter>
              <pattern id="wfdc_grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#E8EDF2" strokeWidth="0.5"/>
              </pattern>
            </defs>

            <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
              {/* Grid */}
              <rect x={-2000} y={-2000} width={canvasW+4000} height={canvasH+4000} fill="url(#wfdc_grid)"/>

              {/* Swimlanes */}
              {actors.map((actor, ai) => {
                const laneY = TOP_PAD + ai * LANE_H
                const accent = SL_ACCENT[ai % SL_ACCENT.length]
                const fill   = SL_FILL[ai % SL_FILL.length]
                const lbl    = SL_LABEL[ai % SL_LABEL.length]
                const isSelLane = selectedLane === ai
                return (
                  <g key={`lane_${ai}`}>
                    {/* Clickable lane background — click to select lane for shape placement */}
                    <rect x={0} y={laneY} width={canvasW} height={LANE_H}
                      fill={fill} fillOpacity={isSelLane ? 0.75 : 0.5}
                      stroke={isSelLane ? accent : '#E2E8F0'}
                      strokeWidth={isSelLane ? 2 : 0.5}
                      style={{ cursor: 'pointer' }}
                      onClick={e => { e.stopPropagation(); setSelectedLane(ai); setSelected(null); setSelectedEdge(null); setSelectedSLA(null) }}/>
                    <rect x={0} y={laneY} width={LABEL_W} height={LANE_H} fill={accent} fillOpacity={0.09}/>
                    <line x1={LABEL_W} y1={laneY} x2={LABEL_W} y2={laneY+LANE_H} stroke={accent} strokeWidth={1.8} opacity={0.35}/>
                    {isSelLane && (
                      <text x={LABEL_W + 6} y={laneY + 13} fontSize="9" fill={accent} fontWeight="700" opacity={0.7} style={{ pointerEvents: 'none' }}>
                        ✓ lane selected — shapes drop here
                      </text>
                    )}
                    <text x={LABEL_W/2} y={laneY+LANE_H/2} textAnchor="middle" dominantBaseline="middle"
                      fontSize="11" fontWeight="700" fill={lbl}
                      transform={`rotate(-90,${LABEL_W/2},${laneY+LANE_H/2})`}
                      style={{ cursor: 'text' }}
                      onDoubleClick={e=>startActorEdit(e,ai)}>
                      {actor.length>18?actor.slice(0,17)+'…':actor}
                    </text>
                  </g>
                )
              })}

              {/* Edges — clickable with fat transparent hit area */}
              {edges.map(edge => {
                const n1 = nodes[edge.from], n2 = nodes[edge.to]
                if (!n1 || !n2) return null
                const isSel = selectedEdge === edge.id
                const d = arrowPath(n1, n2)
                return (
                  <g key={edge.id}
                    onClick={e => { e.stopPropagation(); setSelectedEdge(edge.id); setSelected(null); setSelectedSLA(null) }}
                    style={{ cursor: 'pointer' }}>
                    {/* Fat invisible hit area */}
                    <path d={d} stroke="transparent" strokeWidth={12} fill="none" style={{ pointerEvents: 'stroke' }}/>
                    {/* Visible arrow */}
                    <path d={d}
                      stroke={isSel ? '#2563EB' : '#94A3B8'}
                      strokeWidth={isSel ? 2.5 : 1.8}
                      fill="none"
                      markerEnd={`url(#${isSel ? MARKER_SEL : MARKER})`}
                      style={{ pointerEvents: 'none' }}/>
                  </g>
                )
              })}

              {/* Ghost edge while drawing */}
              {renderDrawingGhost()}

              {/* Nodes */}
              {allNodes.filter(n => !['start','end'].includes(n.type)).map(n => {
                if (n.type==='step')          return renderStep(n)
                if (n.type==='decision')      return renderDecision(n)
                if (n.type==='decision_hex')  return renderHexagon(n)
                if (n.type==='decision_para') return renderParallelogram(n)
                if (n.type==='connector')     return renderConnector(n)
                return null
              })}
              {allNodes.filter(n=>n.type==='start').map(n=>renderOval(n,'#15803D','#fff'))}
              {allNodes.filter(n=>n.type==='end').map(n=>renderOval(n,'#0F172A','#fff'))}

              {/* SLA tags on top */}
              {allNodes.filter(n=>n.type==='step'&&n.sla&&n.slaTag).map(n=>renderSLATag(n))}
            </g>
          </svg>

          {/* Inline editor */}
          {inlineEdit && (
            <div style={{ position: 'absolute', left: inlineEdit.bx, top: inlineEdit.by, zIndex: 100, pointerEvents: 'all' }}>
              <input autoFocus value={inlineEdit.val}
                onChange={e => setInlineEdit(p => ({ ...p, val: e.target.value }))}
                onBlur={() => commitEdit(inlineEdit.val)}
                onKeyDown={e => { if (e.key==='Enter') commitEdit(inlineEdit.val); if (e.key==='Escape') setInlineEdit(null) }}
                style={{ width: Math.max(inlineEdit.bw, 60), padding: '3px 6px', border: '2px solid #2563EB', borderRadius: 4, fontSize: Math.max(10, 11*zoom), fontWeight: inlineEdit.field==='label'?700:500, color: '#0F172A', background: '#fff', boxShadow: '0 2px 8px rgba(37,99,235,0.2)', outline: 'none', fontFamily: 'inherit' }}/>
            </div>
          )}

          <div style={{ position: 'absolute', bottom: 10, left: 12, fontSize: 10, color: '#94A3B8', background: 'rgba(255,255,255,0.8)', padding: '2px 6px', borderRadius: 4, pointerEvents: 'none' }}>
            {Math.round(zoom*100)}% · drag canvas to pan · scroll to zoom
          </div>
        </div>

        {/* Properties panel */}
        {(selectedNode && !['start','end'].includes(selectedNode.type)) && (
          <div style={{ width: 196, borderLeft: '1px solid #E2E8F0', background: '#FCFCFD', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
            <div style={{ padding: '8px 12px', borderBottom: '1px solid #E2E8F0', fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', background: '#F8FAFC' }}>
              {selectedNode.type==='step'?'Step':SHAPE_DEFS.find(s=>s.type===selectedNode.type)?.label||'Shape'} Properties
            </div>
            <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 7, overflowY: 'auto', flex: 1 }}>
              {selectedNode.type==='step'
                ? [['label','Name'],['actor','Actor / Role'],['action','Action'],['output','Output'],['sla','SLA / Duration']].map(([key,lbl]) => (
                  <div key={key}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>{lbl}</div>
                    <input value={selectedNode[key]||''} onChange={e=>updateNode({[key]:e.target.value})} onBlur={commitNodeUpdate} style={propInput()}/>
                  </div>
                ))
                : <div><div style={{ fontSize: 9, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>Label</div>
                    <input value={selectedNode.label||''} onChange={e=>updateNode({label:e.target.value})} onBlur={commitNodeUpdate} style={propInput()}/></div>
              }
              <button onClick={()=>deleteNode(selected)} style={{ marginTop: 4, padding: '5px 0', border: '1px solid #FCA5A5', borderRadius: 5, background: '#FEF2F2', color: '#DC2626', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                Delete Shape
              </button>
            </div>
          </div>
        )}

        {selectedEdge && (
          <div style={{ width: 196, borderLeft: '1px solid #E2E8F0', background: '#FCFCFD', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
            <div style={{ padding: '8px 12px', borderBottom: '1px solid #E2E8F0', fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', background: '#F8FAFC' }}>
              Arrow
            </div>
            <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(() => {
                const e = edges.find(e => e.id === selectedEdge)
                const from = e ? nodes[e.from]?.label || e.from : '?'
                const to   = e ? nodes[e.to]?.label   || e.to   : '?'
                return <div style={{ fontSize: 11, color: '#374151' }}>
                  <span style={{ fontWeight: 600 }}>{from}</span>
                  <span style={{ color: '#94A3B8', margin: '0 6px' }}>→</span>
                  <span style={{ fontWeight: 600 }}>{to}</span>
                </div>
              })()}
              <button onClick={()=>deleteEdge(selectedEdge)} style={{ padding: '6px 0', border: '1px solid #FCA5A5', borderRadius: 5, background: '#FEF2F2', color: '#DC2626', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                Delete Arrow
              </button>
            </div>
          </div>
        )}

        {selectedSLA && nodes[selectedSLA]?.slaTag && (
          <div style={{ width: 196, borderLeft: '1px solid #E2E8F0', background: '#FCFCFD', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
            <div style={{ padding: '8px 12px', borderBottom: '1px solid #E2E8F0', fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', background: '#F8FAFC' }}>Duration Tag</div>
            <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 7 }}>
              <div style={{ fontSize: 9, color: '#94A3B8' }}>Double-click tag to edit · drag to move · drag corners to resize</div>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>SLA Text</div>
              <input value={nodes[selectedSLA]?.sla||''} onChange={e=>{
                const val=e.target.value
                setGraph(prev=>{const n=prev.nodes[selectedSLA];if(!n)return prev;return{...prev,nodes:{...prev.nodes,[selectedSLA]:{...n,sla:val}}}})
              }} onBlur={()=>setGraph(prev=>{const n=prev.nodes[selectedSLA];if(!n)return prev;const updated={...prev.nodes,[selectedSLA]:{...n,slaTag:n.sla?n.slaTag:null}};emit(updated,prev.edges);return{...prev,nodes:updated}})} style={propInput()}/>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function tbBtn(active=false, danger=false) {
  return { display:'flex', alignItems:'center', gap:4, padding:'3px 9px', borderRadius:5, cursor:'pointer', fontSize:11, fontWeight:600, border:`1px solid ${danger?'#FCA5A5':active?'#2563EB':'#D1D5DB'}`, background:danger?'#FEF2F2':active?'#EFF6FF':'#fff', color:danger?'#DC2626':active?'#1D4ED8':'#374151' }
}
function propInput() {
  return { width:'100%', padding:'4px 6px', border:'1px solid #E2E8F0', borderRadius:4, fontSize:11, color:'#111', background:'#fff', boxSizing:'border-box', outline:'none', fontFamily:'inherit' }
}

// ── Static (read-only) canvas for preview mode ────────────────────────────────
export function WorkflowStaticCanvas({ data }) {
  const graph = React.useMemo(() => buildInitialGraph(data), [data])
  const { nodes, edges, actors } = graph
  const allNodes = Object.values(nodes)
  const canvasW = Math.max(...allNodes.map(n => n.x + (n.w ?? 60) / 2 + 120), 900)
  const canvasH = Math.max(...allNodes.map(n => n.y + (n.h ?? 60) / 2 + 80), Math.max(1, actors.length) * LANE_H + TOP_PAD * 2)
  const MID = 'wfsc_arr'

  function sNode(n) {
    if (n.type === 'step') {
      const w = n.w ?? BOX_W, h = n.h ?? BOX_H, bx = n.x - w/2, by = n.y - h/2
      const ai = actors.indexOf(n.actor || actors[0])
      const accent = SL_ACCENT[(ai<0?0:ai)%SL_ACCENT.length]
      const raw = n.label||'', l1 = raw.slice(0,22), l2 = raw.length>22?raw.slice(22,44):''
      return <g key={n.id}>
        <rect x={bx} y={by} width={w} height={h} rx={7} fill="#fff" stroke={accent} strokeWidth={2}/>
        <rect x={bx+1} y={by+1} width={w-2} height={5} rx={6} fill={accent}/>
        <circle cx={bx+16} cy={by+19} r={11} fill={accent}/>
        <text x={bx+16} y={by+19} textAnchor="middle" dominantBaseline="middle" fontSize="9" fontWeight="800" fill="#fff" style={{pointerEvents:'none'}}>{(n.seqIndex??0)+1}</text>
        <text x={bx+34} y={by+(l2?24:28)} fontSize="11" fontWeight="700" fill="#0F172A" style={{pointerEvents:'none'}}>{l1}</text>
        {l2&&<text x={bx+34} y={by+37} fontSize="11" fontWeight="700" fill="#0F172A" style={{pointerEvents:'none'}}>{l2}</text>}
        {n.actor&&<text x={bx+34} y={by+h-10} fontSize="9" fill={accent} fontWeight="600" opacity={0.85} style={{pointerEvents:'none'}}>{n.actor.slice(0,24)}</text>}
      </g>
    }
    if (n.type === 'decision') {
      const hw=(n.w??120)/2, hh=(n.h??70)/2
      const pts=`${n.x},${n.y-hh} ${n.x+hw},${n.y} ${n.x},${n.y+hh} ${n.x-hw},${n.y}`
      return <g key={n.id}><polygon points={pts} fill="#FFFBEB" stroke="#D97706" strokeWidth={2}/><text x={n.x} y={n.y} textAnchor="middle" dominantBaseline="middle" fontSize="10" fontWeight="700" fill="#92400E" style={{pointerEvents:'none'}}>{(n.label||'').slice(0,16)}</text></g>
    }
    if (n.type === 'decision_hex') {
      const w=n.w??134, h=n.h??60, sk=h*0.35
      const pts=`${n.x-w/2+sk},${n.y-h/2} ${n.x+w/2-sk},${n.y-h/2} ${n.x+w/2},${n.y} ${n.x+w/2-sk},${n.y+h/2} ${n.x-w/2+sk},${n.y+h/2} ${n.x-w/2},${n.y}`
      return <g key={n.id}><polygon points={pts} fill="#F5F3FF" stroke="#7C3AED" strokeWidth={2}/><text x={n.x} y={n.y} textAnchor="middle" dominantBaseline="middle" fontSize="10" fontWeight="700" fill="#4C1D95" style={{pointerEvents:'none'}}>{(n.label||'').slice(0,16)}</text></g>
    }
    if (n.type === 'decision_para') {
      const w=n.w??134, h=n.h??56, sk=18
      const pts=`${n.x-w/2+sk},${n.y-h/2} ${n.x+w/2},${n.y-h/2} ${n.x+w/2-sk},${n.y+h/2} ${n.x-w/2},${n.y+h/2}`
      return <g key={n.id}><polygon points={pts} fill="#ECFDF5" stroke="#059669" strokeWidth={2}/><text x={n.x} y={n.y} textAnchor="middle" dominantBaseline="middle" fontSize="10" fontWeight="700" fill="#064E3B" style={{pointerEvents:'none'}}>{(n.label||'').slice(0,16)}</text></g>
    }
    if (n.type === 'connector') return <g key={n.id}><circle cx={n.x} cy={n.y} r={20} fill="#FFF1F2" stroke="#E11D48" strokeWidth={2}/><text x={n.x} y={n.y} textAnchor="middle" dominantBaseline="middle" fontSize="9" fontWeight="700" fill="#9F1239" style={{pointerEvents:'none'}}>{(n.label||'').slice(0,4)}</text></g>
    if (n.type === 'start') return <g key={n.id}><ellipse cx={n.x} cy={n.y} rx={34} ry={18} fill="#15803D"/><text x={n.x} y={n.y} textAnchor="middle" dominantBaseline="middle" fontSize="9" fontWeight="800" fill="#fff" letterSpacing="0.08em" style={{pointerEvents:'none'}}>{n.label}</text></g>
    if (n.type === 'end')   return <g key={n.id}><ellipse cx={n.x} cy={n.y} rx={30} ry={16} fill="#0F172A"/><text x={n.x} y={n.y} textAnchor="middle" dominantBaseline="middle" fontSize="9" fontWeight="800" fill="#fff" letterSpacing="0.08em" style={{pointerEvents:'none'}}>{n.label}</text></g>
    return null
  }

  return (
    <div style={{ width:'100%', overflowX:'auto', background:'#F8FAFB', borderRadius:6 }}>
      <svg width="100%" viewBox={`0 0 ${canvasW+48} ${canvasH+48}`} style={{ display:'block' }}>
        <defs>
          <marker id={MID} markerWidth="9" markerHeight="9" refX="7" refY="3.5" orient="auto">
            <path d="M0,0.5 L0,6.5 L8,3.5 z" fill="#94A3B8"/>
          </marker>
        </defs>
        {/* White background so semi-transparent lane fills render correctly */}
        <rect x={0} y={0} width={canvasW+48} height={canvasH+48} fill="#F8FAFB"/>
        <g transform="translate(24,24)">
          {actors.map((actor, ai) => {
            const laneY = TOP_PAD + ai * LANE_H
            const accent = SL_ACCENT[ai%SL_ACCENT.length]
            const fill   = SL_FILL[ai%SL_FILL.length]
            const lbl    = SL_LABEL[ai%SL_LABEL.length]
            return <g key={`sl_${ai}`}>
              <rect x={0} y={laneY} width={canvasW} height={LANE_H} fill={fill} fillOpacity={0.5} stroke="#E2E8F0" strokeWidth={0.5}/>
              <rect x={0} y={laneY} width={LABEL_W} height={LANE_H} fill={accent} fillOpacity={0.09}/>
              <line x1={LABEL_W} y1={laneY} x2={LABEL_W} y2={laneY+LANE_H} stroke={accent} strokeWidth={1.8} opacity={0.35}/>
              <text x={LABEL_W/2} y={laneY+LANE_H/2} textAnchor="middle" dominantBaseline="middle"
                fontSize="11" fontWeight="700" fill={lbl}
                transform={`rotate(-90,${LABEL_W/2},${laneY+LANE_H/2})`}>
                {actor.length>18?actor.slice(0,17)+'…':actor}
              </text>
            </g>
          })}
          {edges.map(edge => {
            const n1=nodes[edge.from], n2=nodes[edge.to]
            if (!n1||!n2) return null
            return <path key={edge.id} d={arrowPath(n1,n2)} stroke="#94A3B8" strokeWidth={1.8} fill="none" markerEnd={`url(#${MID})`} style={{pointerEvents:'none'}}/>
          })}
          {allNodes.map(n => sNode(n))}
          {allNodes.filter(n=>n.type==='step'&&n.sla&&n.slaTag).map(n=>{
            const {x,y,w,h}=n.slaTag
            const ai=actors.indexOf(n.actor||actors[0])
            const accent=SL_ACCENT[(ai<0?0:ai)%SL_ACCENT.length]
            return <g key={`sla_${n.id}`}>
              <rect x={x} y={y} width={w} height={h} rx={4} fill={accent} fillOpacity={0.12} stroke={accent} strokeWidth={0.8} strokeOpacity={0.45}/>
              <text x={x+5} y={y+h/2} dominantBaseline="middle" fontSize={Math.max(8,Math.min(12,h*0.6))} fill={accent} fontWeight="700" style={{pointerEvents:'none'}}>⏱ {n.sla}</text>
            </g>
          })}
        </g>
      </svg>
    </div>
  )
}
