"use client";

import { useCallback, useMemo } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
} from "reactflow";
import "reactflow/dist/style.css";

type Props = {
  initialNodes: Array<{ id: string; label: string; x?: number; y?: number }>;
  initialEdges: Array<{ id: string; source: string; target: string; label?: string }>;
  readOnly?: boolean;
  onChange?: (nodes: Node[], edges: Edge[]) => void;
};

export function FlowDiagramEditor({
  initialNodes,
  initialEdges,
  readOnly,
  onChange,
}: Props) {
  const seedNodes: Node[] = useMemo(
    () =>
      initialNodes.map((n, i) => ({
        id: n.id,
        data: { label: n.label },
        position: { x: n.x ?? 80 + i * 180, y: n.y ?? 80 + (i % 2) * 100 },
        style: {
          padding: 12,
          borderRadius: 8,
          border: "1px solid #c7d2fe",
          background: "#eef2ff",
        },
      })),
    [initialNodes]
  );

  const seedEdges: Edge[] = useMemo(
    () =>
      initialEdges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.label,
      })),
    [initialEdges]
  );

  const [nodes, , onNodesChange] = useNodesState(seedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(seedEdges);

  const onConnect = useCallback(
    (c: Connection) => {
      if (readOnly) return;
      setEdges((eds) => addEdge(c, eds));
    },
    [readOnly, setEdges]
  );

  const notify = useCallback(() => {
    onChange?.(nodes, edges);
  }, [nodes, edges, onChange]);

  return (
    <div className="h-[480px] rounded-xl border border-slate-200 bg-slate-50">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={readOnly ? undefined : onNodesChange}
        onEdgesChange={readOnly ? undefined : onEdgesChange}
        onConnect={onConnect}
        onNodeDragStop={notify}
        fitView
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}
