"use client";

import { AssetType, type Asset } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { CardTitle } from "@/components/ui/card";
import { formatFileSize, getPublicAssetUrl } from "@/lib/asset-utils";

type AssetWithUrl = Asset & { publicUrl?: string };

export function AssetManager({ songId, initialAssets }: { songId: string; initialAssets: AssetWithUrl[] }) {
  const [assets, setAssets] = useState(initialAssets);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const uploadForm = useRef<HTMLFormElement>(null);
  const externalForm = useRef<HTMLFormElement>(null);
  const router = useRouter();

  async function submitAsset(form: HTMLFormElement | null) {
    if (!form) return;
    setError("");
    const response = await fetch(`/api/songs/${songId}/assets`, {
      method: "POST",
      body: new FormData(form),
      headers: {
        Accept: "application/json",
        "X-Requested-With": "fetch"
      }
    });
    const payload = (await response.json()) as { ok: boolean; error?: string; asset?: AssetWithUrl };
    if (!response.ok || !payload.ok) {
      setError(payload.error || "Upload failed.");
      return;
    }
    if (payload.asset) {
      setAssets((current) => [payload.asset!, ...current.filter((asset) => asset.id !== payload.asset!.id)]);
    }
    form.reset();
    startTransition(() => router.refresh());
  }

  async function removeAsset(assetId: string) {
    setError("");
    const response = await fetch(`/api/assets/${assetId}/delete`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "X-Requested-With": "fetch"
      }
    });
    if (!response.ok) {
      setError("Could not delete that asset.");
      return;
    }
    setAssets((current) => current.filter((asset) => asset.id !== assetId));
    startTransition(() => router.refresh());
  }

  return (
    <div>
      <CardTitle title="Assets" eyebrow={`${assets.length} attached`} />
      {error ? <p className="mb-4 rounded-lg bg-red-500/12 p-3 text-sm text-red-100 ring-1 ring-red-300/20">{error}</p> : null}
      {isPending ? <p className="mb-4 text-sm text-mist/55">Refreshing asset state...</p> : null}
      <div className="grid gap-4 xl:grid-cols-2">
        <form ref={uploadForm} onSubmit={(event) => { event.preventDefault(); void submitAsset(uploadForm.current); }} className="space-y-3 rounded-lg bg-white/5 p-4">
          <input type="hidden" name="mode" value="upload" />
          <p className="text-sm font-semibold text-white">Upload file</p>
          <AssetTypeSelect defaultValue={AssetType.COVER_ART} />
          <input name="title" className={inputClass()} placeholder="Cover art, full mix, short audio..." />
          <input name="file" type="file" className={inputClass()} />
          <textarea name="notes" rows={2} className={inputClass()} placeholder="Notes" />
          <label className="flex items-center gap-2 text-sm text-mist/70"><input name="isPrimary" type="checkbox" /> Primary for this type</label>
          <Button type="submit">Upload asset</Button>
        </form>
        <form ref={externalForm} onSubmit={(event) => { event.preventDefault(); void submitAsset(externalForm.current); }} className="space-y-3 rounded-lg bg-white/5 p-4">
          <input type="hidden" name="mode" value="external" />
          <p className="text-sm font-semibold text-white">Attach external URL</p>
          <AssetTypeSelect defaultValue={AssetType.OTHER} />
          <input name="title" className={inputClass()} placeholder="SoundCloud master, Drive video..." />
          <input name="url" type="url" className={inputClass()} placeholder="https://..." />
          <textarea name="notes" rows={2} className={inputClass()} placeholder="Notes" />
          <label className="flex items-center gap-2 text-sm text-mist/70"><input name="isPrimary" type="checkbox" /> Primary for this type</label>
          <Button type="submit" variant="secondary">Attach URL</Button>
        </form>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {assets.length ? assets.map((asset) => <AssetCard key={asset.id} asset={asset} onDelete={removeAsset} />) : <p className="rounded-lg bg-white/5 p-4 text-sm text-mist/60">No assets yet. Add cover art, audio, video, or reference links here.</p>}
      </div>
    </div>
  );
}

function AssetTypeSelect({ defaultValue }: { defaultValue: AssetType }) {
  return (
    <select name="type" className={inputClass()} defaultValue={defaultValue}>
      {Object.values(AssetType).map((type) => <option key={type} value={type}>{type.replaceAll("_", " ")}</option>)}
    </select>
  );
}

function AssetCard({ asset, onDelete }: { asset: AssetWithUrl; onDelete: (assetId: string) => Promise<void> }) {
  const url = asset.publicUrl || getPublicAssetUrl(asset);
  return (
    <div className="rounded-lg border border-white/10 bg-ink/35 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-white">{asset.title}</p>
          <p className="mt-1 text-xs text-gold">{asset.type.replaceAll("_", " ")} {asset.isPrimary ? "- primary" : ""}</p>
          <p className="mt-1 text-xs text-mist/50">{asset.fileName || asset.url || "Stored asset"} - {formatFileSize(asset.fileSize)}</p>
        </div>
        <Button type="button" variant="danger" onClick={() => void onDelete(asset.id)}>Delete</Button>
      </div>
      {asset.type === AssetType.COVER_ART && url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={asset.title} className="mt-3 max-h-56 w-full rounded-lg object-cover" />
      ) : null}
      {(asset.type === AssetType.AUDIO_FULL || asset.type === AssetType.AUDIO_SHORT) && url ? <audio src={url} controls className="mt-3 w-full" /> : null}
      {url ? <a href={url} target="_blank" className="mt-3 inline-block text-sm text-rose hover:text-rose/80">Open asset</a> : null}
      {asset.notes ? <p className="mt-2 text-sm text-mist/60">{asset.notes}</p> : null}
    </div>
  );
}
