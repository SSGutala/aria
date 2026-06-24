"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect } from "react";

type Props = {
  content: string;
  onChange?: (html: string) => void;
  readOnly?: boolean;
};

export function DocumentEditor({ content, onChange, readOnly }: Props) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: content || "<p></p>",
    editable: !readOnly,
    onUpdate: ({ editor: e }) => onChange?.(e.getHTML()),
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content || "<p></p>");
    }
  }, [content, editor]);

  return (
    <div className="prose prose-invert max-w-none rounded-xl border border-zinc-700 bg-zinc-900/50 p-4">
      <EditorContent editor={editor} />
    </div>
  );
}
