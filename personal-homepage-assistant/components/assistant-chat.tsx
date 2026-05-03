"use client";

import { Bot, Check, Plus, Send, Trash2, X } from "lucide-react";
import { useState } from "react";

type PendingAction = {
  id: string;
  action: string;
  itemType: string;
  title: string;
  fields: Record<string, unknown>;
};

type Conversation = {
  id: string;
  title: string;
  useDashboardContext: boolean;
  messages: { id: string; role: string; content: string }[];
  pendingActions?: PendingAction[];
};

export function AssistantChat({ conversations }: { conversations: Conversation[] }) {
  const [items, setItems] = useState(conversations);
  const [currentId, setCurrentId] = useState(conversations[0]?.id ?? "");
  const [message, setMessage] = useState("");
  const [useContext, setUseContext] = useState(conversations[0]?.useDashboardContext ?? true);
  const [loading, setLoading] = useState(false);

  const current = items.find((item) => item.id === currentId);

  function upsertConversation(conversation: Conversation) {
    setItems((prev) => {
      const without = prev.filter((item) => item.id !== conversation.id);
      return [conversation, ...without];
    });
    setCurrentId(conversation.id);
  }

  async function send() {
    if (!message.trim() || loading) return;
    setLoading(true);
    const response = await fetch("/api/assistant/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId: currentId || null, message, useDashboardContext: useContext })
    });
    const data = await response.json();
    if (data.conversation) upsertConversation(data.conversation);
    setMessage("");
    setLoading(false);
  }

  async function resolveAction(id: string, mode: "confirm" | "cancel") {
    setLoading(true);
    const response = await fetch(`/api/assistant/actions/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id })
    });
    const data = await response.json();
    if (data.conversation) upsertConversation(data.conversation);
    setLoading(false);
  }

  async function deleteConversation(id: string) {
    if (!window.confirm("Delete this chat?")) return;
    setLoading(true);
    const response = await fetch("/api/assistant/conversations/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id })
    });
    const data = await response.json();
    if (data.deletedId) {
      setItems((prev) => prev.filter((item) => item.id !== data.deletedId));
      if (currentId === data.deletedId) setCurrentId("");
    }
    setLoading(false);
  }

  function startNew() {
    setCurrentId("");
    setMessage("");
  }

  return (
    <div className="grid h-[calc(100vh-11rem)] min-h-[620px] gap-4 overflow-hidden lg:grid-cols-[280px_1fr]">
      <aside className="card flex min-h-0 flex-col p-3">
        <button className="btn btn-primary mb-3 w-full" onClick={startNew}>
          <Plus size={16} />
          New chat
        </button>
        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
          {items.map((item) => (
            <div key={item.id} className={`group flex items-center gap-1 rounded-xl ${item.id === currentId ? "bg-ink text-white dark:bg-white dark:text-ink" : "hover:bg-ink/5 dark:hover:bg-white/10"}`}>
              <button className="min-w-0 flex-1 px-3 py-2 text-left text-sm font-semibold" onClick={() => {
                setCurrentId(item.id);
                setUseContext(item.useDashboardContext);
              }}>
                <span className="block truncate">{item.title}</span>
              </button>
              <button className="mr-1 grid size-8 place-items-center rounded-lg opacity-70 hover:bg-coral/15 hover:text-coral" onClick={() => void deleteConversation(item.id)} title="Delete chat" disabled={loading}>
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      </aside>
      <section className="card flex min-h-0 flex-col overflow-hidden p-0">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-ink/10 p-4 dark:border-white/10">
          <div className="flex min-w-0 items-center gap-2 font-bold">
            <Bot size={18} />
            <span className="truncate">{current?.title ?? "Fresh conversation"}</span>
          </div>
          <label className="flex shrink-0 items-center gap-2 text-sm font-semibold">
            <input className="accent-moss" type="checkbox" checked={useContext} onChange={(e) => setUseContext(e.target.checked)} />
            Use dashboard context
          </label>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overflow-x-hidden p-4">
          {(current?.messages ?? []).map((item) => (
            <div key={item.id} className={`max-w-3xl rounded-2xl px-4 py-3 ${item.role === "user" ? "ml-auto bg-ink text-white dark:bg-white dark:text-ink" : "bg-ink/5 dark:bg-white/10"}`}>
              <p className="whitespace-pre-wrap text-sm leading-6">{item.content}</p>
            </div>
          ))}
          {(current?.pendingActions ?? []).map((action) => (
            <div key={action.id} className="max-w-3xl rounded-2xl border border-moss/30 bg-moss/10 p-4 dark:bg-moss/15">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="badge">Pending action</span>
                <strong>{action.action.replaceAll("_", " ")}</strong>
              </div>
              <dl className="grid gap-2 text-sm">
                <div>
                  <dt className="label">Item type</dt>
                  <dd>{action.itemType.replaceAll("_", " ")}</dd>
                </div>
                <div>
                  <dt className="label">Title/name</dt>
                  <dd className="font-semibold">{action.title}</dd>
                </div>
                <div>
                  <dt className="label">Fields detected</dt>
                  <dd className="mt-1 grid gap-1">
                    {Object.entries(action.fields ?? {})
                      .filter(([, value]) => value !== null && value !== undefined && value !== "")
                      .map(([key, value]) => (
                        <span key={key} className="rounded-lg bg-white/60 px-2 py-1 dark:bg-white/10">{key}: {String(value)}</span>
                      ))}
                  </dd>
                </div>
              </dl>
              <div className="mt-4 flex flex-wrap gap-2">
                <button className="btn btn-primary" onClick={() => void resolveAction(action.id, "confirm")} disabled={loading}>
                  <Check size={16} />
                  Confirm {action.itemType.replaceAll("_", " ")}
                </button>
                <button className="btn btn-soft" onClick={() => void resolveAction(action.id, "cancel")} disabled={loading}>
                  <X size={16} />
                  Cancel
                </button>
              </div>
            </div>
          ))}
          {!current && <p className="text-ink/55 dark:text-white/55">Ask about your projects, notes, links, calendar, tasks, and channels. I will cite item names when I use your private context.</p>}
        </div>
        <div className="shrink-0 border-t border-ink/10 bg-white/70 p-4 backdrop-blur dark:border-white/10 dark:bg-ink/60">
          <div className="flex gap-2">
            <textarea className="field min-h-12 flex-1 resize-none" value={message} placeholder="Add a task to make a YouTube short for Gravedad Lenta this weekend." onChange={(e) => setMessage(e.target.value)} onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }} />
            <button className="btn btn-primary self-end" onClick={send} disabled={loading}>
              <Send size={16} />
              {loading ? "Thinking" : "Send"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
