import Link from "next/link";
import { PublishContentType, PublishPlatform, ScheduledReleaseStatus, type Prisma } from "@prisma/client";
import { markScheduledReleasePublished, scheduleRelease } from "@/actions/release-actions";
import { PageHeading } from "@/components/page-heading";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { inputClass } from "@/components/ui/field";
import { dateLabel } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function CalendarPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const [releases, songs, playlists, campaigns] = await Promise.all([
    prisma.scheduledRelease.findMany({
      where: {
        platform: params.platform ? params.platform as PublishPlatform : undefined,
        status: params.status ? params.status as ScheduledReleaseStatus : undefined,
        contentType: params.contentType ? params.contentType as PublishContentType : undefined
      },
      orderBy: [{ scheduledFor: "asc" }, { createdAt: "desc" }],
      include: { song: true, playlist: true, campaign: true }
    }),
    prisma.song.findMany({ orderBy: { title: "asc" }, select: { id: true, title: true } }),
    prisma.playlist.findMany({ orderBy: { title: "asc" }, select: { id: true, title: true } }),
    prisma.releaseCampaign.findMany({ orderBy: { title: "asc" }, select: { id: true, title: true } })
  ]);
  const now = new Date();
  const upcoming = releases.filter((release) => release.scheduledFor && release.scheduledFor >= now && release.status !== "PUBLISHED");
  const overdue = releases.filter((release) => release.scheduledFor && release.scheduledFor < now && release.status !== "PUBLISHED" && release.status !== "CANCELED");
  const published = releases.filter((release) => release.status === "PUBLISHED").slice(0, 12);

  return (
    <>
      <PageHeading title="Release Calendar" subtitle="Manual planning for shorts, full songs, website posts, and campaign moments." />
      <Card className="mb-6">
        <form className="grid gap-3 md:grid-cols-4">
          <FilterSelect name="platform" value={params.platform} options={Object.values(PublishPlatform)} label="All platforms" />
          <FilterSelect name="status" value={params.status} options={Object.values(ScheduledReleaseStatus)} label="All statuses" />
          <FilterSelect name="contentType" value={params.contentType} options={Object.values(PublishContentType)} label="All content" />
          <button className="rounded-lg bg-rose px-4 py-2 text-sm font-semibold text-ink">Filter</button>
        </form>
      </Card>
      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <Card>
          <CardTitle title="Schedule Release" />
          <form action={scheduleRelease} className="space-y-3">
            <input name="title" required className={inputClass()} placeholder="Friday short - Donde Duerme..." />
            <input name="scheduledFor" type="datetime-local" className={inputClass()} />
            <select name="platform" className={inputClass()} defaultValue={PublishPlatform.YOUTUBE}>{Object.values(PublishPlatform).map((item) => <option key={item} value={item}>{item}</option>)}</select>
            <select name="contentType" className={inputClass()} defaultValue={PublishContentType.SHORT}>{Object.values(PublishContentType).map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}</select>
            <select name="status" className={inputClass()} defaultValue={ScheduledReleaseStatus.PLANNED}>{Object.values(ScheduledReleaseStatus).map((item) => <option key={item} value={item}>{item}</option>)}</select>
            <select name="songId" className={inputClass()} defaultValue=""><option value="">No song</option>{songs.map((song) => <option key={song.id} value={song.id}>{song.title}</option>)}</select>
            <select name="playlistId" className={inputClass()} defaultValue=""><option value="">No playlist</option>{playlists.map((playlist) => <option key={playlist.id} value={playlist.id}>{playlist.title}</option>)}</select>
            <select name="campaignId" className={inputClass()} defaultValue=""><option value="">No campaign</option>{campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.title}</option>)}</select>
            <textarea name="notes" rows={3} className={inputClass()} placeholder="Notes" />
            <Button type="submit">Add to calendar</Button>
          </form>
        </Card>
        <div className="space-y-6">
          <ReleaseGroup title="Overdue" releases={overdue} />
          <ReleaseGroup title="Upcoming" releases={upcoming} />
          <ReleaseGroup title="Recently Published" releases={published} />
        </div>
      </div>
    </>
  );
}

function FilterSelect({ name, value, options, label }: { name: string; value?: string; options: string[]; label: string }) {
  return (
    <select name={name} defaultValue={value || ""} className={inputClass()}>
      <option value="">{label}</option>
      {options.map((option) => <option key={option} value={option}>{option.replaceAll("_", " ")}</option>)}
    </select>
  );
}

type CalendarRelease = Prisma.ScheduledReleaseGetPayload<{ include: { song: true; playlist: true; campaign: true } }>;

function ReleaseGroup({ title, releases }: { title: string; releases: CalendarRelease[] }) {
  return (
    <Card>
      <CardTitle title={title} eyebrow={`${releases.length} items`} />
      <div className="space-y-3">
        {releases.length ? releases.map((release) => (
          <div key={release.id} className="rounded-lg bg-white/5 p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium text-white">{release.title}</p>
                <p className="text-sm text-mist/55">{release.platform} - {release.contentType.replaceAll("_", " ")} - {release.scheduledFor ? dateLabel(release.scheduledFor) : "unscheduled"}</p>
                {release.song ? <Link href={`/songs/${release.songId}`} className="text-sm text-rose">{release.song.title}</Link> : null}
                {release.campaign ? <Link href={`/campaigns/${release.campaignId}`} className="ml-3 text-sm text-gold">{release.campaign.title}</Link> : null}
              </div>
              <span className="rounded-full bg-white/8 px-3 py-1 text-xs text-mist ring-1 ring-white/10">{release.status}</span>
            </div>
            {release.status !== "PUBLISHED" ? <form action={markScheduledReleasePublished.bind(null, release.id)} className="mt-3"><Button type="submit" variant="secondary">Mark published</Button></form> : null}
          </div>
        )) : <p className="rounded-lg bg-white/5 p-4 text-sm text-mist/60">Nothing here yet.</p>}
      </div>
    </Card>
  );
}
