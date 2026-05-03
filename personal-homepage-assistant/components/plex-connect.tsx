"use client";

import { CheckCircle2, LogIn, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

type PinState = {
  id: number;
  code: string;
  authUrl: string;
  expiresAt?: string;
};

export function PlexConnect() {
  const [pin, setPin] = useState<PinState | null>(null);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);

  async function start() {
    setLoading(true);
    setConnected(false);
    setStatus("Creating Plex login code...");
    const response = await fetch("/api/integrations/plex/pin", { method: "POST" });
    const data = await response.json();
    setPin(data);
    setStatus("Open Plex, enter the code, then come back here.");
    setLoading(false);
    window.open(data.authUrl, "_blank", "noopener,noreferrer");
  }

  useEffect(() => {
    if (!pin || connected) return;
    const interval = window.setInterval(async () => {
      const response = await fetch("/api/integrations/plex/pin/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinId: pin.id })
      });
      const data = await response.json();
      if (data.connected) {
        setConnected(true);
        setStatus(`Connected to ${data.server.name}. Refreshing media data...`);
        window.clearInterval(interval);
        window.location.href = "/media?refresh=1";
      }
    }, 3000);
    return () => window.clearInterval(interval);
  }, [pin, connected]);

  return (
    <div className="rounded-2xl border border-ink/10 bg-ink/5 p-4 dark:border-white/10 dark:bg-white/10">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="font-bold">Plex Login</h3>
          <p className="text-sm text-ink/55 dark:text-white/55">Connect with Plex to auto-save the token and discover your server URL.</p>
        </div>
        <button className="btn btn-primary" type="button" onClick={start} disabled={loading}>
          {loading ? <RefreshCw size={16} /> : connected ? <CheckCircle2 size={16} /> : <LogIn size={16} />}
          {loading ? "Starting" : "Connect Plex"}
        </button>
      </div>
      {pin && (
        <div className="mt-4 rounded-xl bg-white/70 p-4 dark:bg-white/10">
          <p className="label">4-character Plex code</p>
          <p className="mt-1 text-3xl font-bold tracking-widest">{pin.code}</p>
          <a className="mt-3 inline-flex text-sm font-semibold text-moss" href={pin.authUrl} target="_blank">Open Plex link page</a>
        </div>
      )}
      {status && <p className="mt-3 text-sm text-ink/60 dark:text-white/60">{status}</p>}
    </div>
  );
}
