import Link from "next/link";
import { SongStatus } from "@prisma/client";
import { bulkSongAction } from "@/actions/song-actions";
import { PageHeading } from "@/components/page-heading";
import { StatusBadge, Pill } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { inputClass } from "@/components/ui/field";
import { buildSongWhere, getSongFilters } from "@/lib/data";
import { dateLabel, yesNo } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function SongsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const [filters, songs] = await Promise.all([
    getSongFilters(),
    prisma.song.findMany({
      where: buildSongWhere(params),
      orderBy: { updatedAt: "desc" },
      include: { tags: true, playlistSongs: true }
    })
  ]);

  return (
    <>
      <PageHeading
        title="Songs"
        subtitle="Search, filter, and tend the whole MicroSuspiros catalog."
        action={<Link href="/songs/new" className="rounded-lg bg-rose px-4 py-2 text-sm font-semibold text-ink">New Song</Link>}
      />
      <Card className="mb-5">
        <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <input name="q" defaultValue={typeof params.q === "string" ? params.q : ""} className={inputClass()} placeholder="Search title, tag, mood..." />
          <select name="status" defaultValue={typeof params.status === "string" ? params.status : ""} className={inputClass()}>
            <option value="">Any status</option>
            {Object.values(SongStatus).map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}
          </select>
          <Select name="mood" value={params.mood} label="Any mood" options={filters.moods} />
          <Select name="theme" value={params.theme} label="Any theme" options={filters.themes} />
          <Select name="language" value={params.language} label="Any language" options={filters.languages} />
          <BoolSelect name="publishedYoutube" value={params.publishedYoutube} label="YouTube" />
          <BoolSelect name="publishedWebsite" value={params.publishedWebsite} label="Website" />
          <BoolSelect name="hasCoverArt" value={params.hasCoverArt} label="Cover art" />
          <button className="rounded-lg bg-rose px-4 py-2 text-sm font-semibold text-ink">Apply filters</button>
          <Link href="/songs" className="rounded-lg bg-white/8 px-4 py-2 text-center text-sm font-semibold text-mist ring-1 ring-white/10">Clear</Link>
        </form>
      </Card>

      <Card>
        {songs.length ? (
          <form action={bulkSongAction}>
            <div className="mb-4 grid gap-3 rounded-lg border border-white/10 bg-ink/35 p-3 md:grid-cols-[1fr_1fr_auto]">
              <select name="bulkAction" className={inputClass()} defaultValue="READY">
                <option value="READY">Mark READY</option>
                <option value="ARCHIVED">Mark ARCHIVED</option>
                <option value="PUBLISHED_YOUTUBE">Mark published on YouTube</option>
                <option value="PUBLISHED_WEBSITE">Mark published on website</option>
                <option value="GENERATE_METADATA">Generate metadata drafts</option>
                <option value="ADD_TAG">Add tag</option>
              </select>
              <input name="bulkTag" className={inputClass()} placeholder="Optional tag for Add tag" />
              <button className="rounded-lg bg-rose px-4 py-2 text-sm font-semibold text-ink">Apply to selected</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-left text-sm">
                <thead className="text-xs uppercase tracking-[0.12em] text-mist/45">
                  <tr className="border-b border-white/10">
                    <th className="py-3 pr-4">Select</th>
                    <th className="py-3 pr-4">Song</th>
                    <th className="py-3 pr-4">Status</th>
                    <th className="py-3 pr-4">Mood</th>
                    <th className="py-3 pr-4">Theme</th>
                    <th className="py-3 pr-4">Assets</th>
                    <th className="py-3 pr-4">Published</th>
                    <th className="py-3">Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {songs.map((song) => (
                    <tr key={song.id}>
                      <td className="py-4 pr-4"><input type="checkbox" name="songIds" value={song.id} /></td>
                      <td className="py-4 pr-4">
                        <Link href={`/songs/${song.id}`} className="font-medium text-white hover:text-rose">{song.title}</Link>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {song.tags.map((tag) => <Pill key={tag.id}>{tag.name}</Pill>)}
                        </div>
                      </td>
                      <td className="py-4 pr-4"><StatusBadge status={song.status} /></td>
                      <td className="py-4 pr-4 text-mist/70">{song.mood || "-"}</td>
                      <td className="py-4 pr-4 text-mist/70">{song.theme || "-"}</td>
                      <td className="py-4 pr-4 text-mist/70">Cover {yesNo(song.hasCoverArt)} - Short {yesNo(song.hasShortVersion)}</td>
                      <td className="py-4 pr-4 text-mist/70">YT {yesNo(song.publishedYoutube)} - Web {yesNo(song.publishedWebsite)}</td>
                      <td className="py-4 text-mist/60">{dateLabel(song.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </form>
        ) : (
          <p className="rounded-lg bg-white/5 p-5 text-sm text-mist/65">No songs match this view. The silence is clean, at least.</p>
        )}
      </Card>
    </>
  );
}

function Select({ name, value, label, options }: { name: string; value: unknown; label: string; options: string[] }) {
  return (
    <select name={name} defaultValue={typeof value === "string" ? value : ""} className={inputClass()}>
      <option value="">{label}</option>
      {options.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
  );
}

function BoolSelect({ name, value, label }: { name: string; value: unknown; label: string }) {
  return (
    <select name={name} defaultValue={typeof value === "string" ? value : ""} className={inputClass()}>
      <option value="">{label}: any</option>
      <option value="true">{label}: yes</option>
      <option value="false">{label}: no</option>
    </select>
  );
}
