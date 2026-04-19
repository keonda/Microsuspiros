import { AIGenerationKind } from "@prisma/client";
import { notFound } from "next/navigation";
import { applyAIGeneration, deleteSong, duplicateSong, generateMetadata, generateSongAI, markSongReady, updateSong } from "@/actions/song-actions";
import { CopyButton } from "@/components/copy-button";
import { PageHeading } from "@/components/page-heading";
import { SongForm } from "@/components/song-form";
import { Pill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { dateLabel } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { songReadiness } from "@/lib/song-readiness";

export const dynamic = "force-dynamic";

export default async function SongDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [song, playlists, logs] = await Promise.all([
    prisma.song.findUnique({ where: { id }, include: { tags: true, playlistSongs: true } }),
    prisma.playlist.findMany({ orderBy: { title: "asc" } }),
    prisma.aIGenerationLog.findMany({ where: { songId: id }, orderBy: { createdAt: "desc" }, take: 12 })
  ]);
  if (!song) notFound();

  const readiness = songReadiness(song);
  const exportPayload = JSON.stringify(
    {
      id: song.id,
      title: song.title,
      slug: song.slug,
      status: song.status,
      mood: song.mood,
      theme: song.theme,
      language: song.language,
      fullLyrics: song.fullLyrics,
      shortVersion: song.shortVersion,
      hookText: song.hookText,
      youtubeTitle: song.youtubeTitle,
      youtubeDescription: song.youtubeDescription,
      websiteExcerpt: song.websiteExcerpt,
      tags: song.tags.map((tag) => tag.name)
    },
    null,
    2
  );

  return (
    <>
      <PageHeading title={song.title} subtitle={`Last updated ${dateLabel(song.updatedAt)} - slug ${song.slug}`} />
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <Card>
          <SongForm song={song} playlists={playlists} action={updateSong.bind(null, song.id)} submitLabel="Save changes" />
        </Card>
        <div className="space-y-6">
          <Card>
            <CardTitle title="Readiness Checklist" eyebrow={readiness.fullyPublishable ? "fully publishable" : "needs attention"} />
            <div className="space-y-2">
              {[
                ["Lyrics", readiness.hasLyrics],
                ["Short version", readiness.hasShortVersion],
                ["YouTube title", readiness.hasYoutubeTitle],
                ["YouTube description", readiness.hasYoutubeDescription],
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

          <Card>
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
              <ExportRow label="JSON payload" value={exportPayload} />
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

function ExportRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-white/5 px-3 py-2">
      <span className="text-sm text-mist/70">{label}</span>
      <CopyButton value={value || ""} />
    </div>
  );
}
