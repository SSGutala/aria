import dynamic from "next/dynamic";

export const FlowDiagramEditor = dynamic(
  () =>
    import("./flow-diagram-editor").then((mod) => mod.FlowDiagramEditor),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[480px] items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900/50 text-sm text-zinc-500">
        Loading diagram editor…
      </div>
    ),
  }
);
