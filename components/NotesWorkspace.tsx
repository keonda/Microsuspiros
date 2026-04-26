"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type DragEvent, useEffect, useMemo, useRef, useState } from "react";
import { Brain, CheckCircle2, FilePlus2, Focus, Folder, Inbox, Library, LogOut, Moon, PanelLeftClose, Plus, Save, Search, Send, Settings, Sun } from "lucide-react";
import { MarkdownPreview } from "@/components/MarkdownPreview";
import { ThemeBoot } from "@/components/ThemeBoot";

type User = { id: string; email: string; name: string | null; role: "user" | "admin" };
type Tag = { id: string; name: string };
type Note = {
  id: string;
  title: string;
  content: string;
  notebookId: string | null;
  updatedAt: string;
  tags?: { tag: Tag }[];
  incoming?: { sourceNote: { id: string; title: string } }[];
  outgoing?: { targetTitle: string; targetNoteId: string | null }[];
};
type Notebook = { id: string; title: string; parentId: string | null; notes: { id: string; title: string }[] };
type Settings = { theme: string; focusMode: boolean; editorMode: string };
type AiProposal = {
  intent: "create_note" | "append_note" | "replace_note" | "none";
  title?: string;
  content?: string;
  appendContent?: string;
  reply: string;
};

const aiActions = [
  ["summarize", "Summarize"],
  ["rewrite", "Rewrite"],
  ["markdown", "Format as Markdown"],
  ["outline", "Create outline"],
  ["links", "Suggest links"],
  ["organize", "Organize this note"]
] as const;

export function NotesWorkspace({
  user,
  initialNotes,
  initialNotebooks,
  initialTags,
  initialSettings
}: {
  user: User;
  initialNotes: Note[];
  initialNotebooks: Notebook[];
  initialTags: Tag[];
  initialSettings: Settings;
}) {
  const [notes, setNotes] = useState(initialNotes);
  const [notebooks, setNotebooks] = useState(initialNotebooks);
  const [tags] = useState(initialTags);
  const [settings, setSettings] = useState(initialSettings);
  const [selectedId, setSelectedId] = useState(initialNotes[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Saved");
  const [aiResult, setAiResult] = useState("");
  const [aiLoading, setAiLoading] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [chatMessage, setChatMessage] = useState("");
  const [proposal, setProposal] = useState<AiProposal | null>(null);
  const [draggingNoteId, setDraggingNoteId] = useState("");
  const [dropTargetId, setDropTargetId] = useState("");
  const [wikiSuggestions, setWikiSuggestions] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();

  const selected = notes.find((note) => note.id === selectedId) ?? notes[0];
  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return notes.filter((note) => `${note.title} ${note.content}`.toLowerCase().includes(q));
  }, [notes, query]);

  useEffect(() => {
    if (!selected || status !== "Unsaved changes") return;
    const timer = window.setTimeout(() => saveNote(false), 900);
    return () => window.clearTimeout(timer);
  }, [selected?.title, selected?.content, status]);

  function updateSelected(patch: Partial<Note>) {
    setStatus("Unsaved changes");
    setNotes((current) => current.map((note) => (note.id === selected?.id ? { ...note, ...patch } : note)));
  }

  async function refreshNotes() {
    const response = await fetch("/api/notes");
    const data = await response.json();
    setNotes(data.notes ?? []);
  }

  async function refreshLibrary() {
    const [notesResponse, notebooksResponse] = await Promise.all([fetch("/api/notes"), fetch("/api/notebooks")]);
    const notesData = await notesResponse.json();
    const notebooksData = await notebooksResponse.json();
    setNotes(notesData.notes ?? []);
    setNotebooks(notebooksData.notebooks ?? []);
  }

  async function saveNote(version = true) {
    if (!selected) return;
    setStatus("Saving...");
    const response = await fetch(`/api/notes/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: selected.title,
        content: selected.content,
        notebookId: selected.notebookId,
        createVersion: version
      })
    });
    setStatus(response.ok ? "Saved" : "Save failed");
    if (response.ok) refreshNotes();
  }

  async function createNote(title = "Untitled note", notebookId?: string | null) {
    const response = await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content: `# ${title}\n\n`, notebookId })
    });
    const data = await response.json();
    if (response.ok) {
      await refreshLibrary();
      setSelectedId(data.note.id);
    }
  }

  async function createNoteInNotebook(notebook: Notebook) {
    const title = prompt(`New note in ${notebook.title}`, "Untitled note");
    if (!title) return;
    await createNote(title, notebook.id);
  }

  async function createNotebook() {
    const title = prompt("Notebook name");
    if (!title) return;
    const response = await fetch("/api/notebooks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title })
    });
    const data = await response.json();
    if (response.ok) setNotebooks((current) => [...current, { ...data.notebook, notes: [] }]);
  }

  async function moveNote(noteId: string, notebookId: string | null) {
    const note = notes.find((item) => item.id === noteId);
    if (!note) return;
    setDraggingNoteId("");
    setDropTargetId("");
    setNotes((current) => current.map((item) => (item.id === noteId ? { ...item, notebookId } : item)));
    setNotebooks((current) =>
      current.map((notebook) => ({
        ...notebook,
        notes:
          notebook.id === notebookId
            ? [...notebook.notes.filter((item) => item.id !== noteId), { id: note.id, title: note.title }]
            : notebook.notes.filter((item) => item.id !== noteId)
      }))
    );
    const response = await fetch(`/api/notes/${noteId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notebookId })
    });
    if (!response.ok) {
      await refreshLibrary();
      return;
    }
    await refreshLibrary();
  }

  function startNoteDrag(event: DragEvent, noteId: string) {
    event.dataTransfer.setData("text/plain", noteId);
    event.dataTransfer.effectAllowed = "move";
    setDraggingNoteId(noteId);
  }

  function allowNotebookDrop(event: DragEvent, notebookId: string | null) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDropTargetId(notebookId ?? "unfiled");
  }

  async function dropNote(event: DragEvent, notebookId: string | null) {
    event.preventDefault();
    const noteId = event.dataTransfer.getData("text/plain") || draggingNoteId;
    if (noteId) await moveNote(noteId, notebookId);
  }

  async function openWiki(title: string) {
    const found = notes.find((note) => note.title.toLowerCase() === title.toLowerCase());
    if (found) {
      setSelectedId(found.id);
      return;
    }
    if (confirm(`Create "${title}"?`)) createNote(title);
  }

  async function runAi(action: string) {
    if (!selected) return;
    setAiLoading(action);
    setAiResult("");
    const selection = textareaRef.current
      ? textareaRef.current.value.slice(textareaRef.current.selectionStart, textareaRef.current.selectionEnd)
      : "";
    const response = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, content: selected.content, selectedText: selection })
    });
    const data = await response.json();
    setAiLoading("");
    setAiResult(response.ok ? data.result : data.error);
  }

  async function sendAssistantChat() {
    if (!chatInput.trim()) return;
    setAiLoading("chat");
    setChatMessage("");
    setProposal(null);
    const response = await fetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: chatInput, currentNoteId: selected?.id })
    });
    const data = await response.json();
    setAiLoading("");
    if (!response.ok) {
      setChatMessage(data.error ?? "Could not read that request.");
      return;
    }
    setProposal(data.proposal);
    setChatMessage(data.proposal.reply);
  }

  async function applyAssistantProposal() {
    if (!proposal || proposal.intent === "none") return;
    setAiLoading("apply");
    const response = await fetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: chatInput || proposal.reply, apply: true, proposal })
    });
    const data = await response.json();
    setAiLoading("");
    if (!response.ok) {
      setChatMessage(data.error ?? "Could not apply that change.");
      return;
    }
    setChatMessage(data.reply);
    setProposal(null);
    setChatInput("");
    await refreshNotes();
    if (data.note?.id) setSelectedId(data.note.id);
  }

  async function setTheme(theme: string) {
    setSettings((current) => ({ ...current, theme }));
    await fetch("/api/settings/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme })
    });
  }

  async function toggleFocus() {
    const focusMode = !settings.focusMode;
    setSettings((current) => ({ ...current, focusMode }));
    await fetch("/api/settings/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ focusMode })
    });
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-paper text-ink dark:bg-zinc-950 dark:text-zinc-100">
      <ThemeBoot theme={settings.theme} />
      <header className="flex h-14 items-center justify-between border-b border-zinc-200 bg-white px-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center gap-3">
          <button onClick={toggleFocus} className="rounded-md p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800" title="Focus mode">
            {settings.focusMode ? <PanelLeftClose size={18} /> : <Focus size={18} />}
          </button>
          <div>
            <p className="font-semibold">Microsuspiros Notes</p>
            <p className="text-xs text-zinc-500">{user.email}</p>
          </div>
        </div>
        <nav className="flex items-center gap-1">
          <button onClick={() => setTheme(settings.theme === "dark" ? "light" : "dark")} className="rounded-md p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800" title="Theme">
            {settings.theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <Link className="rounded-md p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800" href="/media" title="Media">
            <Library size={18} />
          </Link>
          <Link className="rounded-md p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800" href="/settings" title="Settings">
            <Settings size={18} />
          </Link>
          <button onClick={logout} className="rounded-md p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800" title="Log out">
            <LogOut size={18} />
          </button>
        </nav>
      </header>

      <div className={`grid h-[calc(100vh-3.5rem)] ${settings.focusMode ? "grid-cols-1" : "grid-cols-[280px_minmax(0,1fr)_320px]"}`}>
        {!settings.focusMode ? (
          <aside className="overflow-y-auto border-r border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="relative mb-3">
              <Search className="absolute left-3 top-2.5 text-zinc-400" size={16} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search notes"
                className="w-full rounded-md border border-zinc-200 bg-zinc-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-moss dark:border-zinc-700 dark:bg-zinc-950"
              />
            </div>
            <button onClick={() => createNote()} className="mb-3 flex w-full items-center justify-center gap-2 rounded-md bg-ink px-3 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-950">
              <FilePlus2 size={16} /> New note
            </button>
            <div className="mb-4">
              <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase text-zinc-500">
                Notebooks <button onClick={createNotebook}>+</button>
              </div>
              {notebooks.map((notebook) => (
                <div
                  key={notebook.id}
                  onDragOver={(event) => allowNotebookDrop(event, notebook.id)}
                  onDragLeave={() => setDropTargetId("")}
                  onDrop={(event) => dropNote(event, notebook.id)}
                  className={`mb-2 rounded-md border px-2 py-2 text-sm ${
                    dropTargetId === notebook.id
                      ? "border-moss bg-mist/70 dark:border-emerald-600 dark:bg-emerald-950/40"
                      : "border-transparent bg-zinc-50 dark:bg-zinc-950"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2 text-zinc-700 dark:text-zinc-300">
                      <Folder size={15} />
                      <span className="truncate font-medium">{notebook.title}</span>
                    </div>
                    <button onClick={() => createNoteInNotebook(notebook)} className="rounded p-1 hover:bg-white dark:hover:bg-zinc-800" title={`New note in ${notebook.title}`}>
                      <Plus size={14} />
                    </button>
                  </div>
                  {notebook.notes.length ? (
                    <div className="mt-2 space-y-1">
                      {notebook.notes.map((note) => (
                        <button
                          key={note.id}
                          draggable
                          onDragStart={(event) => startNoteDrag(event, note.id)}
                          onDragEnd={() => {
                            setDraggingNoteId("");
                            setDropTargetId("");
                          }}
                          onClick={() => setSelectedId(note.id)}
                          className={`w-full rounded px-2 py-1 text-left text-xs ${
                            note.id === selected?.id ? "bg-white text-ink shadow-sm dark:bg-zinc-800 dark:text-white" : "text-zinc-600 hover:bg-white dark:text-zinc-400 dark:hover:bg-zinc-800"
                          }`}
                        >
                          <span className="block truncate">{note.title}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 rounded border border-dashed border-zinc-300 px-2 py-2 text-xs text-zinc-500 dark:border-zinc-700">
                      Drop notes here
                    </p>
                  )}
                </div>
              ))}
            </div>
            <div className="mb-4">
              <div
                onDragOver={(event) => allowNotebookDrop(event, null)}
                onDragLeave={() => setDropTargetId("")}
                onDrop={(event) => dropNote(event, null)}
                className={`mb-3 rounded-md border border-dashed px-2 py-2 text-xs ${
                  dropTargetId === "unfiled"
                    ? "border-moss bg-mist/70 text-ink dark:border-emerald-600 dark:bg-emerald-950/40 dark:text-zinc-100"
                    : "border-zinc-300 text-zinc-500 dark:border-zinc-700"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Inbox size={14} /> Drop here to remove from notebook
                </div>
              </div>
              <p className="mb-2 text-xs font-semibold uppercase text-zinc-500">All notes</p>
              <div className="space-y-1">
                {filtered.map((note) => (
                  <button
                    key={note.id}
                    draggable
                    onDragStart={(event) => startNoteDrag(event, note.id)}
                    onDragEnd={() => {
                      setDraggingNoteId("");
                      setDropTargetId("");
                    }}
                    onClick={() => setSelectedId(note.id)}
                    className={`w-full rounded-md px-2 py-2 text-left text-sm ${note.id === selected?.id ? "bg-mist text-ink dark:bg-zinc-800 dark:text-white" : "hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}
                  >
                    <span className="block truncate font-medium">{note.title}</span>
                    <span className="block truncate text-xs text-zinc-500">{new Date(note.updatedAt).toLocaleDateString()}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span key={tag.id} className="rounded-full bg-zinc-100 px-2 py-1 text-xs dark:bg-zinc-800">
                  #{tag.name}
                </span>
              ))}
            </div>
          </aside>
        ) : null}

        <section className="overflow-hidden">
          {selected ? (
            <div className="flex h-full flex-col">
              <div className="flex items-center gap-3 border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
                <input
                  value={selected.title}
                  onChange={(event) => updateSelected({ title: event.target.value })}
                  className="min-w-0 flex-1 bg-transparent text-xl font-semibold outline-none"
                />
                <span className="text-xs text-zinc-500">{status}</span>
                <button onClick={() => saveNote(true)} className="rounded-md border border-zinc-200 p-2 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800" title="Save">
                  <Save size={16} />
                </button>
              </div>
              <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-2">
                <div className="relative border-r border-zinc-200 dark:border-zinc-800">
                  <textarea
                    ref={textareaRef}
                    value={selected.content}
                    onChange={(event) => {
                      updateSelected({ content: event.target.value });
                      setWikiSuggestions(event.target.value.slice(0, event.target.selectionStart).endsWith("[["));
                    }}
                    className="h-full w-full resize-none bg-white p-6 font-mono text-sm leading-7 outline-none dark:bg-zinc-950"
                    spellCheck
                  />
                  {wikiSuggestions ? (
                    <div className="absolute bottom-5 left-5 max-h-44 w-64 overflow-y-auto rounded-md border border-zinc-200 bg-white p-2 shadow-quiet dark:border-zinc-700 dark:bg-zinc-900">
                      {notes.slice(0, 8).map((note) => (
                        <button
                          key={note.id}
                          className="block w-full rounded px-2 py-1 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
                          onClick={() => {
                            updateSelected({ content: `${selected.content}${note.title}]]` });
                            setWikiSuggestions(false);
                          }}
                        >
                          {note.title}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="overflow-y-auto bg-paper p-6 dark:bg-zinc-900">
                  <MarkdownPreview content={selected.content} onWikiLink={openWiki} />
                  <section className="mt-10 border-t border-zinc-200 pt-4 text-sm dark:border-zinc-700">
                    <p className="mb-2 font-semibold">Backlinks</p>
                    {selected.incoming?.length ? (
                      selected.incoming.map((link) => (
                        <button key={link.sourceNote.id} onClick={() => setSelectedId(link.sourceNote.id)} className="mr-2 rounded-full bg-white px-3 py-1 dark:bg-zinc-800">
                          {link.sourceNote.title}
                        </button>
                      ))
                    ) : (
                      <p className="text-zinc-500">No backlinks yet.</p>
                    )}
                    <p className="mb-2 mt-5 font-semibold">Graph</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-moss px-3 py-2 text-white">{selected.title}</span>
                      {selected.outgoing?.map((link) => (
                        <span key={link.targetTitle} className="rounded-md border border-zinc-300 px-3 py-2 text-xs dark:border-zinc-700">
                          {link.targetTitle}
                        </span>
                      ))}
                    </div>
                  </section>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center">
              <button onClick={() => createNote()} className="rounded-md bg-ink px-4 py-2 text-white dark:bg-zinc-100 dark:text-zinc-950">
                Create your first note
              </button>
            </div>
          )}
        </section>

        {!settings.focusMode ? (
          <aside className="overflow-y-auto border-l border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-4 flex items-center gap-2">
              <Brain size={18} />
              <h2 className="font-semibold">AI assistant</h2>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {aiActions.map(([action, label]) => (
                <button key={action} onClick={() => runAi(action)} className="rounded-md border border-zinc-200 px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
                  {aiLoading === action ? "Thinking..." : label}
                </button>
              ))}
            </div>
            <div className="mt-4 rounded-md bg-paper p-3 text-sm leading-6 dark:bg-zinc-950">
              {aiResult || "AI suggestions appear here. They never overwrite your note automatically."}
            </div>
            <div className="mt-5 border-t border-zinc-200 pt-4 dark:border-zinc-800">
              <p className="mb-2 text-sm font-semibold">Ask it to file notes</p>
              <textarea
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                placeholder={'Try: add "SSH keys rotated" to servers.md'}
                className="h-24 w-full resize-none rounded-md border border-zinc-200 bg-white p-3 text-sm outline-none focus:border-moss dark:border-zinc-700 dark:bg-zinc-950"
              />
              <button onClick={sendAssistantChat} className="mt-2 flex w-full items-center justify-center gap-2 rounded-md bg-ink px-3 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-950">
                <Send size={15} /> {aiLoading === "chat" ? "Reading..." : "Plan note action"}
              </button>
              {chatMessage ? <p className="mt-3 rounded-md bg-paper p-3 text-sm leading-6 dark:bg-zinc-950">{chatMessage}</p> : null}
              {proposal && proposal.intent !== "none" ? (
                <div className="mt-3 rounded-md border border-moss/30 bg-mist/50 p-3 text-sm dark:border-emerald-900 dark:bg-emerald-950/30">
                  <p className="font-semibold">
                    {proposal.intent.replace("_", " ")} · {proposal.title}
                  </p>
                  <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-white p-2 text-xs dark:bg-zinc-950">
                    {proposal.appendContent || proposal.content}
                  </pre>
                  <button onClick={applyAssistantProposal} className="mt-3 flex w-full items-center justify-center gap-2 rounded-md bg-moss px-3 py-2 text-sm text-white">
                    <CheckCircle2 size={15} /> {aiLoading === "apply" ? "Applying..." : "Apply to notes"}
                  </button>
                </div>
              ) : null}
            </div>
          </aside>
        ) : null}
      </div>
    </main>
  );
}
