import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Moon, Sun, Send, Shield, LogOut, Sparkles } from "lucide-react";
import "./styles.css";

type User = { id: string; email: string; displayName: string; isAdmin: boolean };
type GameState = {
  character: { id: string; name: string; level: number; hp: number; maxHp: number; attack: number; defense: number };
  room: {
    id: string;
    name: string;
    description: string;
    biome: string;
    mood: string;
    dangerLevel: number;
    exitsFrom: Array<{ direction: string; description: string; toRoom: { name: string } }>;
    items: Array<{ id: string; quantity: number; item: Entity }>;
    monsters: Array<{ id: string; currentHp: number; monster: Entity & { level: number } }>;
    npcs: Array<{ id: string; npc: Entity }>;
    events: Array<{ id: string; title: string; description: string }>;
  } | null;
  inventory: Array<{ id: string; quantity: number; item: Entity }>;
};
type Entity = { id: string; name: string; description: string };
type LogLine = { id: number; text: string; kind?: "system" | "tick" | "command" };

async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers ?? {}) }
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? "Request failed");
  }
  return response.json();
}

function AuthPanel({ onAuth }: { onAuth: (user: User) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const data = await api<{ user: User }>(`/api/auth/${mode}`, {
        method: "POST",
        body: JSON.stringify({ email, password, displayName })
      });
      onAuth(data.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to authenticate");
    }
  }

  return (
    <main className="min-h-screen bg-stone-950 text-stone-100 grid place-items-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm border border-amber-700/40 bg-stone-900 p-6 shadow-2xl">
        <h1 className="text-2xl font-mono text-amber-200">Breathing World MUD</h1>
        <p className="mt-2 text-sm text-stone-400">A persistent, AI-assisted text world that grows slowly as you explore.</p>
        <div className="mt-6 grid gap-3">
          <input className="field" placeholder="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          {mode === "register" && (
            <input className="field" placeholder="display name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
          )}
          <input className="field" placeholder="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </div>
        {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
        <button className="mt-5 w-full bg-amber-300 px-4 py-2 font-semibold text-stone-950 hover:bg-amber-200">{mode === "login" ? "Login" : "Register"}</button>
        <button type="button" className="mt-3 text-sm text-amber-200" onClick={() => setMode(mode === "login" ? "register" : "login")}>
          {mode === "login" ? "Create an account" : "Back to login"}
        </button>
      </form>
    </main>
  );
}

function Sidebar({ state, send }: { state: GameState | null; send: (command: string) => void }) {
  if (!state?.room) return <aside className="panel">No character yet.</aside>;
  const { character, room, inventory } = state;
  return (
    <aside className="panel w-full xl:w-80">
      <h2 className="section-title">{character.name}</h2>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <Stat label="HP" value={`${character.hp}/${character.maxHp}`} />
        <Stat label="Level" value={character.level} />
        <Stat label="Attack" value={character.attack} />
        <Stat label="Defense" value={character.defense} />
      </div>
      <h2 className="section-title mt-5">Location</h2>
      <p className="font-mono text-amber-200">{room.name}</p>
      <p className="text-xs text-stone-400">{room.biome} · {room.mood} · danger {room.dangerLevel}</p>
      <h2 className="section-title mt-5">Exits</h2>
      <div className="flex flex-wrap gap-2">
        {room.exitsFrom.map((exit) => (
          <button key={exit.direction} className="chip" onClick={() => send(exit.direction)} title={exit.description}>
            {exit.direction}
          </button>
        ))}
      </div>
      <h2 className="section-title mt-5">Inventory</h2>
      <List items={inventory.map((entry) => ({ id: entry.id, label: `${entry.item.name} x${entry.quantity}`, command: `examine ${entry.item.name}` }))} send={send} empty="Empty" />
      <h2 className="section-title mt-5">Here</h2>
      <List items={[
        ...room.items.map((entry) => ({ id: entry.id, label: `${entry.item.name} x${entry.quantity}`, command: `take ${entry.item.name}` })),
        ...room.monsters.map((entry) => ({ id: entry.id, label: `${entry.monster.name} (${entry.currentHp} HP)`, command: `attack ${entry.monster.name}` })),
        ...room.npcs.map((entry) => ({ id: entry.id, label: entry.npc.name, command: `talk to ${entry.npc.name}` }))
      ]} send={send} empty="Nothing obvious" />
    </aside>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="border border-stone-700 bg-stone-950/50 p-2"><div className="text-xs text-stone-500">{label}</div><div className="font-mono text-amber-100">{value}</div></div>;
}

function List({ items, send, empty }: { items: Array<{ id: string; label: string; command: string }>; send: (command: string) => void; empty: string }) {
  if (!items.length) return <p className="text-sm text-stone-500">{empty}</p>;
  return <div className="grid gap-1">{items.map((item) => <button key={item.id} className="list-button" onClick={() => send(item.command)}>{item.label}</button>)}</div>;
}

function Game({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [state, setState] = useState<GameState | null>(null);
  const [log, setLog] = useState<LogLine[]>([]);
  const [command, setCommand] = useState("");
  const [busy, setBusy] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [adminOpen, setAdminOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);

  const addLog = (lines: string[], kind?: LogLine["kind"]) => {
    setLog((current) => [...current, ...lines.map((text) => ({ id: nextId.current++, text, kind }))].slice(-150));
  };

  useEffect(() => {
    api<GameState>("/api/game/state").then((data) => {
      setState(data);
      if (data.room) addLog([`You stand in ${data.room.name}.`, data.room.description], "system");
    });
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [log]);

  async function send(input: string) {
    const value = input.trim();
    if (!value || busy) return;
    setBusy(true);
    addLog([`> ${value}`], "command");
    setCommand("");
    try {
      const data = await api<{ lines: string[]; tick: string | null; state: GameState }>("/api/game/command", {
        method: "POST",
        body: JSON.stringify({ command: value })
      });
      addLog(data.lines);
      if (data.tick) addLog([data.tick], "tick");
      setState(data.state);
    } catch (error) {
      addLog([error instanceof Error ? error.message : "Command failed"], "system");
    } finally {
      setBusy(false);
    }
  }

  const recentEvents = useMemo(() => state?.room?.events ?? [], [state]);

  return (
    <div className={theme}>
      <main className="min-h-screen bg-stone-100 text-stone-900 dark:bg-stone-950 dark:text-stone-100">
        <header className="flex items-center justify-between border-b border-stone-300 bg-stone-200 px-4 py-3 dark:border-stone-800 dark:bg-stone-900">
          <div>
            <h1 className="font-mono text-lg text-amber-700 dark:text-amber-200">Breathing World MUD</h1>
            <p className="text-xs text-stone-500">Logged in as {user.displayName}</p>
          </div>
          <div className="flex gap-2">
            {user.isAdmin && <button className="icon-button" onClick={() => setAdminOpen(!adminOpen)} title="Admin"><Shield size={18} /></button>}
            <button className="icon-button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} title="Toggle theme">{theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}</button>
            <button className="icon-button" onClick={onLogout} title="Logout"><LogOut size={18} /></button>
          </div>
        </header>
        {adminOpen ? <AdminPanel /> : null}
        <div className="grid gap-4 p-4 xl:grid-cols-[1fr_20rem]">
          <section className="panel flex min-h-[72vh] flex-col">
            <div ref={scrollRef} className="story-log flex-1 overflow-y-auto pr-2">
              {log.map((line) => <p key={line.id} className={line.kind === "command" ? "text-emerald-300" : line.kind === "tick" ? "text-cyan-300 italic" : ""}>{line.text}</p>)}
              {busy && <p className="flex items-center gap-2 text-cyan-300"><Sparkles size={14} /> world listens...</p>}
            </div>
            <form className="mt-4 flex gap-2" onSubmit={(event) => { event.preventDefault(); send(command); }}>
              <input className="command-input" value={command} onChange={(event) => setCommand(event.target.value)} placeholder="type a command..." />
              <button className="send-button" disabled={busy} title="Send"><Send size={18} /></button>
            </form>
            {recentEvents.length > 0 && <details className="mt-3 text-sm text-stone-500"><summary>World info</summary>{recentEvents.map((event) => <p key={event.id}>{event.title}: {event.description}</p>)}</details>}
          </section>
          <Sidebar state={state} send={send} />
        </div>
      </main>
    </div>
  );
}

function AdminPanel() {
  const [settings, setSettings] = useState<Record<string, unknown> | null>(null);
  const [tab, setTab] = useState("rooms");
  const [rows, setRows] = useState<unknown[]>([]);
  const [context, setContext] = useState("The Candle Gate");

  useEffect(() => {
    api<Record<string, unknown>>("/api/admin/settings").then(setSettings);
  }, []);
  useEffect(() => {
    const path = tab === "logs" ? "/api/admin/ai-logs" : tab === "users" ? "/api/admin/users" : `/api/admin/world/${tab}`;
    api<unknown[]>(path).then(setRows);
  }, [tab]);

  async function saveSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const data = await api<Record<string, unknown>>("/api/admin/settings", {
      method: "PUT",
      body: JSON.stringify({
        groqApiKey: form.get("groqApiKey") || undefined,
        groqModelName: form.get("groqModelName"),
        aiCreativity: Number(form.get("aiCreativity")),
        maxTokens: Number(form.get("maxTokens")),
        worldGenerationEnabled: form.get("worldGenerationEnabled") === "on",
        safetyEnabled: form.get("safetyEnabled") === "on"
      })
    });
    setSettings(data);
  }

  async function generate(type: string) {
    await api(`/api/admin/generate/${type}`, { method: "POST", body: JSON.stringify({ context }) });
    setTab(type === "lore" ? "lore" : `${type}s`);
  }

  return (
    <section className="border-b border-stone-800 bg-stone-900 p-4">
      <div className="grid gap-4 xl:grid-cols-[22rem_1fr]">
        <form onSubmit={saveSettings} className="grid gap-2">
          <h2 className="section-title">Settings</h2>
          <input name="groqApiKey" className="field" placeholder={settings?.groqApiKeySet ? "Groq key is stored" : "Groq API key"} />
          <input name="groqModelName" className="field" defaultValue={String(settings?.groqModelName ?? "llama-3.1-8b-instant")} />
          <input name="aiCreativity" type="number" step="0.1" min="0" max="2" className="field" defaultValue={Number(settings?.aiCreativity ?? 0.7)} />
          <input name="maxTokens" type="number" min="100" max="2000" className="field" defaultValue={Number(settings?.maxTokens ?? 500)} />
          <label className="text-sm"><input name="worldGenerationEnabled" type="checkbox" defaultChecked={Boolean(settings?.worldGenerationEnabled ?? true)} /> world generation</label>
          <label className="text-sm"><input name="safetyEnabled" type="checkbox" defaultChecked={Boolean(settings?.safetyEnabled ?? true)} /> safety limits</label>
          <button className="send-button">Save</button>
        </form>
        <div>
          <div className="flex flex-wrap gap-2">
            {["users", "rooms", "monsters", "items", "npcs", "lore", "logs"].map((name) => <button key={name} className="chip" onClick={() => setTab(name)}>{name}</button>)}
          </div>
          <div className="mt-3 flex gap-2">
            <input className="field max-w-sm" value={context} onChange={(event) => setContext(event.target.value)} />
            {["monster", "item", "npc", "lore"].map((type) => <button key={type} className="chip" onClick={() => generate(type)}>Generate {type}</button>)}
          </div>
          <pre className="mt-3 max-h-80 overflow-auto border border-stone-700 bg-stone-950 p-3 text-xs">{JSON.stringify(rows, null, 2)}</pre>
        </div>
      </div>
    </section>
  );
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    api<{ user: User }>("/api/auth/me").then((data) => setUser(data.user)).catch(() => null).finally(() => setChecked(true));
  }, []);
  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    setUser(null);
  }
  if (!checked) return <main className="min-h-screen bg-stone-950 text-amber-200 grid place-items-center font-mono">Loading...</main>;
  return user ? <Game user={user} onLogout={logout} /> : <AuthPanel onAuth={setUser} />;
}

createRoot(document.getElementById("root")!).render(<App />);
