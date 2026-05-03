import { ExternalLink } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Checkbox, DeleteButton, PageTitle, TextArea, TextInput } from "@/components/crud";
import { saveChannel } from "@/lib/actions";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ChannelsPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  await requireUser();
  const { edit } = await searchParams;
  const [items, item] = await Promise.all([
    prisma.youTubeChannel.findMany({ orderBy: { updatedAt: "desc" } }),
    edit ? prisma.youTubeChannel.findUnique({ where: { id: edit } }) : null
  ]);
  return (
    <AppShell>
      <PageTitle title="YouTube Channels" subtitle="Channels, moods, studio links, analytics links, and content notes." />
      <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
        <form action={saveChannel} className="card space-y-4">
          <input type="hidden" name="id" value={item?.id ?? ""} />
          <TextInput label="Channel name" name="name" defaultValue={item?.name} required />
          <TextInput label="Channel URL" name="url" defaultValue={item?.url} required />
          <TextInput label="Niche / mood" name="nicheMood" defaultValue={item?.nicheMood} />
          <TextArea label="Description" name="description" defaultValue={item?.description} />
          <TextArea label="Notes" name="notes" defaultValue={item?.notes} />
          <TextInput label="Studio URL" name="studioUrl" defaultValue={item?.studioUrl} />
          <TextInput label="Analytics URL" name="analyticsUrl" defaultValue={item?.analyticsUrl} />
          <Checkbox label="Pin to dashboard" name="pinned" defaultChecked={item?.pinned} />
          <button className="btn btn-primary w-full">{item ? "Update channel" : "Create channel"}</button>
        </form>
        <div className="grid gap-3 md:grid-cols-2">
          {items.map((channel) => <article key={channel.id} className="card"><div className="flex items-start justify-between gap-2"><div><h2 className="font-bold">{channel.name}</h2><p className="text-sm text-ink/55 dark:text-white/55">{channel.nicheMood}</p></div><DeleteButton type="channel" id={channel.id} /></div><p className="my-3 line-clamp-3 text-sm">{channel.notes || channel.description}</p><div className="flex flex-wrap gap-2"><a className="btn btn-primary" href={channel.url} target="_blank"><ExternalLink size={15} /> Channel</a>{channel.studioUrl && <a className="btn btn-soft" href={channel.studioUrl} target="_blank">Studio</a>}{channel.analyticsUrl && <a className="btn btn-soft" href={channel.analyticsUrl} target="_blank">Analytics</a>}<a className="btn btn-soft" href={`/channels?edit=${channel.id}`}>Edit</a></div></article>)}
        </div>
      </div>
    </AppShell>
  );
}
