import { ExternalLink } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Checkbox, DeleteButton, PageTitle, Select, TextArea, TextInput } from "@/components/crud";
import { saveSite } from "@/lib/actions";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function SitesPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  await requireUser();
  const { edit } = await searchParams;
  const [items, item] = await Promise.all([
    prisma.site.findMany({ orderBy: { updatedAt: "desc" } }),
    edit ? prisma.site.findUnique({ where: { id: edit } }) : null
  ]);
  return (
    <AppShell>
      <PageTitle title="My Sites" subtitle="Personal websites, ideas, paused experiments, and archived corners." />
      <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
        <form action={saveSite} className="card space-y-4">
          <input type="hidden" name="id" value={item?.id ?? ""} />
          <TextInput label="Name" name="name" defaultValue={item?.name} required />
          <TextInput label="URL" name="url" defaultValue={item?.url} required />
          <TextArea label="Description" name="description" defaultValue={item?.description} />
          <div className="grid gap-4 sm:grid-cols-2"><TextInput label="Category" name="category" defaultValue={item?.category} /><Select label="Status" name="status" defaultValue={item?.status ?? "active"} options={["active", "idea", "paused", "archived"]} /></div>
          <div className="grid gap-4 sm:grid-cols-2"><TextInput label="Icon" name="icon" defaultValue={item?.icon} /><TextInput label="Color" name="color" defaultValue={item?.color} /></div>
          <Checkbox label="Pin to dashboard" name="pinned" defaultChecked={item?.pinned} />
          <button className="btn btn-primary w-full">{item ? "Update site" : "Create site"}</button>
        </form>
        <div className="grid gap-3 md:grid-cols-2">
          {items.map((site) => <article key={site.id} className="card"><div className="flex items-start justify-between gap-2"><div><h2 className="font-bold">{site.name}</h2><p className="text-sm text-ink/55 dark:text-white/55">{site.category} · {site.status}</p></div><DeleteButton type="site" id={site.id} /></div><p className="my-3 line-clamp-3 text-sm">{site.description}</p><div className="flex gap-2"><a className="btn btn-primary" href={site.url} target="_blank"><ExternalLink size={15} /> Open</a><a className="btn btn-soft" href={`/sites?edit=${site.id}`}>Edit</a></div></article>)}
        </div>
      </div>
    </AppShell>
  );
}
