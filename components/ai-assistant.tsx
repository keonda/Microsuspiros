"use client";

import { useState } from "react";
import { Copy, FilePlus, Send, Wand2 } from "lucide-react";

const commands = [
  ["summarize", "Summarize current document"],
  ["next_scene", "Suggest next scene"],
  ["inconsistencies", "Find inconsistencies"],
  ["pacing", "Identify pacing issues"],
  ["contradictions", "Find contradictions with context"],
  ["rewrite_softer", "Rewrite selected text softer"],
  ["rewrite_darker", "Rewrite selected text darker"],
  ["rewrite_cinematic", "Rewrite more cinematic"],
  ["extract_character_notes", "Extract character details"],
  ["extract_location_details", "Extract location details"],
  ["scene_summary", "Create scene summary"],
  ["chapter_titles", "Generate chapter title ideas"],
  ["scene_questions", "Generate scene questions"]
] as const;

export function AIAssistant({
  projectId,
  documentId,
  documentText,
  selectedText,
  scenes = [],
  entities = [],
  onInsert
}: {
  projectId: string;
  documentId?: string;
  documentText: string;
  selectedText: string;
  scenes?: { title: string; summary: string; goal?: string | null; conflict?: string | null; outcome?: string | null }[];
  entities?: { name: string; type: string; description?: string }[];
  onInsert?: (text: string) => void;
}) {
  const [message, setMessage] = useState("");
  const [response, setResponse] = useState("");
  const [status, setStatus] = useState("");
  const [contextMode, setContextMode] = useState("current_document");

  async function run(command: string) {
    setStatus("Thinking...");
    setResponse("");
    const res = await fetch(`/api/projects/${projectId}/ai`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        command,
        message,
        documentId,
        selectedText,
        documentText,
        scenes,
        entities,
        contextMode: selectedText ? "selected_text" : contextMode
      })
    });
    const json = await res.json();
    setStatus(json.setupRequired ? "Setup needed" : res.ok ? "Ready" : "Request failed");
    setResponse(json.text || json.error || "No response.");
  }

  async function saveAsNote() {
    if (!response) return;
    await fetch(`/api/projects/${projectId}/story-notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "AI suggestion", body: response, type: "GENERAL" })
    });
    setStatus("Saved as story note");
  }

  async function saveAsResearch() {
    if (!response) return;
    await fetch(`/api/projects/${projectId}/research-notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "AI research note", summary: response })
    });
    setStatus("Saved as research note");
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2">
        <select className="rounded-md border border-[var(--editor-border)] bg-[var(--editor-background)] px-3 py-2 text-sm text-[var(--editor-foreground)]" value={contextMode} onChange={(event) => setContextMode(event.target.value)}>
          <option value="current_document">Current document only</option>
          <option value="document_linked_notes">Current document + linked notes</option>
          <option value="document_scenes">Current document + scenes</option>
          <option value="document_entities">Current document + character/entity notes</option>
          <option value="selected_project_context">Selected project context</option>
        </select>
        {commands.map(([value, label]) => (
          <button key={value} className="flex items-center gap-2 rounded-md border border-[var(--editor-border)] bg-[var(--editor-background)] px-3 py-2 text-left text-sm text-[var(--editor-foreground)] hover:bg-[var(--muted)]" onClick={() => void run(value)} type="button">
            <Wand2 className="size-4" /> {label}
          </button>
        ))}
      </div>
      <textarea className="min-h-24 w-full rounded-md border border-[var(--editor-border)] bg-[var(--editor-background)] px-3 py-2 text-sm text-[var(--editor-foreground)] placeholder:text-[var(--editor-muted)]" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Ask something specific..." />
      <button className="flex w-full items-center justify-center gap-2 rounded-md bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-[var(--primary-foreground)]" onClick={() => void run("chat")} type="button">
        <Send className="size-4" /> Send
      </button>
      {status ? <p className="text-xs text-[var(--editor-muted)]">{status}</p> : null}
      {response ? (
        <div className="rounded-lg border border-[var(--editor-border)] bg-[var(--editor-background)] p-3 text-sm leading-6 text-[var(--editor-foreground)]">
          <pre className="whitespace-pre-wrap font-sans">{response}</pre>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="rounded-md border border-[var(--editor-border)] bg-[var(--muted)] px-3 py-2 text-xs" onClick={() => void navigator.clipboard.writeText(response)} type="button"><Copy className="mr-1 inline size-3" />Copy</button>
            {onInsert ? <button className="rounded-md border border-[var(--editor-border)] bg-[var(--muted)] px-3 py-2 text-xs" onClick={() => onInsert(response)} type="button">Insert below selection</button> : null}
            <button className="rounded-md border border-[var(--editor-border)] bg-[var(--muted)] px-3 py-2 text-xs" onClick={() => void saveAsNote()} type="button"><FilePlus className="mr-1 inline size-3" />Save as story note</button>
            <button className="rounded-md border border-[var(--editor-border)] bg-[var(--muted)] px-3 py-2 text-xs" onClick={() => void saveAsResearch()} type="button">Save as research note</button>
            <button className="rounded-md border border-[var(--editor-border)] bg-[var(--muted)] px-3 py-2 text-xs" onClick={() => void navigator.clipboard.writeText(response)} type="button">Use for scene/entity</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
