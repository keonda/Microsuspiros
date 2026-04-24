"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { Bold, Heading1, Heading2, Italic, List, ListOrdered, Maximize2, Minus, Moon, Quote, Save, UnderlineIcon } from "lucide-react";
import { cn } from "@/lib/format";
import { readingMinutes } from "@/lib/writer-utils";

type WriterEditorProps = {
  documentId: string;
  title: string;
  contentJson: unknown;
  contentHtml: string;
  wordCount: number;
  charCount: number;
  updatedAt: string;
};

export function WriterEditor(props: WriterEditorProps) {
  const [title, setTitle] = useState(props.title);
  const [status, setStatus] = useState<"saved" | "saving" | "dirty">("saved");
  const [savedAt, setSavedAt] = useState(props.updatedAt);
  const [words, setWords] = useState(props.wordCount);
  const [chars, setChars] = useState(props.charCount);
  const [fullscreen, setFullscreen] = useState(false);
  const [focus, setFocus] = useState(false);
  const [dark, setDark] = useState(false);

  const editor = useEditor({
    extensions: [StarterKit, Underline],
    content: props.contentJson || props.contentHtml || "<p></p>",
    editorProps: {
      attributes: {
        spellcheck: "true"
      }
    },
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      setStatus("dirty");
      setWords(countWords(editor.getText()));
      setChars(editor.getText().length);
    }
  });

  const save = useCallback(async () => {
    if (!editor) return;
    setStatus("saving");
    const response = await fetch(`/api/documents/${props.documentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        contentJson: editor.getJSON(),
        contentHtml: editor.getHTML(),
        plainText: editor.getText()
      })
    });
    if (!response.ok) {
      setStatus("dirty");
      return;
    }
    const json = await response.json();
    setWords(json.wordCount);
    setChars(json.charCount);
    setSavedAt(json.savedAt);
    setStatus("saved");
  }, [editor, props.documentId, title]);

  useEffect(() => {
    if (status !== "dirty") return;
    const timeout = window.setTimeout(() => void save(), 1100);
    return () => window.clearTimeout(timeout);
  }, [save, status]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void save();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save]);

  const shellClass = useMemo(
    () =>
      cn(
        "bg-paper",
        fullscreen && "fixed inset-0 z-50 overflow-auto",
        dark && "bg-[#1f2020] text-stone-100",
        focus && "mx-auto max-w-3xl"
      ),
    [dark, focus, fullscreen]
  );

  if (!editor) return null;

  return (
    <section className={shellClass}>
      <div className={cn("sticky top-0 z-10 border-b border-stone-200/80 bg-paper/95 px-4 py-3 backdrop-blur", dark && "border-stone-700 bg-[#1f2020]/95")}>
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2">
          <input
            className={cn("mr-auto min-w-48 bg-transparent font-serif text-2xl font-bold outline-none", dark && "text-stone-100")}
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              setStatus("dirty");
            }}
          />
          <ToolbarButton active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} label="Heading 1"><Heading1 /></ToolbarButton>
          <ToolbarButton active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} label="Heading 2"><Heading2 /></ToolbarButton>
          <ToolbarButton active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} label="Bold"><Bold /></ToolbarButton>
          <ToolbarButton active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} label="Italic"><Italic /></ToolbarButton>
          <ToolbarButton active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} label="Underline"><UnderlineIcon /></ToolbarButton>
          <ToolbarButton active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} label="Bullet list"><List /></ToolbarButton>
          <ToolbarButton active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} label="Numbered list"><ListOrdered /></ToolbarButton>
          <ToolbarButton active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()} label="Quote"><Quote /></ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} label="Rule"><Minus /></ToolbarButton>
          <ToolbarButton onClick={() => setDark((value) => !value)} label="Dark editor"><Moon /></ToolbarButton>
          <ToolbarButton onClick={() => setFocus((value) => !value)} label="Focus mode"><span className="text-xs font-bold">F</span></ToolbarButton>
          <ToolbarButton onClick={() => setFullscreen((value) => !value)} label="Fullscreen"><Maximize2 /></ToolbarButton>
          <ToolbarButton onClick={() => void save()} label="Save"><Save /></ToolbarButton>
        </div>
        <div className="mx-auto mt-2 flex max-w-5xl flex-wrap gap-3 text-xs text-stone-500">
          <span>{status === "saving" ? "Saving..." : status === "dirty" ? "Unsaved changes" : "Saved"}</span>
          <span>{words.toLocaleString()} words</span>
          <span>{chars.toLocaleString()} characters</span>
          <span>{readingMinutes(words)} min read</span>
          <span>Last saved {new Date(savedAt).toLocaleString()}</span>
        </div>
      </div>
      <div className={cn("prose-editor mx-auto max-w-5xl px-5 py-8", dark && "prose-invert")}>
        <EditorContent editor={editor} />
      </div>
    </section>
  );
}

function ToolbarButton({ children, label, active, onClick }: { children: React.ReactNode; label: string; active?: boolean; onClick: () => void }) {
  return (
    <button
      className={cn("flex size-8 items-center justify-center rounded-md border border-stone-200 bg-white text-stone-700 hover:bg-parchment [&_svg]:size-4", active && "border-cedar bg-parchment text-cedar")}
      onClick={onClick}
      title={label}
      type="button"
    >
      {children}
    </button>
  );
}

function countWords(text: string) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

// TODO: Advanced spellcheck/grammar suggestions should layer into this editor without replacing browser spellcheck.
