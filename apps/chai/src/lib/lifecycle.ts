import { db } from "@/lib/db";
import { generateStylePreviewHtml, STYLE_KEYS } from "@/lib/ai/style-previews";
import { mermaidToFlow } from "@/lib/diagrams/mermaid-to-flow";
import type { RoadmapTask } from "@/lib/types";

function defaultRoadmapTasks(): RoadmapTask[] {
  return [
    { id: "t1", title: "Intake & requirements", phase: "Discovery", startWeek: 0, durationWeeks: 2, owner: "PM" },
    { id: "t2", title: "Workflow design", phase: "Design", startWeek: 2, durationWeeks: 2, owner: "Ops" },
    { id: "t3", title: "App build", phase: "Build", startWeek: 4, durationWeeks: 3, owner: "Eng" },
    { id: "t4", title: "Pilot & rollout", phase: "Launch", startWeek: 7, durationWeeks: 2, owner: "PM" },
  ];
}

export async function seedProjectLifecycle(projectId: string, title: string) {
  const existing = await db.artifact.count({ where: { projectId } });
  if (existing > 0) return;

  const mermaid = `flowchart LR
    submit[Submit Request] --> review[Manager Review]
    review -->|approve| finance[Finance Approval]
    review -->|reject| done[Closed]
    finance --> paid[Paid]`;

  const { nodes, edges } = mermaidToFlow(mermaid);
  const tasks = defaultRoadmapTasks();

  const artifacts = [
    {
      type: "product_brief",
      title: "Product Brief",
      content: {
        sections: [
          { title: "Problem", body: `Teams need a governed ${title} workflow.` },
          { title: "Users", body: "Requesters, approvers, finance reviewers." },
          { title: "Success metrics", body: "Cycle time reduction, audit trail completeness." },
        ],
      },
      sortOrder: 0,
    },
    {
      type: "workflow_map",
      title: "Workflow Map",
      content: { flowNodes: nodes, flowEdges: edges, mermaid },
      sortOrder: 1,
    },
    {
      type: "workflow_diagram",
      title: "Workflow Diagram",
      content: { flowNodes: nodes, flowEdges: edges },
      sortOrder: 2,
    },
    {
      type: "data_model",
      title: "Data Model",
      content: {
        fields: [
          { name: "request_id", type: "uuid", required: "yes", description: "Primary key" },
          { name: "title", type: "text", required: "yes", description: "Request title" },
          { name: "amount", type: "currency", required: "no", description: "Expense amount" },
          { name: "status", type: "enum", required: "yes", description: "submitted|approved|rejected|paid" },
        ],
      },
      sortOrder: 3,
    },
    {
      type: "roadmap",
      title: "Product Roadmap",
      content: {
        tasks,
        phases: tasks.reduce<Array<{ name: string; items: string[] }>>((acc, t) => {
          let phase = acc.find((p) => p.name === t.phase);
          if (!phase) {
            phase = { name: t.phase, items: [] };
            acc.push(phase);
          }
          phase.items.push(t.title);
          return acc;
        }, []),
      },
      sortOrder: 4,
    },
    {
      type: "ux_recommendation",
      title: "UX Recommendation",
      content: {
        body: "Split-panel review layout with status chips and one-click approve/reject.",
      },
      sortOrder: 5,
    },
    {
      type: "app_spec",
      title: "App Spec",
      content: {
        appTitle: title,
        features: ["Submit request", "Approval queue", "Audit trail", "Email notifications"],
      },
      sortOrder: 6,
    },
  ];

  for (const a of artifacts) {
    await db.artifact.create({
      data: {
        projectId,
        type: a.type,
        title: a.title,
        content: JSON.stringify(a.content),
        sortOrder: a.sortOrder,
      },
    });
  }

  for (const key of STYLE_KEYS) {
    await db.designVariant.create({
      data: {
        projectId,
        name: key.charAt(0).toUpperCase() + key.slice(1),
        styleKey: key,
        previewHtml: generateStylePreviewHtml(key, title),
      },
    });
  }
}
