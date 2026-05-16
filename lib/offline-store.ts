import type { ShiftState } from "@/types/shift";

export type SyncStatus = "Saved locally" | "Sync pending" | "Synced" | "Sync failed";

export interface SyncEvent {
  id: string;
  action: string;
  createdAt: string;
  payload: ShiftState;
}

export class OfflineStore {
  private dbName: string;
  private localKey: string;

  constructor(localKey: string) {
    this.localKey = localKey;
    this.dbName = `${localKey}-db`;
  }

  async load(): Promise<ShiftState | null> {
    const fromIndexedDb = await this.readState();
    if (fromIndexedDb) return fromIndexedDb;
    const raw = localStorage.getItem(this.localKey);
    return raw ? JSON.parse(raw) : null;
  }

  async save(state: ShiftState, action: string) {
    localStorage.setItem(this.localKey, JSON.stringify(state));
    await this.writeState(state);
    await this.enqueue({ id: crypto.randomUUID(), action, createdAt: new Date().toISOString(), payload: state });
  }

  async pending(): Promise<SyncEvent[]> {
    const db = await this.db();
    if (!db) return JSON.parse(localStorage.getItem(`${this.localKey}:pending`) ?? "[]");
    return request<SyncEvent[]>(db.transaction("events", "readonly").objectStore("events").getAll());
  }

  async clearPending(ids: string[]) {
    const db = await this.db();
    if (!db) {
      const events: SyncEvent[] = JSON.parse(localStorage.getItem(`${this.localKey}:pending`) ?? "[]");
      localStorage.setItem(`${this.localKey}:pending`, JSON.stringify(events.filter((event) => !ids.includes(event.id))));
      return;
    }
    const tx = db.transaction("events", "readwrite");
    ids.forEach((id) => tx.objectStore("events").delete(id));
    await transactionDone(tx);
  }

  private async enqueue(event: SyncEvent) {
    const db = await this.db();
    if (!db) {
      const events: SyncEvent[] = JSON.parse(localStorage.getItem(`${this.localKey}:pending`) ?? "[]");
      localStorage.setItem(`${this.localKey}:pending`, JSON.stringify([...events, event]));
      return;
    }
    const tx = db.transaction("events", "readwrite");
    tx.objectStore("events").put(event);
    await transactionDone(tx);
  }

  private async readState() {
    const db = await this.db();
    if (!db) return null;
    return request<ShiftState | undefined>(db.transaction("state", "readonly").objectStore("state").get("current")).then((value) => value ?? null);
  }

  private async writeState(state: ShiftState) {
    const db = await this.db();
    if (!db) return;
    const tx = db.transaction("state", "readwrite");
    tx.objectStore("state").put(state, "current");
    await transactionDone(tx);
  }

  private async db(): Promise<IDBDatabase | null> {
    if (!("indexedDB" in window)) return null;
    return new Promise((resolve) => {
      const open = indexedDB.open(this.dbName, 1);
      open.onupgradeneeded = () => {
        const db = open.result;
        if (!db.objectStoreNames.contains("state")) db.createObjectStore("state");
        if (!db.objectStoreNames.contains("events")) db.createObjectStore("events", { keyPath: "id" });
      };
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => resolve(null);
    });
  }
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function transactionDone(tx: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
