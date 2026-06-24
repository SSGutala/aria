"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

export type ChatMessage = {
  id: string;
  role: string;
  content: string;
  stage?: string | null;
  createdAt: string;
};

type Props = {
  projectId: string;
  initialMessages: ChatMessage[];
  projectStatus: string;
  onStatusChange?: (status: string) => void;
};

export function ChatPanel({
  projectId,
  initialMessages,
  projectStatus,
  onStatusChange,
}: Props) {
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setInput("");
    try {
      const res = await fetch(`/api/projects/${projectId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Send failed");
      setMessages((prev) => [...prev, ...data.messages]);
      if (data.status) onStatusChange?.(data.status);
    } catch {
      setInput(text);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col bg-chai-bg">
      <div className="border-b border-chai-border px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-chai-muted">
          Chat
        </p>
        <p className="mt-0.5 text-xs text-chai-subtle capitalize">
          Stage: {projectStatus}
        </p>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {messages.map((m) => (
          <div
            key={m.id}
            className={cn(
              "max-w-[92%] text-sm leading-relaxed",
              m.role === "user" ? "ml-auto" : ""
            )}
          >
            <div
              className={cn(
                "rounded-2xl px-4 py-3",
                m.role === "user"
                  ? "bg-chai-pink/15 text-chai-text border border-chai-pink/25"
                  : "bg-chai-surface border border-chai-border text-chai-subtle"
              )}
            >
              {m.content}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex items-center gap-2 text-xs text-chai-muted">
            <Loader2 size={14} className="animate-spin" />
            Chai is thinking…
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-chai-border p-4">
        <div className="relative rounded-xl border border-chai-border-subtle bg-chai-surface">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Describe changes, pick designs, or say build…"
            rows={3}
            className="w-full resize-none bg-transparent px-4 py-3 pr-12 text-sm text-chai-text placeholder:text-chai-muted focus:outline-none"
          />
          <button
            type="button"
            onClick={send}
            disabled={!input.trim() || sending}
            className="absolute bottom-2.5 right-2.5 flex h-8 w-8 items-center justify-center rounded-lg bg-chai-pink text-white transition-opacity disabled:opacity-40"
          >
            <ArrowUp size={16} />
          </button>
        </div>
        <p className="mt-2 text-center text-[10px] text-chai-muted">
          Enter to send · Shift+Enter for newline
        </p>
      </div>
    </div>
  );
}
