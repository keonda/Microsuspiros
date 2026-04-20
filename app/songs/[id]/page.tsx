import { AIGenerationKind, AssetType, PublishContentType, PublishPlatform, type Asset, type PublishEvent } from "@prisma/client";
import { notFound } from "next/navigation";
import { attachExternalAsset, deleteAsset, logPublishEvent, uploadSongAsset } from "@/actions/asset-actions";
import { applyAIGeneration, deleteSong, duplicateSong, generateMetadata, generateSongAI, markSongReady, updateSong } from "@/actions/song-actions";
import { CopyButton } from "@/components/copy-button";
import { PageHeading } from "@/components/page-heading";
import { SongForm } from "@/components/song-form";
import { Pill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { inputClass } from "@/components/ui/field";
import { dateLabel } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { songReadiness } from "@/lib/song-readiness";
import { formatFileSize, getPublicAssetUrl } from "@/lib/asset-utils";

export const dynamic = "force-dynamic";

export default async function SongDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [song, playlists, logs, publishEvents] = await Promise.all([
    prisma.song.findUnique({ where: { id }, include: { tags: true, playlistSongs: true, assets: { orderBy: { createdAt: "desc" } } } }),
    prisma.playlist.findMany({ orderBy: { title: "asc" } }),
    prisma.aIGenerationLog.findMany({ where: { songId: id }, orderBy: { createdAt: "desc" }, take: 12 }),
    prisma.publishEvent.findMany({ where: { songId: id }, orderBy: { publishedAt: "desc" }, take: 12 })
  ]);
  if (!song) notFound();

  const readiness = songReadiness(song);
  const publishPacket = {
    title: song.title,
    youtubeTitle: song.youtubeTitle,
    youtubeDescription: song.youtubeDescription,
    websiteExcerpt: song.websiteExcerpt,
    shortVersion: song.shortVersion,
    fullLyrics: song.fullLyrics,
    tags: song.tags.map((tag) => tag.name),
    assets: song.assets.map((asset) => ({ type: asset.type, title: asset.title, url: getPublicAssetUrl(asset) }))
  };
  const textBundle = [
    song.title,
    "",
    "Hook:",
    song.hookText || "",
    "",
    "Short version:",
    song.shortVersion || "",
    "",
    "Website excerpt:",
    song.websiteExcerpt || "",
    "",
    "YouTube title:",
    song.youtubeTitle || "",
    "",
    "YouTube description:",
    song.youtubeDescription || "",
    "",
    "Full lyrics:",
    song.fullLyrics || ""
  ].join("\n");

  return (
    <>
      <PageHeading
        title={song.title}
        subtitle={`Last updated ${dateLabel(song.updatedAt)} - slug ${song.slug}`}
        action={<a href="#ai-studio" className="rounded-lg bg-rose px-4 py-2 text-sm font-semibold text-ink hover:bg-rose/90">AI Studio</a>}
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="order-2 space-y-6 xl:order-1">
          <Card>
            <SongForm song={song} playlists={playlists} action={updateSong.bind(null, song.id)} submitLabel="Save changes" />
          </Card>
          <AssetsPanel songId={song.id} assets={song.assets} />
          <PublishingPanel songId={song.id} events={publishEvents} />
        </div>

        <div className="order-1 space-y-6 xl:order-2">
          <Card>
            <CardTitle title="Readiness Checklist" eyebrow={readiness.fullyPublishable ? "fully publishable" : "needs attention"} />
            <div className="space-y-2">
              {[
                ["Lyrics", readiness.hasLyrics],
                ["Short version", readiness.hasShortVersion],
                ["Full audio", readiness.hasFullAudio],
                ["Short audio", readiness.hasShortAudio],
                ["YouTube metadata", readiness.hasYoutubeMetadata],
                ["Website excerpt", readiness.hasExcerpt],
                ["Cover art", readiness.hasCoverArt]
              ].map(([label, ok]) => (
                <div key={String(label)} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-sm">
                  <span className="text-mist/75">{label}</span>
                  <span className={ok ? "text-moss" : "text-rose"}>{ok ? "Ready" : "Missing"}</span>
                </div>
              ))}
            </div>
            {readiness.missing.length ? <div className="mt-3 flex flex-wrap gap-2">{readiness.missing.map((item) => <Pill key={item}>{item}</Pill>)}</div> : null}
          </Card>

          <Card id="ai-studio">
            <CardTitle title="AI Studio" eyebrow="mock now, Groq-ready" />
            <p className="mb-4 text-sm leading-6 text-mist/65">Generate creator-ready drafts, review them below, then apply only the ones that feel right.</p>
            <form action={generateMetadata.bind(null, song.id)}>
              <Button type="submit" className="w-full">Generate all metadata</Button>
            </form>
            <div className="mt-3 grid gap-2">
              {[
                [AIGenerationKind.YOUTUBE_TITLE, "YouTube title"],
                [AIGenerationKind.YOUTUBE_DESCRIPTION, "YouTube description"],
                [AIGenerationKind.SHORT_VERSION, "Suspiro short"],
                [AIGenerationKind.EXCERPT, "Website excerpt"],
                [AIGenerationKind.HOOK_TEXT, "Hook text"],
                [AIGenerationKind.TAGS, "Tags"]
              ].map(([kind, label]) => (
                <form key={kind} action={generateSongAI.bind(null, song.id, kind as AIGenerationKind)}>
                  <Button type="submit" variant="secondary" className="w-full">{label}</Button>
                </form>
              ))}
            </div>
            <div className="mt-4 space-y-2 text-xs text-mist/55">
              <p>YouTube title: {song.youtubeTitle?.length ?? 0}/100</p>
              <p>Description: {song.youtubeDescription?.length ?? 0} characters</p>
            </div>
          </Card>

          <Card>
            <CardTitle title="Quick Actions" />
            <div className="grid gap-2">
              <form action={markSongReady.bind(null, song.id)}>
                <Button type="submit" variant="secondary" className="w-full" disabled={!readiness.readyForYoutube && !readiness.readyForWebsite}>Mark as ready</Button>
              </form>
              <form action={duplicateSong.bind(null, song.id)}><Button type="submit" variant="secondary" className="w-full">Duplicate song</Button></form>
              <form action={deleteSong.bind(null, song.id)}><Button type="submit" variant="danger" className="w-full">Delete song</Button></form>
            </div>
          </Card>

          <Card>
            <CardTitle title="Export Tools" />
            <div className="grid gap-2">
              <ExportRow label="YouTube title" value={song.youtubeTitle} />
              <ExportRow label="YouTube description" value={song.youtubeDescription} />
              <ExportRow label="Website excerpt" value={song.websiteExcerpt} />
              <ExportRow label="Short version" value={song.shortVersion} />
              <ExportRow label="Full lyrics" value={song.fullLyrics} />
              <ExportRow label="Text bundle" value={textBundle} />
              <ExportRow label="Publish packet JSON" value={JSON.stringify(publishPacket, null, 2)} />
            </div>
          </Card>

          <Card>
            <CardTitle title="AI History" />
            {logs.length ? (
              <div className="space-y-3">
                {logs.map((log) => (
                  <div key={log.id} className="rounded-lg bg-white/5 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold text-gold">{log.kind.replaceAll("_", " ")} - {log.provider}</p>
                        <p className="mt-1 text-xs text-mist/55">{dateLabel(log.createdAt)} {log.accepted ? "- accepted" : ""}</p>
                      </div>
                      <CopyButton value={log.result} />
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-mist/75">{log.result}</p>
                    <form action={applyAIGeneration.bind(null, log.id)} className="mt-3">
                      <Button type="submit" variant="secondary">Use this</Button>
                    </form>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-mist/60">No generated drafts yet.</p>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

type SongAsset = Asset;
type PublishItem = PublishEvent;

function AssetsPanel({ songId, assets }: { songId: string; assets: SongAsset[] }) {
  return (
    <Card>
      <CardTitle title="Assets" eyebrow={`${assets.length} attached`} />
      <div className="grid gap-4 xl:grid-cols-2">
        <form action={uploadSongAsset.bind(null, songId)} className="space-y-3 rounded-lg bg-white/5 p-4">
          <p className="text-sm font-semibold text-white">Upload file</p>
          <select name="type" className={inputClass()} defaultValue={AssetType.COVER_ART}>
            {Object.values(AssetType).map((type) => <option key={type} value={type}>{type.replaceAll("_", " ")}</option>)}
          </select>
          <input name="title" className={inputClass()} placeholder="Cover art, full mix, short audio..." />
          <input name="file" type="file" className={inputClass()} />
          <textarea name="notes" rows={2} className={inputClass()} placeholder="Notes" />
          <label className="flex items-center gap-2 text-sm text-mist/70"><input name="isPrimary" type="checkbox" /> Primary for this type</label>
          <Button type="submit">Upload asset</Button>
        </form>
        <form action={attachExternalAsset.bind(null, songId)} className="space-y-3 rounded-lg bg-white/5 p-4">
          <p className="text-sm font-semibold text-white">Attach external URL</p>
          <select name="type" className={inputClass()} defaultValue={AssetType.OTHER}>
            {Object.values(AssetType).map((type) => <option key={type} value={type}>{type.replaceAll("_", " ")}</option>)}
          </select>
          <input name="title" className={inputClass()} placeholder="SoundCloud master, Drive video..." />
          <input name="url" type="url" className={inputClass()} placeholder="https://..." />
          <textarea name="notes" rows={2} className={inputClass()} placeholder="Notes" />
          <label className="flex items-center gap-2 text-sm text-mist/70"><input name="isPrimary" type="checkbox" /> Primary for this type</label>
          <Button type="submit" variant="secondary">Attach URL</Button>
        </form>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {assets.length ? assets.map((asset) => <AssetCard key={asset.id} asset={asset} />) : <p className="rounded-lg bg-white/5 p-4 text-sm text-mist/60">No assets yet. Add cover art, audio, video, or reference links here.</p>}
      </div>
    </Card>
  );
}

function AssetCard({ asset }: { asset: SongAsset }) {
  const url = getPublicAssetUrl(asset);
  return (
    <div className="rounded-lg border border-white/10 bg-ink/35 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-white">{asset.title}</p>
          <p className="mt-1 text-xs text-gold">{asset.type.replaceAll("_", " ")} {asset.isPrimary ? "- primary" : ""}</p>
          <p className="mt-1 text-xs text-mist/50">{asset.fileName || asset.url || "Stored asset"} - {formatFileSize(asset.fileSize)}</p>
        </div>
        <form action={deleteAsset.bind(null, asset.id)}>
          <Button type="submit" variant="danger">Delete</Button>
        </form>
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

function PublishingPanel({ songId, events }: { songId: string; events: PublishItem[] }) {
  return (
    <Card>
      <CardTitle title="Publish History" eyebrow={`${events.length} events`} />
      <form action={logPublishEvent.bind(null, songId)} className="grid gap-3 rounded-lg bg-white/5 p-4 md:grid-cols-2">
        <select name="platform" className={inputClass()} defaultValue={PublishPlatform.YOUTUBE}>
          {Object.values(PublishPlatform).map((platform) => <option key={platform} value={platform}>{platform}</option>)}
        </select>
        <select name="contentType" className={inputClass()} defaultValue={PublishContentType.SHORT}>
          {Object.values(PublishContentType).map((type) => <option key={type} value={type}>{type.replaceAll("_", " ")}</option>)}
        </select>
        <input name="publishedAt" type="datetime-local" className={inputClass()} />
        <input name="url" type="url" className={inputClass()} placeholder="https://..." />
        <textarea name="notes" rows={2} className={inputClass("md:col-span-2")} placeholder="Notes" />
        <Button type="submit">Log publish event</Button>
      </form>
      <div className="mt-5 space-y-3">
        {events.length ? events.map((event) => (
          <div key={event.id} className="rounded-lg bg-white/5 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-white">{event.platform} - {event.contentType.replaceAll("_", " ")}</p>
              <p className="text-xs text-mist/50">{dateLabel(event.publishedAt)}</p>
            </div>
            {event.url ? <a href={event.url} target="_blank" className="mt-2 inline-block text-sm text-rose hover:text-rose/80">{event.url}</a> : null}
            {event.notes ? <p className="mt-2 text-sm text-mist/60">{event.notes}</p> : null}
          </div>
        )) : <p className="rounded-lg bg-white/5 p-4 text-sm text-mist/60">No publish events yet.</p>}
      </div>
    </Card>
  );
}

function ExportRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-white/5 px-3 py-2">
      <span className="text-sm text-mist/70">{label}</span>
      <CopyButton value={value || ""} />
    </div>
  );
}
