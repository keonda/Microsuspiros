"use client";

import { Bot, Plus, Send } from "lucide-react";
import { useState } from "react";

type Conversation = {
  id: string;
  title: string;
  useDashboardContext: boolean;
  messages: { id: string; role: string; content: string }[];
};

export function AssistantChat({ conversations }: { conversations: Conversation[] }) {
  const [items, setItems] = useState(conversations);
  const [currentId, setCurrentId] = useState(conversations[0]?.id ?? "");
  const [message, setMessage] = useState("");
  const [useContext, setUseContext] = useState(conversations[0]?.useDashboardContext ?? true);
  const [loading, setLoading] = useState(false);

  const current = items.find((item) => item.id === currentId);

  async function send() {
    if (!message.trim() || loading) return;
    setLoading(true);
    const response = await fetch("/api/assistant/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId: currentId || null, message, useDashboardContext: useContext })
    });
    const data = await response.json();
    if (data.conversation) {
      setItems((prev) => {
        const without = prev.filter((item) => item.id !== data.conversation.id);
        return [data.conversation, ...without];
      });
      setCurrentId(data.conversation.id);
    }
    setMessage("");
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
          {!current && <p className="text-ink/55 dark:text-white/55">Ask about your projects, notes, links, calendar, tasks, and channels. I’ll cite item names when I use your private context.</p>}
        </div>
        <div className="border-t border-ink/10 p-4 dark:border-white/10">
          <div className="flex gap-2">
            <textarea className="field min-h-12 flex-1 resize-none" value={message} placeholder="What should I work on today?" onChange={(e) => setMessage(e.target.value)} onKeyDown={(e) => {
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
