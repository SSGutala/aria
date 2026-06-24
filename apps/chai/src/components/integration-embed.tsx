"use client";

type Props = {
  embedUrl: string;
  title?: string;
};

export function IntegrationEmbed({ embedUrl, title }: Props) {
  return (
    <div className="flex h-full min-h-[480px] flex-col overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900">
      {title && (
        <div className="border-b border-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300">
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
