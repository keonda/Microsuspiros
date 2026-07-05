"use client";

import * as LucideIcons from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type {
  CapturedEntry,
  ChecklistItem,
  ExpirationBatch,
  FloorRun,
  InventoryItem,
  ItemCategory,
  NavKey,
  OcrCleanupResult,
  Reminder,
  ReportedItem,
  ShiftState,
  Suggestion,
  Unit,
  WasteObservation,
} from "@/types/shift";
import {
  createDefaultState,
  duplicateCandidates,
  getReadiness,
  getReadinessLabel,
  makeSummary,
  smartPromptFor,
} from "@/lib/shift-logic";
import { OfflineStore, SyncStatus } from "@/lib/offline-store";
import { mergeShiftSnapshots } from "@/lib/sync-merge";
import { applyCapturedEntry, confirmCapturedEntry, createCapturedEntry, deleteCapturedEntry, dismissCapturedEntry, shouldShowSyncProblem } from "@/lib/capture";
import {
  applySuggestion,
  cleanOcrWithRules,
  detectWasteHeavyItems,
  predictShortagesWithRules,
  suggestChecklistWithRules,
  suggestRemindersWithRules,
  weeklyInsightsWithRules,
} from "@/lib/ai/rules";

const {
  Bell,
  BookOpen,
  CheckSquare,
  ClipboardCheck,
  Coffee,
  Copy,
  Home,
  History,
  Inbox,
  LineChart,
  Lightbulb,
  PackageCheck,
  Plus,
  ScanLine,
  Settings,
  ShoppingBasket,
  Timer,
  Trash2,
  TriangleAlert,
} = LucideIcons as unknown as Record<string, React.ComponentType<{ size?: number; className?: string }>>;

const nav: Array<{ key: NavKey; label: string; icon: React.ComponentType<{ size?: number }> }> = [
  { key: "today", label: "Today", icon: Home },
  { key: "notebook", label: "Notebook", icon: BookOpen },
  { key: "checklist", label: "Checklist", icon: CheckSquare },
  { key: "inbox", label: "Inbox", icon: Inbox },
  { key: "history", label: "History", icon: History },
  { key: "settings", label: "Settings", icon: Settings },
];

const store = new OfflineStore("shift-companion-state");

export default function ShiftCompanion() {
  const [authChecked, setAuthChecked] = useState(false);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [active, setActive] = useState<NavKey>("today");
  const [state, setState] = useState<ShiftState>(() => createDefaultState());
  const [sync, setSync] = useState<SyncStatus>("Saved locally");
  const [syncing, setSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [copyNote, setCopyNote] = useState("");
  const [now, setNow] = useState(new Date());
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setSessionEmail(localStorage.getItem("shift-companion-session"));
    setAuthChecked(true);
    store.load().then((saved) => {
      if (saved) setState(normalizeState(saved));
    });
    navigator.serviceWorker?.register("/sw.js").catch(() => undefined);
    setOnline(navigator.onLine);
    const markOnline = () => setOnline(true);
    const markOffline = () => setOnline(false);
    window.addEventListener("online", markOnline);
    window.addEventListener("offline", markOffline);
    const tick = window.setInterval(() => setNow(new Date()), 60_000);
    return () => {
      window.removeEventListener("online", markOnline);
      window.removeEventListener("offline", markOffline);
      window.clearInterval(tick);
    };
  }, []);

  function update(mutator: (draft: ShiftState) => ShiftState, action = "update") {
    setState((current) => {
      const next = mutator({ ...current, updatedAt: new Date().toISOString() });
      store.save(next, action).then(() => {
        setSync(online ? "Sync pending" : "Saved locally");
      });
      return next;
    });
  }

  useEffect(() => {
    if (sync !== "Sync pending" || syncing || !online) return;
    const timeout = window.setTimeout(() => {
      syncNow();
    }, 1000);
    return () => window.clearTimeout(timeout);
  }, [sync, syncing, online]);

  async function syncNow() {
    if (!online) {
      setSync("Saved locally");
      return;
    }
    setSyncing(true);
    const pending = await store.pending();
    try {
      setSync(pending.length ? "Sync pending" : "Synced");
      if (pending.length) {
        const pushResponse = await fetch("/api/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ events: pending }),
        });
        if (!pushResponse.ok) throw new Error("Sync push failed");
        await store.clearPending(pending.map((event) => event.id));
      }

      const pullResponse = await fetch("/api/sync", { method: "GET" });
      if (!pullResponse.ok) throw new Error("Sync pull failed");
      const pullData = await pullResponse.json();
      if (pullData.snapshot) {
        const remoteState = mergeShiftSnapshots(state, normalizeState(pullData.snapshot));
        setState(remoteState);
        await store.save(remoteState, "sync-pull", { enqueue: false });
        await store.clearPending((await store.pending()).map((event) => event.id));
      }
      setSync("Synced");
      setLastSyncedAt(new Date().toISOString());
    } catch {
      setSync("Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  async function copy(text: string) {
    await navigator.clipboard?.writeText(text);
    setCopyNote("Copied");
    window.setTimeout(() => setCopyNote(""), 1200);
  }

  const readiness = getReadiness(state.checklist);
  const prompt = smartPromptFor(state, now);

  if (!authChecked) {
    return <main className="min-h-screen bg-mist" />;
  }

  if (!sessionEmail) {
    return <LoginView onLogin={setSessionEmail} />;
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col pb-24 md:pb-4">
      <header className="sticky top-0 z-20 border-b border-black/5 bg-mist/95 px-4 py-3 backdrop-blur md:static">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-leaf">Shift Companion</p>
            <h1 className="text-2xl font-black text-ink">Breakroom shift</h1>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {shouldShowSyncProblem(sync, online) && (
              <button
                onClick={syncNow}
                disabled={syncing}
                className="tap rounded-full bg-tomato px-3 py-2 text-xs font-black text-white shadow-soft disabled:opacity-60"
              >
                {!online ? "Offline" : syncing ? "Retrying" : "Sync failed"}
              </button>
            )}
            <button
              onClick={() => {
                localStorage.removeItem("shift-companion-session");
                setSessionEmail(null);
              }}
              className="tap rounded-full bg-white px-3 py-2 text-xs font-black text-ink/70 shadow-soft"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <section className="grid gap-4 p-4 md:grid-cols-[210px_1fr]">
        <aside className="hidden md:block">
          <Nav active={active} setActive={setActive} />
        </aside>
        <div>
          {active === "today" && (
            <TodayView
              state={state}
              readiness={readiness}
              prompt={prompt}
              copyNote={copyNote}
              onCopy={copy}
              onUpdate={update}
              openPanic={() => setActive("history")}
            />
          )}
          {active === "notebook" && <NotebookView state={state} onUpdate={update} />}
          {active === "checklist" && <ChecklistEditor state={state} onUpdate={update} />}
          {active === "inbox" && <InboxView state={state} onUpdate={update} />}
          {active === "history" && <HistoryView state={state} onUpdate={update} onCopy={copy} copyNote={copyNote} />}
          {active === "settings" && <SettingsView state={state} onUpdate={update} />}
        </div>
      </section>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-black/10 bg-white md:hidden">
        <div className="flex overflow-x-auto px-1">
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                onClick={() => setActive(item.key)}
                className={`tap flex min-w-[74px] flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] font-bold ${
                  active === item.key ? "text-leaf" : "text-ink/55"
                }`}
              >
                <Icon size={28} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </main>
  );
}

function normalizeState(saved: ShiftState): ShiftState {
  const defaults = createDefaultState();
  return {
    ...defaults,
    ...saved,
    needNow: saved.needNow ?? [],
    capturedEntries: (saved.capturedEntries ?? []).map((entry) => ({ ...entry, deleted: entry.deleted ?? false })),
    suggestionDismissals: saved.suggestionDismissals ?? [],
    predictions: saved.predictions ?? [],
    insights: saved.insights,
    settings: {
      ...defaults.settings,
      ...(saved.settings ?? {}),
      attendantName: saved.settings?.attendantName ?? defaults.settings.attendantName,
      buildingName: saved.settings?.buildingName ?? defaults.settings.buildingName,
      attendantEmail: saved.settings?.attendantEmail ?? defaults.settings.attendantEmail,
      amFloors: saved.settings?.amFloors ?? defaults.settings.amFloors,
      pmFloors: saved.settings?.pmFloors ?? defaults.settings.pmFloors,
    },
  };
}

function LoginView({ onLogin }: { onLogin: (email: string) => void }) {
  const [email, setEmail] = useState("attendant@example.com");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) throw new Error("Login failed");
      localStorage.setItem("shift-companion-session", email);
      onLogin(email);
    } catch {
      setError("Email or password did not match.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto grid min-h-screen w-full max-w-md content-center gap-4 p-4">
      <section className="rounded-lg bg-white p-5 shadow-soft">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-lg bg-leaf text-white">
            <Coffee size={26} />
          </div>
          <div>
            <p className="text-xs font-black uppercase text-leaf">Shift Companion</p>
            <h1 className="text-2xl font-black">Sign in</h1>
          </div>
        </div>
        <form onSubmit={submit} className="mt-5 grid gap-3">
          <label className="grid gap-1 text-sm font-black">
            Email
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              autoComplete="email"
              className="rounded-lg border border-black/10 px-3 py-3 text-base font-normal"
              required
            />
          </label>
          <label className="grid gap-1 text-sm font-black">
            Password
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              autoComplete="current-password"
              className="rounded-lg border border-black/10 px-3 py-3 text-base font-normal"
              required
            />
          </label>
          {error && <p className="rounded-lg bg-tomato/10 px-3 py-2 text-sm font-bold text-tomato">{error}</p>}
          <PillButton disabled={loading} className="bg-leaf py-3 text-white disabled:opacity-60">
            {loading ? "Signing in" : "Sign in"}
          </PillButton>
        </form>
      </section>
    </main>
  );
}

function Nav({ active, setActive }: { active: NavKey; setActive: (key: NavKey) => void }) {
  return (
    <div className="sticky top-4 grid gap-2">
      {nav.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.key}
            onClick={() => setActive(item.key)}
            className={`tap flex items-center gap-3 rounded-lg px-3 py-4 text-left text-sm font-bold ${
              active === item.key ? "bg-leaf text-white" : "bg-white text-ink shadow-soft"
            }`}
          >
            <Icon size={22} /> {item.label}
          </button>
        );
      })}
    </div>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const hasCustomBackground = /\bbg-/.test(className);
  return <section className={`rounded-lg ${hasCustomBackground ? "" : "bg-white"} p-4 shadow-soft ${className}`}>{children}</section>;
}

function PillButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`tap rounded-lg px-3 py-2 text-sm font-black transition active:scale-[0.98] ${
        props.className ?? "bg-ink text-white"
      }`}
    />
  );
}

function TodayView({
  state,
  prompt,
  onUpdate,
}: {
  state: ShiftState;
  readiness: number;
  prompt: ReturnType<typeof smartPromptFor>;
  copyNote: string;
  onCopy: (text: string) => void;
  onUpdate: (mutator: (draft: ShiftState) => ShiftState, action?: string) => void;
  openPanic: () => void;
}) {
  const [text, setText] = useState("");
  const unfinishedChecklist = state.checklist.filter((item) => !item.done);
  const inboxCount = state.capturedEntries.filter((entry) => !entry.deleted && !entry.confirmed && !entry.dismissed).length;
  const activeNeeds = state.needNow.filter((item) => !item.done).length + state.items.filter((item) => item.status === "missing" || item.status === "running low" || item.status === "reported").length;
  const probablyNext = useMemo(() => predictShortagesWithRules(state, new Date())[0], [state]);
  const nextChecklist = unfinishedChecklist.find((item) => /coffee|cup|milk/i.test(item.title)) ?? unfinishedChecklist[0];

  function capture() {
    if (!text.trim()) return;
    const entry = createCapturedEntry(text);
    onUpdate((draft) => applyCapturedEntry(draft, entry), "capture-entry");
    setText("");
  }

  function quickCapture(value: string) {
    const entry = createCapturedEntry(value);
    onUpdate((draft) => applyCapturedEntry(draft, entry), "capture-entry");
  }

  return (
    <div className="grid gap-4">
      <Card className="bg-leaf text-white">
        <p className="text-xs font-black uppercase opacity-80">{state.settings.buildingName || "Breakroom"} • {new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</p>
        <div className="mt-1 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-3xl font-black">{state.settings.attendantName ? `${state.settings.attendantName}'s shift` : "Today's shift"}</h2>
            <p className="mt-1 text-sm font-bold opacity-90">{unfinishedChecklist.length + activeNeeds + inboxCount} things left</p>
          </div>
          <Coffee size={34} />
        </div>
      </Card>

      <Card>
        <label className="text-xs font-black uppercase text-leaf">What happened?</label>
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Floor 6 almost out of coffee"
          className="mt-2 min-h-36 w-full resize-none rounded-lg border border-black/10 px-4 py-4 text-lg font-bold outline-none focus:ring-2 focus:ring-leaf/40"
        />
        <div className="mt-3 grid grid-cols-3 gap-2">
          <PillButton onClick={() => undefined} className="bg-skycap text-ink">Type</PillButton>
          <PillButton onClick={() => quickCapture("Voice note: ")} className="bg-skycap text-ink">Speak</PillButton>
          <PillButton onClick={() => quickCapture("Photo note captured")} className="bg-skycap text-ink">Photo</PillButton>
        </div>
        <PillButton onClick={capture} className="mt-3 w-full bg-ink py-4 text-lg text-white">Capture</PillButton>
      </Card>

      {nextChecklist && (
        <Card>
          <p className="text-xs font-black uppercase text-leaf">Opening</p>
          <h3 className="mt-1 text-xl font-black">{unfinishedChecklist.length} things left</h3>
          <div className="mt-3 grid gap-2">
            {state.checklist.slice(0, 4).map((item) => (
              <button
                key={item.id}
                onClick={() => onUpdate((draft) => ({ ...draft, checklist: draft.checklist.map((entry) => entry.id === item.id ? { ...entry, done: !entry.done } : entry) }), "checklist-toggle")}
                className={`tap rounded-lg px-3 py-3 text-left text-sm font-black ${item.done ? "bg-leaf text-white" : "bg-mist text-ink"}`}
              >
                {item.done ? "?" : "?"} {item.title}
              </button>
            ))}
          </div>
        </Card>
      )}

      {state.settings.smartShiftEnabled && prompt && (
        <Card className="border border-honey">
          <p className="text-xs font-black uppercase text-leaf">One quick win</p>
          <h3 className="mt-1 text-lg font-black">{nextChecklist ? `${nextChecklist.title}. 15 seconds.` : prompt.text}</h3>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <PillButton
              onClick={() => nextChecklist && onUpdate((draft) => ({ ...draft, checklist: draft.checklist.map((item) => item.id === nextChecklist.id ? { ...item, done: true } : item) }), "quick-win")}
              className="bg-leaf text-white"
            >
              Do it
            </PillButton>
            <PillButton onClick={() => onUpdate((draft) => ({ ...draft, smartPromptSkips: [...draft.smartPromptSkips, prompt.id] }), "smart-prompt-skip")} className="bg-skycap text-ink">Skip</PillButton>
          </div>
        </Card>
      )}

      {probablyNext && (
        <Card>
          <p className="text-xs font-black uppercase text-leaf">Probably next</p>
          <h3 className="mt-1 text-xl font-black">{probablyNext.itemName}{probablyNext.location ? ` — ${probablyNext.location}` : ""}</h3>
          <p className="mt-1 text-sm font-bold text-ink/60">{probablyNext.reason}</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <PillButton onClick={() => quickCapture(probablyNext.message)} className="bg-leaf text-white">Start</PillButton>
            <PillButton onClick={() => quickCapture(`Done: ${probablyNext.itemName}`)} className="bg-skycap text-ink">Done</PillButton>
            <PillButton onClick={() => undefined} className="bg-white text-ink ring-1 ring-black/10">Skip</PillButton>
          </div>
        </Card>
      )}
    </div>
  );
}
function SummaryCard({ title, count, items }: { title: string; count: number; items: string[] }) {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <h3 className="font-black">{title}</h3>
        <span className="rounded-full bg-mist px-3 py-1 text-sm font-black">{count}</span>
      </div>
      <ul className="mt-3 grid gap-2 text-sm">
        {(items.length ? items : ["Nothing right now"]).slice(0, 4).map((item) => (
          <li key={item} className="rounded-md bg-mist px-3 py-2 font-bold text-ink/75">{item}</li>
        ))}
      </ul>
    </Card>
  );
}

function NotebookView({ state, onUpdate }: { state: ShiftState; onUpdate: (mutator: (draft: ShiftState) => ShiftState, action?: string) => void }) {
  const [editingId, setEditingId] = useState("");
  const [editText, setEditText] = useState("");
  const entries = state.capturedEntries.filter((entry) => !entry.deleted).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

  function startEdit(entry: CapturedEntry) {
    setEditingId(entry.id);
    setEditText(entry.rawText);
  }

  return (
    <div className="grid gap-4">
      <Card className="bg-leaf text-white">
        <h2 className="text-3xl font-black">Notebook</h2>
        <p className="mt-1 font-bold opacity-90">A running note for this shift.</p>
      </Card>
      {entries.length ? entries.map((entry) => (
        <Card key={entry.id}>
          <p className="text-xs font-black uppercase text-leaf">{new Date(entry.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</p>
          {editingId === entry.id ? (
            <div className="mt-2 grid gap-2">
              <textarea value={editText} onChange={(event) => setEditText(event.target.value)} className="min-h-24 rounded-lg border border-black/10 px-3 py-3 font-bold" />
              <PillButton
                onClick={() => {
                  onUpdate((draft) => ({
                    ...draft,
                    capturedEntries: draft.capturedEntries.map((item) => item.id === entry.id ? { ...item, rawText: editText, updatedAt: new Date().toISOString() } : item),
                  }), "notebook-edit");
                  setEditingId("");
                }}
                className="bg-leaf text-white"
              >
                Save
              </PillButton>
            </div>
          ) : (
            <>
              <p className="mt-2 text-lg font-bold">{entry.rawText}</p>
              <p className="mt-2 text-xs font-bold text-ink/55">{entry.inferredTypes.join(", ")}{entry.location ? ` • ${entry.location}` : ""}</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <PillButton onClick={() => startEdit(entry)} className="bg-skycap text-ink">Edit</PillButton>
                <PillButton onClick={() => onUpdate((draft) => deleteCapturedEntry(draft, entry.id), "notebook-delete")} className="bg-white text-tomato ring-1 ring-tomato/30">Delete</PillButton>
              </div>
            </>
          )}
        </Card>
      )) : (
        <Card><h3 className="font-black">No notes yet</h3><p className="mt-1 text-sm font-bold text-ink/60">Capture something from Today and it will show here.</p></Card>
      )}
    </div>
  );
}

function InboxView({ state, onUpdate }: { state: ShiftState; onUpdate: (mutator: (draft: ShiftState) => ShiftState, action?: string) => void }) {
  const items = state.capturedEntries.filter((entry) => !entry.deleted && !entry.confirmed && !entry.dismissed);
  return (
    <div className="grid gap-4">
      <Card className="bg-leaf text-white">
        <h2 className="text-3xl font-black">Inbox</h2>
        <p className="mt-1 font-bold opacity-90">Confirm what the app organized.</p>
      </Card>
      {items.length ? items.map((entry) => (
        <Card key={entry.id}>
          <p className="text-lg font-black">{entry.rawText}</p>
          <p className="mt-2 text-sm font-bold text-ink/60">Detected as: {entry.inferredTypes.filter((type) => type !== "note").join(" / ") || "note"}{entry.itemName ? ` • ${entry.itemName}` : ""}{entry.location ? ` • ${entry.location}` : ""}</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <PillButton onClick={() => onUpdate((draft) => confirmCapturedEntry(draft, entry.id), "inbox-confirm")} className="bg-leaf text-white">Confirm</PillButton>
            <PillButton onClick={() => onUpdate((draft) => ({ ...draft, capturedEntries: draft.capturedEntries.map((item) => item.id === entry.id ? { ...item, confirmed: false } : item) }), "inbox-edit")} className="bg-skycap text-ink">Edit</PillButton>
            <PillButton onClick={() => onUpdate((draft) => dismissCapturedEntry(draft, entry.id), "inbox-dismiss")} className="bg-white text-ink ring-1 ring-black/10">Dismiss</PillButton>
          </div>
        </Card>
      )) : (
        <Card><h3 className="font-black">Inbox clear</h3><p className="mt-1 text-sm font-bold text-ink/60">Captured notes that need action will land here.</p></Card>
      )}
    </div>
  );
}

function HistoryView({ state, onUpdate, onCopy, copyNote }: { state: ShiftState; onUpdate: (mutator: (draft: ShiftState) => ShiftState, action?: string) => void; onCopy: (text: string) => void; copyNote: string }) {
  const [tab, setTab] = useState("need");
  return (
    <div className="grid gap-4">
      <Card>
        <h2 className="text-2xl font-black">History</h2>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {["need", "inventory", "panic", "reminders", "reports", "waste", "insights", "stats"].map((option) => (
            <PillButton key={option} onClick={() => setTab(option)} className={tab === option ? "bg-leaf text-white" : "bg-white text-ink ring-1 ring-black/10"}>{option}</PillButton>
          ))}
        </div>
      </Card>
      {tab === "need" && <NeedNowView state={state} onUpdate={onUpdate} />}
      {tab === "inventory" && <InventoryView state={state} onUpdate={onUpdate} />}
      {tab === "panic" && <PanicView state={state} onUpdate={onUpdate} onCopy={onCopy} />}
      {tab === "reminders" && <RemindersView state={state} onUpdate={onUpdate} />}
      {tab === "reports" && <ReportsView state={state} onUpdate={onUpdate} />}
      {tab === "waste" && <WasteView state={state} onUpdate={onUpdate} />}
      {tab === "insights" && <InsightsView state={state} onUpdate={onUpdate} onCopy={onCopy} copyNote={copyNote} />}
      {tab === "stats" && <StatsView state={state} onUpdate={onUpdate} />}
    </div>
  );
}

function SettingsView({ state, onUpdate }: { state: ShiftState; onUpdate: (mutator: (draft: ShiftState) => ShiftState, action?: string) => void }) {
  return <ShiftSettingsPanel state={state} onUpdate={onUpdate} onClose={() => undefined} />;
}

function ShiftSettingsPanel({
  state,
  onUpdate,
  onClose,
}: {
  state: ShiftState;
  onUpdate: (mutator: (draft: ShiftState) => ShiftState, action?: string) => void;
  onClose: () => void;
}) {
  const settings = state.settings;
  const floorKey = settings.activeShift === "AM" ? "amFloors" : "pmFloors";
  const floors = settings[floorKey];
  const [floorDraft, setFloorDraft] = useState(floors.join(", "));

  useEffect(() => {
    setFloorDraft(floors.join(", "));
  }, [floorKey]);

  function saveFloors() {
    const nextFloors = floorDraft
      .split(/[,;\n]+/)
      .map((floor) => floor.trim())
      .filter(Boolean);
    onUpdate((draft) => ({
      ...draft,
      settings: { ...draft.settings, [floorKey]: nextFloors },
    }), "shift-floor-settings");
  }

  return (
    <Card className="border-2 border-leaf/20">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-black uppercase text-leaf">Settings</p>
          <h3 className="text-lg font-black">Shift setup</h3>
          <p className="text-sm font-bold text-ink/60">{settings.activeShift} floors: {floors.join(", ") || "None set"}</p>
        </div>
        <PillButton onClick={onClose} className="bg-skycap text-ink">Done</PillButton>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        <label className="grid gap-1 text-sm font-black">
          Attendant
          <input
            value={settings.attendantName}
            onChange={(event) => onUpdate((draft) => ({ ...draft, settings: { ...draft.settings, attendantName: event.target.value } }), "settings-attendant")}
            placeholder="Your name"
            className="rounded-lg border border-black/10 px-3 py-3 font-normal"
          />
        </label>
        <label className="grid gap-1 text-sm font-black">
          Location / building
          <input
            value={settings.buildingName}
            onChange={(event) => onUpdate((draft) => ({ ...draft, settings: { ...draft.settings, buildingName: event.target.value } }), "settings-building")}
            placeholder="Breakroom A"
            className="rounded-lg border border-black/10 px-3 py-3 font-normal"
          />
        </label>
      </div>
      <label className="mt-2 grid gap-1 text-sm font-black">
        Email later
        <input
          value={settings.attendantEmail ?? ""}
          onChange={(event) => onUpdate((draft) => ({ ...draft, settings: { ...draft.settings, attendantEmail: event.target.value } }), "settings-email")}
          placeholder="Future login email"
          className="rounded-lg border border-black/10 px-3 py-3 font-normal"
        />
      </label>
      <div className="mt-3 grid grid-cols-2 rounded-lg bg-mist p-1">
        {(["AM", "PM"] as const).map((shift) => (
          <button
            key={shift}
            onClick={() => onUpdate((draft) => ({ ...draft, settings: { ...draft.settings, activeShift: shift } }), "shift-mode")}
            className={`tap rounded-md px-3 py-2 text-sm font-black ${settings.activeShift === shift ? "bg-leaf text-white" : "text-ink/65"}`}
          >
            {shift}
          </button>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="grid gap-1 text-sm font-black">
          Start
          <input
            value={settings.shiftStartTime}
            onChange={(event) => onUpdate((draft) => ({ ...draft, settings: { ...draft.settings, shiftStartTime: event.target.value } }), "shift-start")}
            type="time"
            className="rounded-lg border border-black/10 px-3 py-3 font-normal"
          />
        </label>
        <label className="grid gap-1 text-sm font-black">
          End
          <input
            value={settings.shiftEndTime}
            onChange={(event) => onUpdate((draft) => ({ ...draft, settings: { ...draft.settings, shiftEndTime: event.target.value } }), "shift-end")}
            type="time"
            className="rounded-lg border border-black/10 px-3 py-3 font-normal"
          />
        </label>
      </div>
      <label className="mt-3 grid gap-1 text-sm font-black">
        {settings.activeShift} floors
        <input
          value={floorDraft}
          onChange={(event) => setFloorDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              saveFloors();
            }
          }}
          placeholder="Floor 3, Floor 6"
          className="rounded-lg border border-black/10 px-3 py-3 font-normal"
        />
      </label>
      <PillButton onClick={saveFloors} className="mt-3 w-full bg-leaf text-white">
        Save floors
      </PillButton>
    </Card>
  );
}

function NeedNowView({
  state,
  onUpdate,
}: {
  state: ShiftState;
  onUpdate: (mutator: (draft: ShiftState) => ShiftState, action?: string) => void;
}) {
  const activeFloors = state.settings.activeShift === "AM" ? state.settings.amFloors : state.settings.pmFloors;
  const [name, setName] = useState("");
  const [quantityDraft, setQuantityDraft] = useState("1");
  const [location, setLocation] = useState(activeFloors[0] ?? "Breakroom A");
  const itemSuggestions = state.items
    .filter((item) => item.active)
    .filter((item) => !name.trim() || item.name.toLowerCase().includes(name.trim().toLowerCase()))
    .slice(0, name.trim() ? 6 : 8);
  const needs = [
    ...state.items
      .filter((item) => item.status === "missing" || item.status === "running low" || item.status === "reported")
      .map((item) => ({
        id: `inventory-${item.id}`,
        itemId: item.id,
        name: item.name,
        quantity: item.quantityNeeded || 1,
        unit: item.unit,
        location: item.location,
        source: "inventory" as const,
      })),
    ...state.urgent.map((item) => ({
      id: `panic-${item.id}`,
      name: item.name,
      quantity: item.quantity,
      unit: "",
      location: item.location,
      source: "panic" as const,
    })),
    ...state.needNow.filter((item) => !item.done),
  ];

  function clearNeed(need: (typeof needs)[number]) {
    onUpdate((draft) => {
      if (need.source === "inventory" && "itemId" in need) {
        return {
          ...draft,
          items: draft.items.map((item) => (item.id === need.itemId ? { ...item, status: "restocked", quantityNeeded: 0 } : item)),
        };
      }
      if (need.source === "panic") {
        return { ...draft, urgent: draft.urgent.filter((item) => `panic-${item.id}` !== need.id) };
      }
      return { ...draft, needNow: draft.needNow.map((item) => (item.id === need.id ? { ...item, done: true } : item)) };
    }, "need-now-clear");
  }

  function pickInventoryItem(item: InventoryItem) {
    setName(item.name);
    setQuantityDraft(String(item.quantityNeeded || 1));
    setLocation(item.location);
  }

  return (
    <div className="grid gap-4">
      <Card className="bg-leaf text-white">
        <h2 className="text-3xl font-black">Need Now</h2>
        <p className="mt-1 font-bold opacity-90">Todayâ€™s active needs, separate from the inventory catalog.</p>
      </Card>
      <Card>
        <h3 className="text-lg font-black">Add need for today</h3>
        <div className="mt-3 grid gap-2">
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Item needed" className="rounded-lg border border-black/10 px-3 py-3" />
          {itemSuggestions.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {itemSuggestions.map((item) => (
                <PillButton
                  key={item.id}
                  onClick={() => pickInventoryItem(item)}
                  className={name === item.name ? "bg-leaf text-white" : "bg-mist text-ink"}
                >
                  {item.name}
                </PillButton>
              ))}
            </div>
          )}
          <div className="grid grid-cols-[88px_1fr] gap-2">
            <input
              value={quantityDraft}
              onChange={(event) => setQuantityDraft(event.target.value)}
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="1"
              className="rounded-lg border border-black/10 px-3 py-3"
            />
            <input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Location/floor" className="rounded-lg border border-black/10 px-3 py-3" />
          </div>
          {activeFloors.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {activeFloors.map((floor) => (
                <PillButton key={floor} onClick={() => setLocation(floor)} className={location === floor ? "bg-leaf text-white" : "bg-skycap text-ink"}>
                  {floor}
                </PillButton>
              ))}
            </div>
          )}
          <PillButton
            onClick={() => {
              if (!name.trim()) return;
              const matchedItem = state.items.find((item) => item.name.toLowerCase() === name.trim().toLowerCase());
              const quantity = Math.max(1, Number(quantityDraft) || 1);
              onUpdate((draft) => ({
                ...draft,
                needNow: [
                  {
                    id: crypto.randomUUID(),
                    name: name.trim(),
                    quantity,
                    unit: matchedItem?.unit ?? "each",
                    location,
                    source: "manual",
                    done: false,
                    createdAt: new Date().toISOString(),
                  },
                  ...draft.needNow,
                ],
              }), "need-now-add");
              setName("");
              setQuantityDraft("1");
            }}
            className="bg-ink text-white"
          >
            Add to Need Now
          </PillButton>
        </div>
      </Card>
      <div className="grid gap-3">
        {needs.length ? needs.map((need) => (
          <Card key={need.id}>
            <div className="grid grid-cols-[1fr_auto] items-center gap-3">
              <div>
                <h3 className="text-lg font-black">{need.name}</h3>
                <p className="text-sm font-bold text-ink/60">{need.quantity} {need.unit} â€¢ {need.location} â€¢ {need.source}</p>
              </div>
              <PillButton onClick={() => clearNeed(need)} className="bg-leaf text-white">Done</PillButton>
            </div>
          </Card>
        )) : (
          <Card>
            <h3 className="font-black">Nothing needed right now</h3>
            <p className="mt-1 text-sm font-bold text-ink/60">Items marked missing, running low, reported, urgent, or manually added will show here.</p>
          </Card>
        )}
      </div>
    </div>
  );
}

function ChecklistEditor({
  state,
  onUpdate,
  compact = false,
  startExpanded = true,
}: {
  state: ShiftState;
  compact?: boolean;
  startExpanded?: boolean;
  onUpdate: (mutator: (draft: ShiftState) => ShiftState, action?: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(startExpanded);
  const [name, setName] = useState("");
  const [weight, setWeight] = useState(5);

  useEffect(() => {
    setExpanded(startExpanded);
  }, [startExpanded]);

  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <button onClick={() => setExpanded(!expanded)} className="tap text-left">
          <h3 className="text-lg font-black">Opening checklist</h3>
          <p className="text-xs font-bold text-ink/55">{expanded ? "Tap to collapse" : "Tap to expand"} â€¢ {getReadiness(state.checklist)}% complete</p>
        </button>
        <div className="flex gap-2">
          <PillButton onClick={() => setExpanded(!expanded)} className="bg-white text-ink ring-1 ring-black/10">{expanded ? "Hide" : "Show"}</PillButton>
          {expanded && <PillButton onClick={() => setEditing(!editing)} className="bg-skycap text-ink">{editing ? "Done" : "Edit"}</PillButton>}
        </div>
      </div>
      {!expanded && (
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-mist">
          <div className="h-full rounded-full bg-leaf" style={{ width: `${getReadiness(state.checklist)}%` }} />
        </div>
      )}
      {expanded && (
      <div className="mt-3 grid gap-2">
        {state.checklist.map((item) => (
          <div key={item.id} className="grid grid-cols-[1fr_auto] items-center gap-2 rounded-lg bg-mist p-2">
            <button
              onClick={() =>
                onUpdate((draft) => ({
                  ...draft,
                  checklist: draft.checklist.map((entry) => (entry.id === item.id ? { ...entry, done: !entry.done } : entry)),
                }), "checklist-toggle")
              }
              className={`tap rounded-lg px-3 py-2 text-left font-black ${item.done ? "bg-leaf text-white" : "bg-white text-ink"}`}
            >
              {item.title}
            </button>
            <div className="flex items-center gap-2">
              {editing ? (
                <input
                  aria-label={`${item.title} weight`}
                  type="number"
                  value={item.weight}
                  onChange={(event) =>
                    onUpdate((draft) => ({
                      ...draft,
                      checklist: draft.checklist.map((entry) =>
                        entry.id === item.id ? { ...entry, weight: Number(event.target.value) || 0 } : entry
                      ),
                    }), "checklist-weight")
                  }
                  className="w-16 rounded-md border border-black/10 px-2 py-2 font-bold"
                />
              ) : (
                <span className="w-12 text-right text-sm font-black">{item.weight}%</span>
              )}
            </div>
          </div>
        ))}
      </div>
      )}
      {editing && (
        <div className="mt-3 grid grid-cols-[1fr_76px_auto] gap-2">
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="New task" className="rounded-lg border border-black/10 px-3 py-2" />
          <input value={weight} onChange={(event) => setWeight(Number(event.target.value) || 0)} type="number" className="rounded-lg border border-black/10 px-3 py-2" />
          <PillButton
            onClick={() => {
              if (!name.trim()) return;
              const item: ChecklistItem = { id: crypto.randomUUID(), title: name.trim(), weight, done: false };
              onUpdate((draft) => ({ ...draft, checklist: [...draft.checklist, item] }), "checklist-add");
              setName("");
              setWeight(5);
            }}
            className="bg-leaf text-white"
          >
            <Plus size={18} />
          </PillButton>
        </div>
      )}
      {!compact && <p className="mt-2 text-xs font-bold text-ink/55">Weights can total any value; readiness normalizes them to 100%.</p>}
    </Card>
  );
}

function InventoryView({ state, onUpdate }: { state: ShiftState; onUpdate: (mutator: (draft: ShiftState) => ShiftState, action?: string) => void }) {
  const [filter, setFilter] = useState("all");
  const [scanText, setScanText] = useState("");
  const [newCategory, setNewCategory] = useState<ItemCategory>("other");
  const [newLocation, setNewLocation] = useState("Breakroom");
  const [photoName, setPhotoName] = useState("");
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState("");
  const [uploadedImageUrl, setUploadedImageUrl] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [ocrSuggestion, setOcrSuggestion] = useState<OcrCleanupResult | null>(null);
  const [ocrError, setOcrError] = useState("");
  const [cleaningOcr, setCleaningOcr] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState("");
  const items = state.items.filter((item) => filter === "all" || item.category === filter || item.status === filter);
  const candidates = duplicateCandidates(scanText, state.items);
  const activeFloors = state.settings.activeShift === "AM" ? state.settings.amFloors : state.settings.pmFloors;
  const locationOptions = ["Breakroom", ...activeFloors, "Main storage"].filter((value, index, all) => value && all.indexOf(value) === index);
  const categoryOptions: ItemCategory[] = ["other", "dairy", "drinks", "snacks", "coffee", "paper goods", "cleaning"];

  function patchItem(id: string, patch: Partial<InventoryItem>) {
    onUpdate((draft) => ({
      ...draft,
      items: draft.items.map((item) => (item.id === id ? { ...item, ...patch, lastSeenAt: new Date().toISOString() } : item)),
    }), "inventory-update");
  }

  async function uploadScanPhoto(file?: File) {
    setUploadError("");
    setUploadedImageUrl("");
    setPhotoPreviewUrl("");
    setPhotoName(file?.name ?? "");
    if (!file) return;

    setPhotoPreviewUrl(URL.createObjectURL(file));
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/uploads", { method: "POST", body: formData });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "Photo upload failed.");
      setUploadedImageUrl(result.url);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Photo upload failed.");
    } finally {
      setUploadingImage(false);
    }
  }

  function resetScan() {
    setScanText("");
    setNewCategory("other");
    setNewLocation("Breakroom");
    setOcrSuggestion(null);
    setOcrError("");
    setPhotoName("");
    setPhotoPreviewUrl("");
    setUploadedImageUrl("");
    setUploadError("");
  }

  const addBlockedByPhoto = uploadingImage || (Boolean(photoName) && !uploadedImageUrl && !uploadError);

  function deleteItem(item: InventoryItem) {
    if (deleteConfirmId !== item.id) {
      setDeleteConfirmId(item.id);
      return;
    }

    onUpdate((draft) => ({
      ...draft,
      items: draft.items.filter((entry) => entry.id !== item.id),
    }), "inventory-delete");
    setDeleteConfirmId("");
  }

  async function cleanLabel() {
    if (!scanText.trim() && !uploadedImageUrl) return;
    setCleaningOcr(true);
    setOcrError("");
    try {
      const response = await fetch("/api/ai/ocr-cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText: scanText, imageUrl: uploadedImageUrl, items: state.items }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Cleanup failed");
      setOcrSuggestion(data.result);
      if (!scanText.trim() && data.result?.rawText) setScanText(data.result.rawText);
    } catch (error) {
      if (scanText.trim()) {
        setOcrSuggestion(cleanOcrWithRules(scanText, state.items));
        setOcrError("Vision OCR failed, so I used typed text cleanup instead.");
      } else {
        setOcrError(error instanceof Error ? error.message : "Vision OCR failed.");
      }
    } finally {
      setCleaningOcr(false);
    }
  }

  function useOcrSuggestion(suggestion: OcrCleanupResult) {
    setScanText(suggestion.cleanName);
    setNewCategory(suggestion.category);
    setNewLocation(newLocation || "Breakroom");
  }

  function mergeWithExisting(suggestion: OcrCleanupResult) {
    if (!suggestion.duplicateItemId) return;
    patchItem(suggestion.duplicateItemId, {
      imageUrl: uploadedImageUrl || undefined,
      category: suggestion.category,
      unit: suggestion.unit as Unit,
      location: newLocation.trim() || "Breakroom",
    });
    resetScan();
  }

  return (
    <div className="grid gap-4">
      <Card>
        <h2 className="text-2xl font-black">Inventory</h2>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {["all", "dairy", "drinks", "snacks", "coffee", "paper goods", "running low", "missing"].map((option) => (
            <PillButton key={option} onClick={() => setFilter(option)} className={filter === option ? "bg-leaf text-white" : "bg-white text-ink ring-1 ring-black/10"}>
              {option}
            </PillButton>
          ))}
        </div>
      </Card>

      <Card>
        <div className="flex items-center gap-2">
          <ScanLine />
          <h3 className="text-lg font-black">Scan Label</h3>
        </div>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(event) => uploadScanPhoto(event.target.files?.[0])}
          className="mt-3 w-full rounded-lg bg-mist p-3 text-sm font-bold"
        />
        {(photoPreviewUrl || uploadedImageUrl) && (
          <img src={uploadedImageUrl || photoPreviewUrl} alt="Selected label" className="mt-3 h-36 w-full rounded-lg object-cover" />
        )}
        <div className={`mt-2 rounded-lg px-3 py-2 text-sm font-black ${
          uploadError ? "bg-tomato/10 text-tomato" : uploadedImageUrl ? "bg-lime text-ink" : uploadingImage ? "bg-honey text-ink" : "bg-mist text-ink/60"
        }`}>
          {uploadingImage && `Uploading ${photoName}...`}
          {uploadedImageUrl && `Photo uploaded and attached: ${photoName}`}
          {uploadError && `Photo not attached: ${uploadError}`}
          {!photoName && !uploadingImage && !uploadedImageUrl && !uploadError && "Choose or take a photo first. Saved photos live in /app/uploads on Coolify."}
        </div>
        {uploadedImageUrl && <p className="mt-1 text-xs font-bold text-ink/50">Saved path: {uploadedImageUrl}</p>}
        {uploadError && <p className="mt-2 text-sm font-black text-tomato">{uploadError}</p>}
        <input
          value={scanText}
          onChange={(event) => {
            setScanText(event.target.value);
            setOcrSuggestion(null);
          }}
          placeholder={photoName ? "OCR placeholder: type detected label text" : "Upload photo, then enter detected text"}
          className="mt-2 w-full rounded-lg border border-black/10 px-3 py-3"
        />
        <div className="mt-2 grid grid-cols-2 gap-2">
          <PillButton onClick={cleanLabel} disabled={(!scanText.trim() && !uploadedImageUrl) || cleaningOcr} className="bg-ink text-white disabled:opacity-50">
            {cleaningOcr ? "Reading..." : uploadedImageUrl ? "Read photo" : "Clean label"}
          </PillButton>
          <PillButton onClick={() => setOcrSuggestion(cleanOcrWithRules(scanText, state.items))} disabled={!scanText.trim()} className="bg-skycap text-ink disabled:opacity-50">
            Rules only
          </PillButton>
        </div>
        {ocrError && <p className="mt-2 rounded-lg bg-tomato/10 px-3 py-2 text-sm font-black text-tomato">{ocrError}</p>}
        {ocrSuggestion && (
          <div className="mt-3 rounded-lg border border-leaf/20 bg-lime/70 p-3">
            <p className="text-xs font-black uppercase text-ink/50">Suggested</p>
            <h4 className="text-lg font-black">{ocrSuggestion.cleanName}</h4>
            <p className="text-sm font-bold text-ink/65">Category: {ocrSuggestion.category} â€¢ Unit: {ocrSuggestion.unit} â€¢ Confidence {Math.round(ocrSuggestion.confidence * 100)}%</p>
            {ocrSuggestion.duplicateName && <p className="mt-1 text-sm font-bold text-ink/65">Possible match: {ocrSuggestion.duplicateName}</p>}
            <div className="mt-3 grid grid-cols-3 gap-2">
              <PillButton onClick={() => useOcrSuggestion(ocrSuggestion)} className="bg-leaf text-white">Use</PillButton>
              <PillButton onClick={() => setOcrSuggestion(null)} className="bg-white text-ink ring-1 ring-black/10">Edit</PillButton>
              <PillButton onClick={() => mergeWithExisting(ocrSuggestion)} disabled={!ocrSuggestion.duplicateItemId} className="bg-ink text-white disabled:opacity-40">Merge</PillButton>
            </div>
          </div>
        )}
        <div className="mt-3 grid gap-2">
          <label className="text-xs font-black uppercase text-ink/50">Where is it?</label>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {locationOptions.map((location) => (
              <PillButton
                key={location}
                onClick={() => setNewLocation(location)}
                className={newLocation === location ? "bg-leaf text-white" : "bg-skycap text-ink"}
              >
                {location}
              </PillButton>
            ))}
          </div>
          <input
            value={newLocation}
            onChange={(event) => setNewLocation(event.target.value)}
            placeholder="Breakroom"
            className="w-full rounded-lg border border-black/10 px-3 py-3"
          />
        </div>
        <div className="mt-3 grid gap-2">
          <label className="text-xs font-black uppercase text-ink/50">Category optional</label>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {categoryOptions.map((category) => (
              <PillButton
                key={category}
                onClick={() => setNewCategory(category)}
                className={newCategory === category ? "bg-leaf text-white" : "bg-white text-ink ring-1 ring-black/10"}
              >
                {category}
              </PillButton>
            ))}
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <PillButton
            onClick={() => {
              if (!scanText.trim() || addBlockedByPhoto) return;
              const item: InventoryItem = {
                id: crypto.randomUUID(),
                name: scanText.trim(),
                category: newCategory,
                unit: ocrSuggestion?.unit ?? "each",
                location: newLocation.trim() || "Breakroom",
                status: "stocked",
                quantityNeeded: 0,
                rotating: true,
                active: true,
                imageUrl: uploadedImageUrl || undefined,
                notes: "Added from Scan Label MVP placeholder.",
                rotationStartDate: new Date().toISOString(),
                lastSeenAt: new Date().toISOString(),
              };
              onUpdate((draft) => ({ ...draft, items: [item, ...draft.items] }), "scan-add-item");
              resetScan();
            }}
            disabled={addBlockedByPhoto}
            className={`${addBlockedByPhoto ? "bg-ink/30 text-white" : "bg-leaf text-white"}`}
          >
            {uploadingImage ? "Uploading photo..." : addBlockedByPhoto ? "Waiting for photo" : uploadedImageUrl ? "Add item with photo" : "Add as new item"}
          </PillButton>
          <PillButton onClick={resetScan} className="bg-skycap text-ink">Try again</PillButton>
        </div>
        {candidates.length > 0 && <p className="mt-2 text-sm font-bold text-ink/65">Possible match: {candidates[0].name}</p>}
      </Card>

      <div className="grid gap-3">
        {items.map((item) => (
          <Card key={item.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-black">{item.name}</h3>
                <p className="text-sm font-bold text-ink/60">{item.status} â€¢ {item.location} â€¢ {item.unit}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {item.imageUrl && <img src={item.imageUrl} alt="" className="h-12 w-12 rounded-lg object-cover" />}
                {item.rotating && <span className="rounded-full bg-lime px-2 py-1 text-xs font-black">Rotating</span>}
              </div>
            </div>
            <div className="mt-3 grid grid-cols-[44px_1fr_44px] items-center gap-2">
              <PillButton onClick={() => patchItem(item.id, { quantityNeeded: Math.max(0, item.quantityNeeded - 1) })} className="bg-mist text-ink">-</PillButton>
              <div className="rounded-lg bg-mist px-3 py-3 text-center text-xl font-black">{item.quantityNeeded}</div>
              <PillButton onClick={() => patchItem(item.id, { quantityNeeded: item.quantityNeeded + 1 })} className="bg-mist text-ink">+</PillButton>
            </div>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {[1, 2, 5, 10].map((amount) => (
                <PillButton key={amount} onClick={() => patchItem(item.id, { quantityNeeded: item.quantityNeeded + amount })} className="bg-skycap text-ink">
                  +{amount}
                </PillButton>
              ))}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <PillButton onClick={() => patchItem(item.id, { quantityNeeded: 0, status: "stocked" })} className="bg-white text-ink ring-1 ring-black/10">Clear</PillButton>
              <PillButton onClick={() => patchItem(item.id, { status: "running low" })} className="bg-honey text-ink">Running low</PillButton>
              <PillButton onClick={() => patchItem(item.id, { status: "missing" })} className="bg-tomato text-white">Missing</PillButton>
              <PillButton onClick={() => patchItem(item.id, { status: "restocked", quantityNeeded: 0 })} className="bg-leaf text-white">Restocked</PillButton>
              <PillButton
                onClick={() => {
                  patchItem(item.id, { status: "reported" });
                  onUpdate((draft) => ({
                    ...draft,
                    reports: [
                      {
                        id: crypto.randomUUID(),
                        itemId: item.id,
                        itemName: item.name,
                        reportedAt: new Date().toISOString(),
                        reportedTo: "Team chat",
                        method: "chat",
                        status: "pending",
                        followUpNeeded: true,
                        notes: "",
                      },
                      ...draft.reports,
                    ],
                  }), "reported-item");
                }}
                className="col-span-2 bg-ink text-white"
              >
                Reported
              </PillButton>
              <PillButton
                onClick={() => deleteItem(item)}
                onBlur={() => setDeleteConfirmId((id) => (id === item.id ? "" : id))}
                className={`col-span-2 ${deleteConfirmId === item.id ? "bg-tomato text-white" : "bg-white text-tomato ring-1 ring-tomato/30"}`}
              >
                <Trash2 size={16} className="inline" /> {deleteConfirmId === item.id ? "Tap again to delete" : "Delete item"}
              </PillButton>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function PanicView({ state, onUpdate, onCopy }: { state: ShiftState; onUpdate: (mutator: (draft: ShiftState) => ShiftState, action?: string) => void; onCopy: (text: string) => void }) {
  const quick = ["Coffee", "Milk", "Yogurt", "Cups", "Napkins", "Snacks", "Trash", "Custom item"];
  const [custom, setCustom] = useState("");

  function add(name: string) {
    const clean = name === "Custom item" ? custom.trim() : name;
    if (!clean) return;
    onUpdate((draft) => {
      const existing = draft.urgent.find((item) => item.name.toLowerCase() === clean.toLowerCase());
      return {
        ...draft,
        urgent: existing
          ? draft.urgent.map((item) => (item.id === existing.id ? { ...item, quantity: item.quantity + 1 } : item))
          : [{ id: crypto.randomUUID(), name: clean, quantity: 1, location: "Breakroom A" }, ...draft.urgent],
      };
    }, "panic-add");
    setCustom("");
  }

  return (
    <div className="grid gap-4">
      <Card className="bg-tomato text-white">
        <h2 className="text-3xl font-black">Panic Mode</h2>
        <p className="mt-1 font-bold opacity-90">Fast urgent restock capture.</p>
      </Card>
      <div className="grid grid-cols-2 gap-3">
        {quick.map((name) => (
          <PillButton key={name} onClick={() => add(name)} className="bg-white py-6 text-lg text-ink shadow-soft">
            {name}
          </PillButton>
        ))}
      </div>
      <input value={custom} onChange={(event) => setCustom(event.target.value)} placeholder="Custom urgent item" className="rounded-lg border border-black/10 px-4 py-4 text-lg" />
      <div className="grid gap-2">
        {state.urgent.map((item) => (
          <Card key={item.id}>
            <div className="grid grid-cols-[1fr_44px_52px_44px] items-center gap-2">
              <div>
                <h3 className="font-black">{item.name}</h3>
                <p className="text-sm font-bold text-ink/60">{item.location}</p>
              </div>
              <PillButton onClick={() => onUpdate((draft) => ({ ...draft, urgent: draft.urgent.map((entry) => entry.id === item.id ? { ...entry, quantity: Math.max(0, entry.quantity - 1) } : entry).filter((entry) => entry.quantity > 0) }), "panic-qty")} className="bg-mist text-ink">-</PillButton>
              <span className="text-center text-xl font-black">{item.quantity}</span>
              <PillButton onClick={() => onUpdate((draft) => ({ ...draft, urgent: draft.urgent.map((entry) => entry.id === item.id ? { ...entry, quantity: entry.quantity + 1 } : entry) }), "panic-qty")} className="bg-mist text-ink">+</PillButton>
            </div>
          </Card>
        ))}
      </div>
      <PillButton onClick={() => onCopy(makeSummary(state, "urgent"))} className="bg-ink py-4 text-lg text-white">Copy urgent summary</PillButton>
    </div>
  );
}

function RemindersView({ state, onUpdate }: { state: ShiftState; onUpdate: (mutator: (draft: ShiftState) => ShiftState, action?: string) => void }) {
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("08:30");
  const [location, setLocation] = useState("Floor 6");
  const [permission, setPermission] = useState(typeof Notification === "undefined" ? "unsupported" : Notification.permission);

  async function requestNotifications() {
    if (typeof Notification === "undefined") return setPermission("unsupported");
    const result = await Notification.requestPermission();
    setPermission(result);
    if ("vibrate" in navigator) navigator.vibrate?.(70);
  }

  return (
    <div className="grid gap-4">
      <Card>
        <h2 className="text-2xl font-black">Quiet reminders</h2>
        <p className="mt-1 text-sm font-bold text-ink/60">Notifications: {permission}. Vibration is used only when the browser supports it.</p>
        <PillButton onClick={requestNotifications} className="mt-3 bg-leaf text-white">Enable reminders</PillButton>
      </Card>
      <Card>
        <div className="grid gap-2">
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Task title" className="rounded-lg border border-black/10 px-3 py-3" />
          <div className="grid grid-cols-2 gap-2">
            <input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Location" className="rounded-lg border border-black/10 px-3 py-3" />
            <input value={time} onChange={(event) => setTime(event.target.value)} type="time" className="rounded-lg border border-black/10 px-3 py-3" />
          </div>
          <PillButton
            onClick={() => {
              if (!title.trim()) return;
              const reminder: Reminder = { id: crypto.randomUUID(), title, location, time, repeat: "daily", style: "both", doneToday: false };
              onUpdate((draft) => ({ ...draft, reminders: [reminder, ...draft.reminders] }), "reminder-add");
              setTitle("");
            }}
            className="bg-leaf text-white"
          >
            Add reminder
          </PillButton>
        </div>
      </Card>
      {state.reminders.map((reminder) => (
        <Card key={reminder.id}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-black">{reminder.title}</h3>
              <p className="text-sm font-bold text-ink/60">{reminder.location} at {reminder.time} â€¢ {reminder.repeat}</p>
            </div>
            <PillButton onClick={() => onUpdate((draft) => ({ ...draft, reminders: draft.reminders.map((entry) => entry.id === reminder.id ? { ...entry, doneToday: !entry.doneToday } : entry) }), "reminder-done")} className={reminder.doneToday ? "bg-leaf text-white" : "bg-skycap text-ink"}>
              {reminder.doneToday ? "Done" : "Mark"}
            </PillButton>
          </div>
        </Card>
      ))}
    </div>
  );
}

function ReportsView({ state, onUpdate }: { state: ShiftState; onUpdate: (mutator: (draft: ShiftState) => ShiftState, action?: string) => void }) {
  const [filter, setFilter] = useState("pending");
  const reports = state.reports.filter((report) => filter === "all" || (filter === "resolved" ? report.status === "restocked" || report.status === "ordered" : filter === "repeated" ? state.reports.filter((entry) => entry.itemName === report.itemName).length > 1 : report.status === filter));

  return (
    <div className="grid gap-4">
      <Card>
        <h2 className="text-2xl font-black">Reported items</h2>
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {["pending", "resolved", "no action", "repeated", "all"].map((option) => (
            <PillButton key={option} onClick={() => setFilter(option)} className={filter === option ? "bg-leaf text-white" : "bg-white text-ink ring-1 ring-black/10"}>{option}</PillButton>
          ))}
        </div>
      </Card>
      {reports.map((report) => (
        <Card key={report.id}>
          <h3 className="text-lg font-black">{report.itemName}</h3>
          <p className="text-sm font-bold text-ink/60">Reported {new Date(report.reportedAt).toLocaleString()} â€¢ {report.method}</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {["pending", "ordered", "restocked", "no action"].map((status) => (
              <PillButton key={status} onClick={() => onUpdate((draft) => ({ ...draft, reports: draft.reports.map((entry) => entry.id === report.id ? { ...entry, status: status as ReportedItem["status"], followUpNeeded: status === "pending" } : entry) }), "report-status")} className={report.status === status ? "bg-leaf text-white" : "bg-mist text-ink"}>
                {status}
              </PillButton>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

function WasteView({ state, onUpdate }: { state: ShiftState; onUpdate: (mutator: (draft: ShiftState) => ShiftState, action?: string) => void }) {
  const [item, setItem] = useState("Oxxo snacks");
  const [count, setCount] = useState("5 boxes");
  const [expirationItem, setExpirationItem] = useState("Plain yogurt");

  return (
    <div className="grid gap-4">
      <Card>
        <h2 className="text-2xl font-black">Waste / Expiration</h2>
      </Card>
      <Card>
        <h3 className="text-lg font-black">Add waste observation</h3>
        <div className="mt-3 grid gap-2">
          <input value={item} onChange={(event) => setItem(event.target.value)} className="rounded-lg border border-black/10 px-3 py-3" />
          <input value={count} onChange={(event) => setCount(event.target.value)} className="rounded-lg border border-black/10 px-3 py-3" />
          <PillButton
            onClick={() => {
              const waste: WasteObservation = { id: crypto.randomUUID(), itemName: item, date: new Date().toISOString(), rating: "high", packagingCount: count, trashType: "cardboard", notes: "Personal observation, not exact science." };
              onUpdate((draft) => ({ ...draft, waste: [waste, ...draft.waste] }), "waste-add");
            }}
            className="bg-leaf text-white"
          >
            Save waste note
          </PillButton>
        </div>
      </Card>
      <Card>
        <h3 className="text-lg font-black">Expiration watch</h3>
        <div className="mt-3 grid gap-2">
          <input value={expirationItem} onChange={(event) => setExpirationItem(event.target.value)} className="rounded-lg border border-black/10 px-3 py-3" />
          <div className="grid grid-cols-2 gap-2">
            {["today", "tomorrow", "3 days", "1 week", "this week", "unknown"].map((estimate) => (
              <PillButton
                key={estimate}
                onClick={() => {
                  const batch: ExpirationBatch = { id: crypto.randomUUID(), itemName: expirationItem, quantity: 1, location: "Breakroom A", estimate, status: estimate === "today" ? "check today" : estimate === "unknown" ? "check today" : "use soon", notes: "" };
                  onUpdate((draft) => ({ ...draft, expirations: [batch, ...draft.expirations] }), "expiration-add");
                }}
                className="bg-skycap text-ink"
              >
                {estimate}
              </PillButton>
            ))}
          </div>
        </div>
      </Card>
      <div className="grid gap-3 md:grid-cols-2">
        {state.expirations.map((batch) => (
          <Card key={batch.id}><h3 className="font-black">{batch.itemName}</h3><p className="text-sm font-bold text-ink/60">{batch.estimate} â€¢ {batch.status}</p></Card>
        ))}
        {state.waste.map((entry) => (
          <Card key={entry.id}><h3 className="font-black">{entry.itemName}</h3><p className="text-sm font-bold text-ink/60">{entry.packagingCount} â€¢ {entry.rating} â€¢ {entry.trashType}</p></Card>
        ))}
      </div>
    </div>
  );
}

function InsightsView({
  state,
  onUpdate,
  onCopy,
  copyNote,
}: {
  state: ShiftState;
  onUpdate: (mutator: (draft: ShiftState) => ShiftState, action?: string) => void;
  onCopy: (text: string) => void;
  copyNote: string;
}) {
  const fallback = useMemo(() => weeklyInsightsWithRules(state, new Date()), [state]);
  const insights = state.insights ?? fallback;
  const [generating, setGenerating] = useState(false);

  async function generateInsights() {
    setGenerating(true);
    try {
      const response = await fetch("/api/ai/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state }),
      });
      if (!response.ok) throw new Error("Insight generation failed");
      const data = await response.json();
      onUpdate((draft) => ({ ...draft, insights: data.result, predictions: data.result.likelyNeeds }), "insights-generate");
    } catch {
      onUpdate((draft) => ({ ...draft, insights: fallback, predictions: fallback.likelyNeeds }), "insights-generate-rules");
    } finally {
      setGenerating(false);
    }
  }

  const sustainabilityNote = insights.wasteWatch.length
    ? `Observed repeated high packaging waste for ${insights.wasteWatch.map((item) => item.itemName).join(", ")}. Several restocks may require multiple boxes or containers; this is a personal observation, not an exact measurement.`
    : "No repeated high packaging waste pattern yet.";

  return (
    <div className="grid gap-4">
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase text-leaf">Rules first, AI optional</p>
            <h2 className="text-2xl font-black">Insights</h2>
            <p className="mt-1 text-sm font-bold text-ink/60">Generated on demand so shifts stay fast.</p>
          </div>
          <PillButton onClick={generateInsights} disabled={generating} className="bg-leaf text-white disabled:opacity-60">
            {generating ? "Generating" : "Generate"}
          </PillButton>
        </div>
      </Card>

      <Card>
        <h3 className="text-lg font-black">Likely needs today</h3>
        <ul className="mt-3 grid gap-2 text-sm">
          {(insights.likelyNeeds.length ? insights.likelyNeeds : fallback.likelyNeeds).slice(0, 5).map((prediction) => (
            <li key={prediction.id} className="rounded-md bg-mist px-3 py-2 font-bold text-ink/75">{prediction.message}</li>
          ))}
        </ul>
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        <SummaryCard title="Most missing" count={insights.mostMissing.length} items={insights.mostMissing.map((item) => `${item.name} â€” ${item.count}`)} />
        <SummaryCard title="Most low stock" count={insights.mostLowStock.length} items={insights.mostLowStock.map((item) => `${item.name} â€” ${item.count}`)} />
        <SummaryCard title="Most reported" count={insights.mostReported.length} items={insights.mostReported.map((item) => `${item.name} â€” ${item.count}`)} />
        <SummaryCard title="Pending 2+ days" count={insights.pendingReports.length} items={insights.pendingReports.map((item) => item.itemName)} />
      </div>

      <Card>
        <h3 className="text-lg font-black">Opening readiness</h3>
        <p className="mt-2 text-sm font-bold text-ink/65">Average {insights.readinessAverage}%, best {insights.readinessBest}%</p>
        <p className="mt-1 text-sm font-bold text-ink/65">Average floor run: {insights.averageFloorMinutes || 0} min</p>
        {insights.fastestFloorRun && <p className="mt-1 text-sm font-bold text-ink/65">Fastest: {insights.fastestFloorRun.location}, {insights.fastestFloorRun.minutes} min</p>}
      </Card>

      <Card>
        <h3 className="text-lg font-black">Waste watch</h3>
        <ul className="mt-3 grid gap-2 text-sm">
          {(insights.wasteWatch.length ? insights.wasteWatch : [{ itemName: "None yet", count: 0, note: "No waste-heavy pattern yet." }]).map((item) => (
            <li key={item.itemName} className="rounded-md bg-mist px-3 py-2 font-bold text-ink/75">{item.note}</li>
          ))}
        </ul>
        <PillButton onClick={() => onCopy(sustainabilityNote)} className="mt-3 bg-ink text-white">Copy sustainability note</PillButton>
      </Card>

      <Card>
        <h3 className="text-lg font-black">Weekly summary</h3>
        <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-mist p-3 text-sm font-bold text-ink/75">{insights.summary}</pre>
        <PillButton onClick={() => onCopy(insights.summary)} className="mt-3 bg-leaf text-white"><Copy size={16} className="inline" /> Copy weekly summary</PillButton>
        {copyNote && <p className="mt-2 text-sm font-bold text-leaf">{copyNote}</p>}
      </Card>
    </div>
  );
}

function StatsView({ state, onUpdate }: { state: ShiftState; onUpdate: (mutator: (draft: ShiftState) => ShiftState, action?: string) => void }) {
  const readiness = getReadiness(state.checklist);
  const floorRuns = state.floorRuns;
  const average = floorRuns.length ? Math.round(floorRuns.reduce((sum, run) => sum + run.minutes, 0) / floorRuns.length) : 0;
  const best = floorRuns.length ? Math.min(...floorRuns.map((run) => run.minutes)) : 0;
  const badges = useMemo(() => {
    const earned = [];
    if (state.checklist.every((item) => item.done)) earned.push("Opening Hero");
    if (state.urgent.length) earned.push("Panic Mode Survivor");
    if (state.items.some((item) => item.name.toLowerCase().includes("coffee") && item.status === "restocked")) earned.push("Coffee Guardian");
    if (state.items.some((item) => item.name.toLowerCase().includes("milk") && item.status === "restocked")) earned.push("Milk Rescuer");
    if (state.items.some((item) => item.name.toLowerCase().includes("cookie"))) earned.push("Cookie Watcher");
    if (state.expirations.length) earned.push("Fridge Master");
    if (best > 0) earned.push("Fast Floor Run");
    return earned;
  }, [state, best]);

  return (
    <div className="grid gap-4">
      <Card>
        <h2 className="text-2xl font-black">Stats</h2>
        <p className="mt-1 text-sm font-bold text-ink/60">XP {state.xp + readiness} â€¢ Weekly improvement starts after a few shifts.</p>
      </Card>
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Readiness" value={`${readiness}%`} />
        <Stat label="Average floor" value={`${average} min`} />
        <Stat label="Best floor" value={`${best} min`} />
        <Stat label="Reports" value={`${state.reports.length}`} />
      </div>
      <FloorTimer state={state} onUpdate={onUpdate} />
      <Card>
        <h3 className="text-lg font-black">Badges</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {["Coffee Guardian", "Milk Rescuer", "Cookie Watcher", "Fridge Master", "Opening Hero", "Panic Mode Survivor", "Fast Floor Run"].map((badge) => (
            <span key={badge} className={`rounded-full px-3 py-2 text-sm font-black ${badges.includes(badge) ? "bg-lime text-ink" : "bg-mist text-ink/45"}`}>{badge}</span>
          ))}
        </div>
      </Card>
      <Card>
        <h3 className="text-lg font-black">Common patterns</h3>
        <p className="mt-2 text-sm font-bold text-ink/60">Most missing: {state.items.filter((item) => item.status === "missing").map((item) => item.name).join(", ") || "None yet"}</p>
        <p className="mt-1 text-sm font-bold text-ink/60">Most low stock: {state.items.filter((item) => item.status === "running low").map((item) => item.name).join(", ") || "None yet"}</p>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <Card><p className="text-sm font-bold text-ink/60">{label}</p><p className="mt-1 text-3xl font-black">{value}</p></Card>;
}

function FloorTimer({ state, onUpdate }: { state: ShiftState; onUpdate: (mutator: (draft: ShiftState) => ShiftState, action?: string) => void }) {
  const [running, setRunning] = useState(false);
  const [started, setStarted] = useState<number | null>(null);
  const [saved, setSaved] = useState<FloorRun | null>(null);

  return (
    <Card>
      <div className="flex items-center gap-2"><Timer /><h3 className="text-lg font-black">Floor Timer Mode</h3></div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <PillButton onClick={() => { setRunning(true); setStarted(Date.now()); }} className="bg-leaf text-white">Start</PillButton>
        <PillButton
          onClick={() => {
            const minutes = started ? Math.max(1, Math.round((Date.now() - started) / 60000)) : 0;
            const run = { id: crypto.randomUUID(), location: "Floor 6", checklist: ["Coffee", "Cups", "Snacks"], startedAt: new Date(started ?? Date.now()).toISOString(), minutes, notes: "" };
            setSaved(run);
            onUpdate((draft) => ({ ...draft, floorRuns: [run, ...draft.floorRuns], xp: draft.xp + 5 }), "floor-run-save");
            setRunning(false);
          }}
          className="bg-ink text-white"
        >
          Stop
        </PillButton>
      </div>
      <p className="mt-2 text-sm font-bold text-ink/60">{running ? "Timer running" : saved ? `Saved locally: ${saved.minutes} min` : `${state.floorRuns.length} saved runs`}</p>
    </Card>
  );
}
