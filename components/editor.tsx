"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { Bold, GitPullRequest, Heading1, Heading2, History, Italic, LinkIcon, List, ListOrdered, Maximize2, Minus, Palette, Quote, Save, UnderlineIcon } from "lucide-react";
import Link from "next/link";
import { AIAssistant } from "@/components/ai-assistant";
import { cn } from "@/lib/format";
import { readingMinutes } from "@/lib/writer-utils";

type WriterEditorProps = {
  projectId: string;
  documentId: string;
  title: string;
  contentJson: unknown;
  contentHtml: string;
  wordCount: number;
  charCount: number;
  updatedAt: string;
};

type SaveStatus = "saved" | "saving" | "dirty" | "failed";
type EditorPaperTheme = "light" | "sepia" | "dark" | "midnight";
type VersionItem = {
  id: string;
  label: string | null;
  titleSnapshot: string;
  plainTextSnapshot: string;
  wordCountSnapshot: number;
  changeSummary: string | null;
  createdAt: string;
};
type LinkItem = {
  id: string;
  rawText: string;
  targetId: string | null;
  targetType: string | null;
  href?: string | null;
  excerpt?: string | null;
  sourceTitle?: string;
};
type SceneItem = {
  id: string;
  title: string;
  summary: string;
  povCharacter: string | null;
  location: string | null;
  goal: string | null;
  conflict: string | null;
  outcome: string | null;
  emotionalTone: string | null;
  sortOrder: number;
};
type EntityItem = {
  id: string;
  name: string;
  type: string;
  description: string;
  aliases: string[];
  _count?: { mentions: number };
};
type EntityCandidate = { name: string; count: number; excerpts: string[] };

export function WriterEditor(props: WriterEditorProps) {
  const [title, setTitle] = useState(props.title);
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [savedAt, setSavedAt] = useState(props.updatedAt);
  const [words, setWords] = useState(props.wordCount);
  const [chars, setChars] = useState(props.charCount);
  const [fullscreen, setFullscreen] = useState(false);
  const [focus, setFocus] = useState(false);
  const [paperTheme, setPaperTheme] = useState<EditorPaperTheme>("light");
  const [editorWidth, setEditorWidth] = useState<"narrow" | "comfortable" | "wide">("comfortable");
  const [editorFont, setEditorFont] = useState<"serif" | "sans" | "mono">("serif");
  const [lineSpacing, setLineSpacing] = useState<"compact" | "comfortable" | "spacious">("comfortable");
  const [typewriter, setTypewriter] = useState(false);
  const [paragraphFocus, setParagraphFocus] = useState(false);
  const [selectedText, setSelectedText] = useState("");
  const [activePanel, setActivePanel] = useState<"outline" | "scenes" | "backlinks" | "versions" | "links" | "entities" | "ai">("outline");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [versions, setVersions] = useState<VersionItem[]>([]);
  const [scenes, setScenes] = useState<SceneItem[]>([]);
  const [entities, setEntities] = useState<EntityItem[]>([]);
  const [entityCandidates, setEntityCandidates] = useState<EntityCandidate[]>([]);
  const [outgoing, setOutgoing] = useState<LinkItem[]>([]);
  const [backlinks, setBacklinks] = useState<LinkItem[]>([]);
  const [unresolved, setUnresolved] = useState<LinkItem[]>([]);

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
    },
    onSelectionUpdate: ({ editor }) => {
      const { from, to } = editor.state.selection;
      setSelectedText(from === to ? "" : editor.state.doc.textBetween(from, to, "\n"));
    }
  });

  const refreshPanels = useCallback(async () => {
    const [versionsResponse, linksResponse, scenesResponse, entitiesResponse] = await Promise.all([
      fetch(`/api/documents/${props.documentId}/versions`),
      fetch(`/api/documents/${props.documentId}/links`),
      fetch(`/api/documents/${props.documentId}/scenes`),
      fetch(`/api/projects/${props.projectId}/entities`)
    ]);
    if (versionsResponse.ok) setVersions((await versionsResponse.json()).versions);
    if (scenesResponse.ok) setScenes((await scenesResponse.json()).scenes || []);
    if (entitiesResponse.ok) setEntities((await entitiesResponse.json()).entities || []);
    if (linksResponse.ok) {
      const json = await linksResponse.json();
      setOutgoing(json.outgoing || []);
      setBacklinks(json.backlinks || []);
      setUnresolved(json.unresolved || []);
    }
  }, [props.documentId, props.projectId]);

  const save = useCallback(async (saveMode: "autosave" | "manual" | "snapshot" = "autosave") => {
    if (!editor || status === "saving") return;
    setStatus("saving");
    try {
      const response = await fetch(`/api/documents/${props.documentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          contentJson: editor.getJSON(),
          contentHtml: editor.getHTML(),
          plainText: editor.getText(),
          saveMode
        })
      });
      if (!response.ok) {
        setStatus("failed");
        return;
      }
      const json = await response.json();
      setWords(json.wordCount);
      setChars(json.charCount);
      setSavedAt(json.savedAt);
      setStatus("saved");
      await refreshPanels();
    } catch {
      setStatus("failed");
    }
  }, [editor, props.documentId, refreshPanels, status, title]);

  useEffect(() => {
    if (status !== "dirty") return;
    const timeout = window.setTimeout(() => void save("autosave"), 3500);
    return () => window.clearTimeout(timeout);
  }, [save, status]);

  useEffect(() => {
    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (status !== "dirty" && status !== "failed") return;
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [status]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void refreshPanels(), 0);
    return () => window.clearTimeout(timeout);
  }, [refreshPanels]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void save("manual");
      }
      if ((event.ctrlKey || event.metaKey) && event.altKey && event.key.toLowerCase() === "f") {
        event.preventDefault();
        setFocus((value) => !value);
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        editor?.chain().focus().insertContent("[[Link target]]").run();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editor, save]);

  useEffect(() => {
    document.body.classList.toggle("writer-focus", focus);
    return () => document.body.classList.remove("writer-focus");
  }, [focus]);

  const outline = editor ? collectHeadings(editor.getJSON()) : [];

  const shellClass = useMemo(
    () =>
      cn(
        "writer-editor-shell min-h-[calc(100vh-4rem)]",
        fullscreen && "fixed inset-0 z-50 overflow-auto",
        focus && "fixed inset-0 z-50 overflow-auto"
      ),
    [focus, fullscreen]
  );

  if (!editor) return null;

  return (
    <section className={shellClass} data-paper-theme={paperTheme}>
      <div className="writer-toolbar sticky top-0 z-10 border-b px-4 py-3 backdrop-blur">
        <div className={cn("mx-auto flex flex-wrap items-center gap-2", focus ? "max-w-4xl" : "max-w-6xl")}>
          <input
            className="mr-auto min-w-48 bg-transparent font-serif text-2xl font-bold text-[var(--editor-foreground)] outline-none placeholder:text-[var(--editor-muted)]"
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              setStatus("dirty");
            }}
          />
          {!focus ? (
            <>
              <ToolbarButton active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} label="Heading 1"><Heading1 /></ToolbarButton>
              <ToolbarButton active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} label="Heading 2"><Heading2 /></ToolbarButton>
              <ToolbarButton active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} label="Bold"><Bold /></ToolbarButton>
              <ToolbarButton active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} label="Italic"><Italic /></ToolbarButton>
              <ToolbarButton active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} label="Underline"><UnderlineIcon /></ToolbarButton>
              <ToolbarButton active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} label="Bullet list"><List /></ToolbarButton>
              <ToolbarButton active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} label="Numbered list"><ListOrdered /></ToolbarButton>
              <ToolbarButton active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()} label="Quote"><Quote /></ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} label="Rule"><Minus /></ToolbarButton>
              <label className="inline-flex items-center gap-2 rounded-md border border-[var(--editor-border)] bg-[var(--editor-background)] px-2 py-1 text-xs font-medium text-[var(--editor-foreground)]">
                <Palette className="size-4" />
                <select
                  className="bg-transparent text-xs text-[var(--editor-foreground)] outline-none"
                  value={paperTheme}
                  onChange={(event) => setPaperTheme(event.target.value as EditorPaperTheme)}
                >
                  <option value="light">Light paper</option>
                  <option value="sepia">Sepia paper</option>
                  <option value="dark">Dark paper</option>
                  <option value="midnight">Midnight</option>
                </select>
              </label>
              <SelectControl label="Width" value={editorWidth} onChange={(value) => setEditorWidth(value as typeof editorWidth)} options={["narrow", "comfortable", "wide"]} />
              <SelectControl label="Font" value={editorFont} onChange={(value) => setEditorFont(value as typeof editorFont)} options={["serif", "sans", "mono"]} />
              <SelectControl label="Spacing" value={lineSpacing} onChange={(value) => setLineSpacing(value as typeof lineSpacing)} options={["compact", "comfortable", "spacious"]} />
            </>
          ) : null}
          <ToolbarButton active={focus} onClick={() => setFocus((value) => !value)} label={focus ? "Exit focus mode" : "Focus mode"}><span className="text-xs font-bold">{focus ? "Exit" : "F"}</span></ToolbarButton>
          <ToolbarButton onClick={() => setFullscreen((value) => !value)} label="Fullscreen"><Maximize2 /></ToolbarButton>
          <ToolbarButton onClick={() => void save("manual")} label="Save"><Save /></ToolbarButton>
          {!focus ? <ToolbarButton onClick={() => void save("snapshot")} label="Create Snapshot"><History /></ToolbarButton> : null}
          {!focus ? <ToolbarButton active={typewriter} onClick={() => setTypewriter((value) => !value)} label="Typewriter mode"><span className="text-xs font-bold">T</span></ToolbarButton> : null}
          {!focus ? <ToolbarButton active={paragraphFocus} onClick={() => setParagraphFocus((value) => !value)} label="Focus current paragraph"><span className="text-xs font-bold">P</span></ToolbarButton> : null}
          {!focus ? (
            <button className="rounded-md border border-[var(--editor-border)] bg-[var(--editor-background)] px-3 py-1.5 text-xs text-[var(--editor-foreground)] hover:bg-[var(--muted)]" onClick={() => setSidebarOpen((value) => !value)} type="button">
              {sidebarOpen ? "Hide panels" : "Show panels"}
            </button>
          ) : null}
        </div>
        <div className={cn("mx-auto mt-2 flex flex-wrap gap-3 text-xs text-[var(--editor-muted)]", focus ? "max-w-4xl" : "max-w-6xl")}>
          <span>{status === "saving" ? "Saving..." : status === "dirty" ? "Unsaved changes" : status === "failed" ? "Save failed" : "Saved"}</span>
          <span>{words.toLocaleString()} words</span>
          {!focus ? <span>{chars.toLocaleString()} characters</span> : null}
          {!focus ? <span>{readingMinutes(words)} min read</span> : null}
          {!focus ? <span>Last saved {new Date(savedAt).toLocaleString()}</span> : null}
        </div>
      </div>
      <div className={cn("grid gap-0", sidebarOpen && !focus && "xl:grid-cols-[1fr_380px]")}>
        <div className={cn("mx-auto w-full px-4 py-10 sm:px-8", focus ? "max-w-4xl py-16" : "max-w-5xl")}>
          <div
            className={cn(
              "writer-paper prose-editor mx-auto min-h-[72vh] rounded-xl px-6 py-12 sm:px-12 lg:px-16",
              editorWidth === "narrow" && "max-w-[700px]",
              editorWidth === "comfortable" && "max-w-[820px]",
              editorWidth === "wide" && "max-w-[960px]",
              editorFont === "sans" && "editor-font-sans",
              editorFont === "mono" && "editor-font-mono",
              lineSpacing === "compact" && "editor-spacing-compact",
              lineSpacing === "spacious" && "editor-spacing-spacious",
              typewriter && "editor-typewriter",
              paragraphFocus && "editor-paragraph-focus"
            )}
          >
            <EditorContent editor={editor} />
          </div>
        </div>
        {sidebarOpen && !focus ? (
          <aside className="writer-panel border-l p-4">
            <div className="mb-4 flex flex-wrap gap-2">
              <PanelButton active={activePanel === "outline"} onClick={() => setActivePanel("outline")} icon={<List />} label="Outline" />
              <PanelButton active={activePanel === "scenes"} onClick={() => setActivePanel("scenes")} icon={<span className="text-xs">S</span>} label="Scenes" />
              <PanelButton active={activePanel === "backlinks"} onClick={() => setActivePanel("backlinks")} icon={<GitPullRequest />} label="Backlinks" />
              <PanelButton active={activePanel === "versions"} onClick={() => setActivePanel("versions")} icon={<History />} label="Versions" />
              <PanelButton active={activePanel === "links"} onClick={() => setActivePanel("links")} icon={<LinkIcon />} label="Links" />
              <PanelButton active={activePanel === "entities"} onClick={() => setActivePanel("entities")} icon={<span className="text-xs">E</span>} label="Entities" />
              <PanelButton active={activePanel === "ai"} onClick={() => setActivePanel("ai")} icon={<span className="text-xs">AI</span>} label="AI" />
            </div>
            {activePanel === "outline" ? (
              <Panel title="Outline">
                {outline.map((item, index) => <p key={`${item}-${index}`} className="rounded-md px-2 py-1 text-sm text-[var(--editor-foreground)]">{item}</p>)}
                {!outline.length ? <p className="rounded-lg border border-[var(--editor-border)] p-3 text-sm text-[var(--editor-muted)]">Headings will appear here.</p> : null}
              </Panel>
            ) : null}
            {activePanel === "scenes" ? (
              <Panel title="Scenes">
                <ScenePanel
                  documentId={props.documentId}
                  scenes={scenes}
                  onChanged={refreshPanels}
                  onInsertBreak={(title) => editor.chain().focus().insertContent(`\n\n--- scene: ${title} ---\n\n`).run()}
                />
              </Panel>
            ) : null}
            {activePanel === "backlinks" ? (
              <Panel title="Backlinks">
                {backlinks.map((link) => (
                  <Link key={link.id} href={link.href || "#"} className="mb-3 block rounded-md border border-[var(--editor-border)] bg-[var(--editor-background)] p-3 text-sm text-[var(--editor-foreground)]">
                    <strong>{link.sourceTitle}</strong>
                    <span className="mt-1 block text-xs text-[var(--editor-muted)]">{link.excerpt}</span>
                  </Link>
                ))}
                {!backlinks.length ? <p className="rounded-lg border border-[var(--editor-border)] p-3 text-sm text-[var(--editor-muted)]">No backlinks yet.</p> : null}
              </Panel>
            ) : null}
            {activePanel === "versions" ? (
              <Panel title="Version History">
                <SnapshotForm documentId={props.documentId} onCreated={refreshPanels} />
                {versions.map((version) => (
                  <VersionRow key={version.id} version={version} currentText={editor.getText()} onChanged={refreshPanels} />
                ))}
                {!versions.length ? <p className="rounded-lg border border-[var(--editor-border)] p-3 text-sm text-[var(--editor-muted)]">No versions yet. Manual saves and timed autosaves create snapshots.</p> : null}
              </Panel>
            ) : null}
            {activePanel === "entities" ? (
              <Panel title="Story Entities">
                <EntityPanel projectId={props.projectId} entities={entities} candidates={entityCandidates} setCandidates={setEntityCandidates} onChanged={refreshPanels} />
              </Panel>
            ) : null}
            {activePanel === "links" ? (
              <Panel title="Wiki Links">
                {outgoing.map((link) => (
                  <div key={link.id} className="mb-3 rounded-md border border-[var(--editor-border)] bg-[var(--editor-background)] p-3 text-sm">
                    {link.href ? <Link href={link.href} className="font-semibold text-[var(--primary)]">[[{link.rawText}]]</Link> : <strong className="text-clay">[[{link.rawText}]]</strong>}
                    {!link.targetId ? <UnresolvedLink link={link} /> : <p className="mt-1 text-xs text-[var(--editor-muted)]">Resolved to {link.targetType?.toLowerCase().replace("_", " ")}</p>}
                  </div>
                ))}
                {!outgoing.length ? <p className="rounded-lg border border-[var(--editor-border)] p-3 text-sm text-[var(--editor-muted)]">Type [[Something]] to create a wiki link.</p> : null}
                {unresolved.length ? <p className="mt-3 text-xs text-clay">{unresolved.length} unresolved link(s).</p> : null}
              </Panel>
            ) : null}
            {activePanel === "ai" ? (
              <Panel title="AI Assistant">
                <p className="mb-3 text-xs text-[var(--editor-muted)]">{selectedText ? "Using selected text." : "Using current document content."}</p>
                <AIAssistant
                  projectId={props.projectId}
                  documentId={props.documentId}
                  documentText={editor.getText()}
                  selectedText={selectedText}
                  scenes={scenes}
                  entities={entities}
                  onInsert={(text) => {
                    const position = editor.state.selection.to;
                    editor.chain().focus().insertContentAt(position, `\n\n${text}`).run();
                  }}
                />
              </Panel>
            ) : null}
          </aside>
        ) : null}
      </div>
    </section>
  );
}

function ToolbarButton({ children, label, active, onClick }: { children: React.ReactNode; label: string; active?: boolean; onClick: () => void }) {
  return (
    <button
      className={cn(
        "flex size-8 items-center justify-center rounded-md border border-[var(--editor-border)] bg-[var(--editor-background)] text-[var(--editor-foreground)] transition hover:bg-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-45 [&_svg]:size-4",
        active && "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]"
      )}
      onClick={onClick}
      title={label}
      type="button"
    >
      {children}
    </button>
  );
}

function PanelButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      className={cn(
        "flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition",
        active
          ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]"
          : "border-[var(--editor-border)] bg-[var(--editor-background)] text-[var(--editor-foreground)] hover:bg-[var(--muted)]"
      )}
      onClick={onClick}
      type="button"
    >
      <span className="[&_svg]:size-3">{icon}</span>
      {label}
    </button>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 font-serif text-xl font-bold text-[var(--editor-foreground)]">{title}</h2>
      {children}
    </section>
  );
}

function SelectControl({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <label className="inline-flex items-center gap-2 rounded-md border border-[var(--editor-border)] bg-[var(--editor-background)] px-2 py-1 text-xs text-[var(--editor-foreground)]">
      {label}
      <select className="bg-transparent text-xs capitalize outline-none" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function SnapshotForm({ documentId, onCreated }: { documentId: string; onCreated: () => Promise<void> }) {
  const [label, setLabel] = useState("");
  const [summary, setSummary] = useState("");

  async function create() {
    await fetch(`/api/documents/${documentId}/versions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label, changeSummary: summary })
    });
    setLabel("");
    setSummary("");
    await onCreated();
  }

  return (
    <div className="mb-4 rounded-lg border border-[var(--editor-border)] bg-[var(--editor-background)] p-3">
      <input className="mb-2 w-full rounded-md border border-[var(--editor-border)] bg-[var(--input)] px-2 py-1.5 text-sm" value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Snapshot label" />
      <textarea className="mb-2 min-h-16 w-full rounded-md border border-[var(--editor-border)] bg-[var(--input)] px-2 py-1.5 text-sm" value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="Change summary" />
      <button className="w-full rounded-md bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-[var(--primary-foreground)]" onClick={() => void create()} type="button">
        Create Snapshot
      </button>
    </div>
  );
}

function ScenePanel({ documentId, scenes, onChanged, onInsertBreak }: { documentId: string; scenes: SceneItem[]; onChanged: () => Promise<void>; onInsertBreak: (title: string) => void }) {
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");

  async function createScene() {
    if (!title.trim()) return;
    await fetch(`/api/documents/${documentId}/scenes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, summary })
    });
    setTitle("");
    setSummary("");
    await onChanged();
  }

  async function updateScene(scene: SceneItem, patch: Partial<SceneItem>) {
    await fetch(`/api/scenes/${scene.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch)
    });
    await onChanged();
  }

  async function deleteScene(scene: SceneItem) {
    await fetch(`/api/scenes/${scene.id}`, { method: "DELETE" });
    await onChanged();
  }

  return (
    <div>
      <div className="mb-4 rounded-lg border border-[var(--editor-border)] bg-[var(--editor-background)] p-3">
        <input className="mb-2 w-full rounded-md border border-[var(--editor-border)] bg-[var(--input)] px-2 py-1.5 text-sm" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Scene title" />
        <textarea className="mb-2 min-h-16 w-full rounded-md border border-[var(--editor-border)] bg-[var(--input)] px-2 py-1.5 text-sm" value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="Scene summary" />
        <button className="w-full rounded-md bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-[var(--primary-foreground)]" onClick={() => void createScene()} type="button">Add scene card</button>
      </div>
      <div className="space-y-3">
        {scenes.map((scene) => (
          <details key={scene.id} className="rounded-lg border border-[var(--editor-border)] bg-[var(--editor-background)] p-3 text-sm">
            <summary className="cursor-pointer font-semibold">{scene.title}</summary>
            <textarea className="mt-3 min-h-20 w-full rounded-md border border-[var(--editor-border)] bg-[var(--input)] px-2 py-1.5" defaultValue={scene.summary} onBlur={(event) => void updateScene(scene, { summary: event.target.value })} placeholder="Summary" />
            <div className="mt-2 grid gap-2">
              {(["povCharacter", "location", "goal", "conflict", "outcome", "emotionalTone"] as const).map((field) => (
                <input key={field} className="rounded-md border border-[var(--editor-border)] bg-[var(--input)] px-2 py-1.5" defaultValue={String(scene[field] || "")} onBlur={(event) => void updateScene(scene, { [field]: event.target.value } as Partial<SceneItem>)} placeholder={field.replace(/([A-Z])/g, " $1").toLowerCase()} />
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="rounded-md border border-[var(--editor-border)] px-2 py-1 text-xs" onClick={() => onInsertBreak(scene.title)} type="button">Insert scene break</button>
              <button className="rounded-md border border-clay/40 px-2 py-1 text-xs text-clay" onClick={() => void deleteScene(scene)} type="button">Delete</button>
            </div>
          </details>
        ))}
        {!scenes.length ? <p className="rounded-lg border border-[var(--editor-border)] p-3 text-sm text-[var(--editor-muted)]">Plan this chapter as scenes with POV, goal, conflict, and outcome.</p> : null}
      </div>
    </div>
  );
}

function EntityPanel({ projectId, entities, candidates, setCandidates, onChanged }: { projectId: string; entities: EntityItem[]; candidates: EntityCandidate[]; setCandidates: (items: EntityCandidate[]) => void; onChanged: () => Promise<void> }) {
  async function detect() {
    const response = await fetch(`/api/projects/${projectId}/entities`, { method: "PUT" });
    const json = await response.json();
    setCandidates(json.candidates || []);
  }

  async function create(candidate: EntityCandidate, type = "CHARACTER") {
    await fetch(`/api/projects/${projectId}/entities`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: candidate.name, type, description: candidate.excerpts[0] || "" })
    });
    setCandidates(candidates.filter((item) => item.name !== candidate.name));
    await onChanged();
  }

  return (
    <div className="space-y-3">
      <button className="w-full rounded-md bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-[var(--primary-foreground)]" onClick={() => void detect()} type="button">Detect possible entities</button>
      {candidates.map((candidate) => (
        <div key={candidate.name} className="rounded-lg border border-[var(--editor-border)] bg-[var(--editor-background)] p-3 text-sm">
          <p className="font-semibold">{candidate.name}</p>
          <p className="text-xs text-[var(--editor-muted)]">{candidate.count} mentions</p>
          <p className="mt-1 text-xs text-[var(--editor-muted)]">{candidate.excerpts[0]}</p>
          <div className="mt-2 flex gap-2">
            <button className="rounded-md border border-[var(--editor-border)] px-2 py-1 text-xs" onClick={() => void create(candidate, "CHARACTER")} type="button">Character</button>
            <button className="rounded-md border border-[var(--editor-border)] px-2 py-1 text-xs" onClick={() => void create(candidate, "LOCATION")} type="button">Location</button>
            <button className="rounded-md border border-[var(--editor-border)] px-2 py-1 text-xs" onClick={() => void create(candidate, "UNKNOWN")} type="button">Other</button>
          </div>
        </div>
      ))}
      {entities.map((entity) => (
        <div key={entity.id} className="rounded-lg border border-[var(--editor-border)] bg-[var(--editor-background)] p-3 text-sm">
          <p className="font-semibold">{entity.name}</p>
          <p className="text-xs text-[var(--editor-muted)]">{entity.type.toLowerCase()} - {entity._count?.mentions || 0} mentions</p>
          {entity.description ? <p className="mt-2 text-xs text-[var(--editor-muted)]">{entity.description}</p> : null}
          {entity.aliases.length ? <p className="mt-2 text-xs text-[var(--editor-muted)]">Aliases: {entity.aliases.join(", ")}</p> : null}
        </div>
      ))}
      {!entities.length && !candidates.length ? <p className="rounded-lg border border-[var(--editor-border)] p-3 text-sm text-[var(--editor-muted)]">Detect recurring names to confirm characters, places, objects, and concepts.</p> : null}
    </div>
  );
}

function VersionRow({ version, currentText, onChanged }: { version: VersionItem; currentText: string; onChanged: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const delta = countWords(currentText) - version.wordCountSnapshot;
  const preview = version.plainTextSnapshot.replace(/\s+/g, " ").slice(0, 180);
  const currentWords = countWords(currentText);

  async function post(path: string) {
    const response = await fetch(path, { method: "POST" });
    const json = await response.json();
    if (json.href) window.location.href = json.href;
    if (json.documentId && json.projectId) window.location.href = `/projects/${json.projectId}/documents/${json.documentId}`;
    await onChanged();
  }

  return (
    <article className="mb-3 rounded-md border border-[var(--editor-border)] bg-[var(--editor-background)] p-3 text-sm text-[var(--editor-foreground)]">
      <button className="w-full text-left font-semibold" onClick={() => setOpen((value) => !value)} type="button">
        {version.label || new Date(version.createdAt).toLocaleString()}
      </button>
      <p className="text-xs text-[var(--editor-muted)]">
        {version.changeSummary || "Snapshot"} - {version.wordCountSnapshot} words - current delta {delta >= 0 ? "+" : ""}
        {delta}
      </p>
      <p className="mt-2 text-xs text-[var(--editor-muted)]">{preview || "(empty version)"}</p>
      {open ? (
        <div className="mt-3">
          <div className="mb-2 rounded border border-[var(--editor-border)] bg-[var(--muted)] p-2 text-xs">
            Diff summary: current draft has {currentWords.toLocaleString()} words; selected version has {version.wordCountSnapshot.toLocaleString()} words.
          </div>
          <pre className="max-h-44 overflow-auto whitespace-pre-wrap rounded border border-[var(--editor-border)] bg-[var(--muted)] p-2 text-xs text-[var(--editor-foreground)]">{version.plainTextSnapshot || "(empty)"}</pre>
          <div className="mt-2 flex gap-2">
            <button className="rounded-md border border-[var(--editor-border)] bg-[var(--editor-background)] px-2 py-1 text-xs" onClick={() => void post(`/api/document-versions/${version.id}/restore`)} type="button">Restore</button>
            <button className="rounded-md border border-[var(--editor-border)] bg-[var(--editor-background)] px-2 py-1 text-xs" onClick={() => void post(`/api/document-versions/${version.id}/duplicate`)} type="button">Duplicate</button>
          </div>
        </div>
      ) : null}
    </article>
  );
}

function UnresolvedLink({ link }: { link: LinkItem }) {
  async function create(targetType: "DOCUMENT" | "STORY_NOTE" | "RESEARCH_NOTE") {
    const response = await fetch(`/api/internal-links/${link.id}/create-target`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetType })
    });
    const json = await response.json();
    if (json.href) window.location.href = json.href;
  }

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      <button className="rounded-md border border-[var(--editor-border)] bg-[var(--editor-background)] px-2 py-1 text-xs text-[var(--editor-foreground)]" onClick={() => void create("DOCUMENT")} type="button">New document</button>
      <button className="rounded-md border border-[var(--editor-border)] bg-[var(--editor-background)] px-2 py-1 text-xs text-[var(--editor-foreground)]" onClick={() => void create("STORY_NOTE")} type="button">New story note</button>
      <button className="rounded-md border border-[var(--editor-border)] bg-[var(--editor-background)] px-2 py-1 text-xs text-[var(--editor-foreground)]" onClick={() => void create("RESEARCH_NOTE")} type="button">New research</button>
    </div>
  );
}

function collectHeadings(json: unknown) {
  const headings: string[] = [];
  function walk(node: unknown) {
    if (!node || typeof node !== "object") return;
    const item = node as { type?: string; content?: unknown[]; text?: string };
    if (item.type === "heading") {
      const text = (item.content || []).map((child) => (typeof child === "object" && child && "text" in child ? String((child as { text?: string }).text || "") : "")).join("");
      if (text) headings.push(text);
    }
    for (const child of item.content || []) walk(child);
  }
  walk(json);
  return headings;
}

function countWords(text: string) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

// TODO: Advanced spellcheck/grammar suggestions should layer into this editor without replacing browser spellcheck.
