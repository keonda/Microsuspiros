"use client";

import { Bot, Check, Plus, Send, X } from "lucide-react";
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

  function startNew() {
    setCurrentId("");
    setMessage("");
  }

  return (
    <div className="grid min-h-[72vh] gap-4 lg:grid-cols-[280px_1fr]">
      <aside className="card p-3">
        <button className="btn btn-primary mb-3 w-full" onClick={startNew}>
          <Plus size={16} />
          New chat
        </button>
        <div className="space-y-1">
          {items.map((item) => (
            <button key={item.id} className={`w-full rounded-xl px-3 py-2 text-left text-sm font-semibold ${item.id === currentId ? "bg-ink text-white dark:bg-white dark:text-ink" : "hover:bg-ink/5 dark:hover:bg-white/10"}`} onClick={() => {
              setCurrentId(item.id);
              setUseContext(item.useDashboardContext);
            }}>
              {item.title}
            </button>
          ))}
        </div>
      </aside>
      <section className="card flex min-h-[72vh] flex-col p-0">
        <div className="flex items-center justify-between border-b border-ink/10 p-4 dark:border-white/10">
          <div className="flex items-center gap-2 font-bold">
            <Bot size={18} />
            {current?.title ?? "Fresh conversation"}
          </div>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input className="accent-moss" type="checkbox" checked={useContext} onChange={(e) => setUseContext(e.target.checked)} />
            Use dashboard context
          </label>
        </div>
        <div className="flex-1 space-y-3 overflow-auto p-4">
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
        <div className="border-t border-ink/10 p-4 dark:border-white/10">
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
