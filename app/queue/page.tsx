import Link from "next/link";
import { bulkQueueAction } from "@/actions/release-actions";
import { PageHeading } from "@/components/page-heading";
import { StatusBadge, Pill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { inputClass } from "@/components/ui/field";
import { prisma } from "@/lib/prisma";
import { buildReleaseQueue } from "@/lib/release-queue";

export const dynamic = "force-dynamic";

export default async function QueuePage() {
  const [songs, campaigns] = await Promise.all([
    prisma.song.findMany({
      orderBy: { updatedAt: "desc" },
      include: { assets: true, publishEvents: true, scheduledReleases: true, campaignItems: true, aiGenerationLogs: true, playlistSongs: true }
    }),
    prisma.releaseCampaign.findMany({ orderBy: { title: "asc" }, select: { id: true, title: true } })
  ]);
  const queue = buildReleaseQueue(songs);

  return (
    <>
      <PageHeading title="Release Queue" subtitle="Rule-based next-best moves for songs, shorts, campaigns, and publishing." />
      <Card className="mb-6">
        <form action={bulkQueueAction} className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <select name="bulkAction" className={inputClass()} defaultValue="ADD_TO_CAMPAIGN">
            <option value="ADD_TO_CAMPAIGN">Add selected to campaign</option>
            <option value="SCHEDULE_SHORTS">Create planned shorts</option>
            <option value="READY">Mark READY</option>
            <option value="ARCHIVED">Archive</option>
          </select>
          <select name="campaignId" className={inputClass()} defaultValue=""><option value="">Choose campaign</option>{campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.title}</option>)}</select>
          <Button type="submit">Apply</Button>
          <QueueList items={queue.items.slice(0, 20)} selectable />
        </form>
      </Card>
      <div className="grid gap-6 xl:grid-cols-2">
        <QueueCard title="Ready Now" items={queue.readyNow.slice(0, 8)} />
        <QueueCard title="Nearly Ready" items={queue.nearlyReady.slice(0, 8)} />
        <QueueCard title="Best For Shorts" items={queue.bestForShorts.slice(0, 8)} />
        <QueueCard title="Stale Drafts" items={queue.staleDrafts.slice(0, 8)} />
      </div>
    </>
  );
}

type QueueItem = ReturnType<typeof buildReleaseQueue>["items"][number];

function QueueCard({ title, items }: { title: string; items: QueueItem[] }) {
  return (
    <Card>
      <CardTitle title={title} eyebrow={`${items.length} songs`} />
      <QueueList items={items} />
    </Card>
  );
}

function QueueList({ items, selectable = false }: { items: QueueItem[]; selectable?: boolean }) {
  return (
    <div className={selectable ? "md:col-span-3 divide-y divide-white/10" : "divide-y divide-white/10"}>
      {items.length ? items.map(({ song, recommendation }) => (
        <div key={song.id} className="flex gap-3 py-3">
          {selectable ? <input type="checkbox" name="songIds" value={song.id} className="mt-1" /> : null}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link href={`/songs/${song.id}`} className="font-medium text-white hover:text-rose">{song.title}</Link>
              <StatusBadge status={song.status} />
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Pill>{recommendation.label}</Pill>
              <Pill>score {recommendation.score}</Pill>
              {recommendation.signals.hasNoCampaign ? <Pill>no campaign</Pill> : null}
              {recommendation.signals.hasNoSchedule ? <Pill>unscheduled</Pill> : null}
            </div>
            <p className="mt-2 text-sm text-mist/55">{recommendation.suggestions[0] || "Review this song for the next release move."}</p>
          </div>
        </div>
      )) : <p className="rounded-lg bg-white/5 p-4 text-sm text-mist/60">Nothing here yet.</p>}
    </div>
  );
}
