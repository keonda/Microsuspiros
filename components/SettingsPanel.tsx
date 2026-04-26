"use client";

import { useState } from "react";
import { ThemeBoot } from "@/components/ThemeBoot";

type Preferences = { theme: string; focusMode: boolean; editorMode: string };
type AiSettings = { hasGroqKey: boolean; keyLastFour: string | null; groqModel: string };

export function SettingsPanel({ preferences, aiSettings }: { preferences: Preferences; aiSettings: AiSettings }) {
  const [prefs, setPrefs] = useState(preferences);
  const [ai, setAi] = useState(aiSettings);
  const [apiKey, setApiKey] = useState("");
  const [message, setMessage] = useState("");

  async function savePrefs(patch: Partial<Preferences>) {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    await fetch("/api/settings/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch)
    });
  }

  async function saveGroq() {
    setMessage("Saving...");
    const response = await fetch("/api/settings/groq", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: apiKey || undefined, model: ai.groqModel })
    });
    const data = await response.json();
    setMessage(response.ok ? "Groq settings saved." : data.error);
    if (response.ok) {
      setAi(data.settings);
      setApiKey("");
    }
  }

  async function testGroq() {
    setMessage("Testing Groq...");
    const response = await fetch("/api/settings/groq", { method: "POST" });
    const data = await response.json();
    setMessage(response.ok ? "Groq connection works." : data.error);
  }

  async function deleteGroq() {
    await fetch("/api/settings/groq", { method: "DELETE" });
    setAi((current) => ({ ...current, hasGroqKey: false, keyLastFour: null }));
    setMessage("Groq key deleted.");
  }

  return (
    <div className="mt-6 space-y-6">
      <ThemeBoot theme={prefs.theme} />
      <section className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-lg font-semibold">Preferences</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <label className="text-sm">
            <span className="text-zinc-500">Theme</span>
            <select value={prefs.theme} onChange={(event) => savePrefs({ theme: event.target.value })} className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950">
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="text-zinc-500">Editor</span>
            <select value={prefs.editorMode} onChange={(event) => savePrefs({ editorMode: event.target.value })} className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950">
              <option value="split">Split</option>
              <option value="edit">Edit</option>
              <option value="preview">Preview</option>
            </select>
          </label>
          <label className="flex items-end gap-2 text-sm">
            <input type="checkbox" checked={prefs.focusMode} onChange={(event) => savePrefs({ focusMode: event.target.checked })} />
            Start in focus mode
          </label>
        </div>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-lg font-semibold">Groq API key</h2>
        <p className="mt-1 text-sm text-zinc-500">
          {ai.hasGroqKey ? `A key ending in ${ai.keyLastFour} is stored encrypted. It is never sent back to the browser.` : "No key saved yet."}
        </p>
        <div className="mt-4 grid gap-4">
          <input value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="Paste a Groq API key to save or replace" type="password" className="rounded-md border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950" />
          <input value={ai.groqModel} onChange={(event) => setAi((current) => ({ ...current, groqModel: event.target.value }))} className="rounded-md border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950" />
          <div className="flex flex-wrap gap-2">
            <button onClick={saveGroq} className="rounded-md bg-ink px-4 py-2 text-white dark:bg-zinc-100 dark:text-zinc-950">Save</button>
            <button onClick={testGroq} className="rounded-md border border-zinc-300 px-4 py-2 dark:border-zinc-700">Test connection</button>
            <button onClick={deleteGroq} className="rounded-md border border-red-300 px-4 py-2 text-red-700 dark:border-red-900 dark:text-red-300">Delete key</button>
          </div>
          {message ? <p className="text-sm text-zinc-600 dark:text-zinc-300">{message}</p> : null}
        </div>
      </section>
    </div>
  );
}
