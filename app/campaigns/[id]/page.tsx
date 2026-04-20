import { CampaignItemType, PublishContentType, PublishPlatform, ReleaseCampaignGoal, ReleaseCampaignStatus, ScheduledReleaseStatus } from "@prisma/client";
import { notFound } from "next/navigation";
import { addCampaignItem, markScheduledReleasePublished, scheduleRelease, updateCampaign } from "@/actions/release-actions";
import { CopyButton } from "@/components/copy-button";
import { PageHeading } from "@/components/page-heading";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { inputClass } from "@/components/ui/field";
import { dateLabel } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [campaign, songs, playlists] = await Promise.all([
    prisma.releaseCampaign.findUnique({
      where: { id },
      include: {
        items: { include: { song: true, playlist: true }, orderBy: [{ priority: "desc" }, { createdAt: "asc" }] },
        scheduledReleases: { include: { song: true, playlist: true }, orderBy: { scheduledFor: "asc" } }
      }
    }),
    prisma.song.findMany({ orderBy: { title: "asc" }, select: { id: true, title: true } }),
    prisma.playlist.findMany({ orderBy: { title: "asc" }, select: { id: true, title: true } })
  ]);
  if (!campaign) notFound();

  const packet = JSON.stringify({
    title: campaign.title,
    status: campaign.status,
    goal: campaign.goal,
    items: campaign.items.map((item) => ({ type: item.itemType, title: item.title || item.song?.title || item.playlist?.title, priority: item.priority })),
    schedule: campaign.scheduledReleases.map((release) => ({ title: release.title, platform: release.platform, contentType: release.contentType, scheduledFor: release.scheduledFor }))
  }, null, 2);

  return (
    <>
      <PageHeading title={campaign.title} subtitle={`${campaign.goal.replaceAll("_", " ")} - ${campaign.status}`} action={<CopyButton value={packet} label="Copy JSON" />} />
      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <div className="space-y-6">
          <Card>
            <CardTitle title="Campaign Overview" />
            <form action={updateCampaign.bind(null, campaign.id)} className="space-y-3">
              <input name="title" required defaultValue={campaign.title} className={inputClass()} />
              <select name="status" defaultValue={campaign.status} className={inputClass()}>{Object.values(ReleaseCampaignStatus).map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}</select>
              <select name="goal" defaultValue={campaign.goal} className={inputClass()}>{Object.values(ReleaseCampaignGoal).map((goal) => <option key={goal} value={goal}>{goal.replaceAll("_", " ")}</option>)}</select>
              <input name="startDate" type="date" defaultValue={campaign.startDate?.toISOString().slice(0, 10)} className={inputClass()} />
              <input name="endDate" type="date" defaultValue={campaign.endDate?.toISOString().slice(0, 10)} className={inputClass()} />
              <textarea name="description" defaultValue={campaign.description || ""} rows={3} className={inputClass()} />
              <textarea name="notes" defaultValue={campaign.notes || ""} rows={3} className={inputClass()} />
              <Button type="submit">Save campaign</Button>
            </form>
          </Card>
          <Card>
            <CardTitle title="Add Item" />
            <form action={addCampaignItem.bind(null, campaign.id)} className="space-y-3">
              <select name="itemType" className={inputClass()} defaultValue={CampaignItemType.SONG}>{Object.values(CampaignItemType).map((type) => <option key={type} value={type}>{type.replaceAll("_", " ")}</option>)}</select>
              <select name="songId" className={inputClass()} defaultValue=""><option value="">No song</option>{songs.map((song) => <option key={song.id} value={song.id}>{song.title}</option>)}</select>
              <select name="playlistId" className={inputClass()} defaultValue=""><option value="">No playlist</option>{playlists.map((playlist) => <option key={playlist.id} value={playlist.id}>{playlist.title}</option>)}</select>
              <input name="title" className={inputClass()} placeholder="Custom item title" />
              <input name="priority" type="number" className={inputClass()} placeholder="Priority" />
              <textarea name="notes" rows={2} className={inputClass()} placeholder="Notes" />
              <Button type="submit" variant="secondary">Add item</Button>
            </form>
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <CardTitle title="Campaign Items" eyebrow={`${campaign.items.length} items`} />
            <div className="space-y-3">
              {campaign.items.length ? campaign.items.map((item) => (
                <div key={item.id} className="rounded-lg bg-white/5 p-3">
                  <p className="font-medium text-white">{item.title || item.song?.title || item.playlist?.title || "Untitled item"}</p>
                  <p className="text-xs text-gold">{item.itemType.replaceAll("_", " ")} - priority {item.priority}</p>
                  {item.notes ? <p className="mt-2 text-sm text-mist/60">{item.notes}</p> : null}
                </div>
              )) : <p className="text-sm text-mist/60">No campaign items yet.</p>}
            </div>
          </Card>
          <Card>
            <CardTitle title="Schedule" eyebrow={`${campaign.scheduledReleases.length} releases`} />
            <ScheduleForm campaignId={campaign.id} songs={songs} playlists={playlists} />
            <ReleaseList releases={campaign.scheduledReleases} />
          </Card>
        </div>
      </div>
    </>
  );
}

function ScheduleForm({ campaignId, songs, playlists }: { campaignId: string; songs: Array<{ id: string; title: string }>; playlists: Array<{ id: string; title: string }> }) {
  return (
    <form action={scheduleRelease} className="mb-4 grid gap-3 rounded-lg bg-white/5 p-4 md:grid-cols-2">
      <input type="hidden" name="campaignId" value={campaignId} />
      <input name="title" required className={inputClass()} placeholder="Release title" />
      <input name="scheduledFor" type="datetime-local" className={inputClass()} />
      <select name="platform" className={inputClass()} defaultValue={PublishPlatform.YOUTUBE}>{Object.values(PublishPlatform).map((platform) => <option key={platform} value={platform}>{platform}</option>)}</select>
      <select name="contentType" className={inputClass()} defaultValue={PublishContentType.SHORT}>{Object.values(PublishContentType).map((type) => <option key={type} value={type}>{type.replaceAll("_", " ")}</option>)}</select>
      <select name="status" className={inputClass()} defaultValue={ScheduledReleaseStatus.PLANNED}>{Object.values(ScheduledReleaseStatus).map((status) => <option key={status} value={status}>{status}</option>)}</select>
      <select name="songId" className={inputClass()} defaultValue=""><option value="">No song</option>{songs.map((song) => <option key={song.id} value={song.id}>{song.title}</option>)}</select>
      <select name="playlistId" className={inputClass()} defaultValue=""><option value="">No playlist</option>{playlists.map((playlist) => <option key={playlist.id} value={playlist.id}>{playlist.title}</option>)}</select>
      <Button type="submit">Schedule</Button>
    </form>
  );
}

function ReleaseList({ releases }: { releases: Array<{ id: string; title: string; status: ScheduledReleaseStatus; platform: PublishPlatform; contentType: PublishContentType; scheduledFor: Date | null; song?: { title: string } | null; playlist?: { title: string } | null }> }) {
  return (
    <div className="space-y-3">
      {releases.length ? releases.map((release) => (
        <div key={release.id} className="rounded-lg bg-white/5 p-3">
          <p className="font-medium text-white">{release.title}</p>
          <p className="text-sm text-mist/55">{release.platform} - {release.contentType.replaceAll("_", " ")} - {release.scheduledFor ? dateLabel(release.scheduledFor) : "unscheduled"}</p>
          <p className="text-xs text-gold">{release.status}</p>
          {release.status !== "PUBLISHED" ? <form action={markScheduledReleasePublished.bind(null, release.id)} className="mt-2"><Button type="submit" variant="secondary">Mark published</Button></form> : null}
        </div>
      )) : <p className="text-sm text-mist/60">No scheduled releases yet.</p>}
    </div>
  );
}
