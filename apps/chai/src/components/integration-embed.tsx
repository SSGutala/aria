"use client";

type Props = {
  embedUrl: string;
  title?: string;
};

export function IntegrationEmbed({ embedUrl, title }: Props) {
  return (
    <div className="flex h-full min-h-[480px] flex-col rounded-xl border border-slate-200 bg-white overflow-hidden">
      {title && (
        <div className="border-b border-slate-100 px-4 py-2 text-sm font-medium text-slate-700">
          {title} — connected editor
        </div>
      )}
      <iframe
        src={embedUrl}
        title={title || "Connected document"}
        className="h-full w-full flex-1 border-0"
        allow="clipboard-write"
      />
    </div>
  );
}
