import type { FlowEdge, FlowNode } from "@/lib/types";

/** Minimal mermaid flowchart → React Flow nodes/edges */
export function mermaidToFlow(mermaid: string): {
  nodes: FlowNode[];
  edges: FlowEdge[];
} {
  const nodes: FlowNode[] = [];
  const edges: FlowEdge[] = [];
  const nodeIds = new Set<string>();

  const lines = mermaid
    .replace(/^flowchart\s+\w+/i, "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  for (const line of lines) {
    const edgeMatch = line.match(
      /^(\w+)\s*(-->|---|-\.->)\s*(?:\|([^|]+)\|)?\s*(\w+)/
    );
    if (edgeMatch) {
      const [, src, , label, tgt] = edgeMatch;
      for (const id of [src, tgt]) {
        if (!nodeIds.has(id)) {
          nodeIds.add(id);
          nodes.push({
            id,
            label: id.replace(/_/g, " "),
            x: 80 + nodes.length * 200,
            y: 80 + (nodes.length % 3) * 120,
          });
        }
      }
      edges.push({
        id: `e-${src}-${tgt}`,
        source: src,
        target: tgt,
        label: label?.trim(),
      });
      continue;
    }

    const nodeMatch = line.match(/^(\w+)\[([^\]]+)\]/);
    if (nodeMatch) {
      const [, id, label] = nodeMatch;
      if (!nodeIds.has(id)) {
        nodeIds.add(id);
        nodes.push({
          id,
          label,
          x: 80 + nodes.length * 200,
          y: 80,
        });
      }
    }
  }

  return { nodes, edges };
}
