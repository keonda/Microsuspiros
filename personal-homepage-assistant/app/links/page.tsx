import { ExternalLink } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Checkbox, DeleteButton, PageTitle, TextInput } from "@/components/crud";
import { saveQuickLink } from "@/lib/actions";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function LinksPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  await requireUser();
  const { edit } = await searchParams;
  const [items, item] = await Promise.all([
    prisma.quickLink.findMany({ orderBy: [{ favorite: "desc" }, { updatedAt: "desc" }] }),
    edit ? prisma.quickLink.findUnique({ where: { id: edit } }) : null
  ]);
  return (
    <AppShell>
      <PageTitle title="Quick Links" subtitle="Favorite and categorized links for fast jumps." />
      <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
        <form action={saveQuickLink} className="card space-y-4">
          <input type="hidden" name="id" value={item?.id ?? ""} />
          <TextInput label="Name" name="name" defaultValue={item?.name} required />
          <TextInput label="URL" name="url" defaultValue={item?.url} required />
          <TextInput label="Category" name="category" defaultValue={item?.category} />
          <div className="flex gap-4"><Checkbox label="Favorite" name="favorite" defaultChecked={item?.favorite} /><Checkbox label="Pin" name="pinned" defaultChecked={item?.pinned} /></div>
          <button className="btn btn-primary w-full">{item ? "Update link" : "Create link"}</button>
        </form>
        <div className="grid gap-3 md:grid-cols-3">
          {items.map((link) => <article key={link.id} className="card"><div className="flex items-start justify-between gap-2"><div><h2 className="font-bold">{link.name}</h2><p className="text-sm text-ink/55 dark:text-white/55">{link.category}{link.favorite ? " · favorite" : ""}</p></div><DeleteButton type="link" id={link.id} /></div><div className="mt-4 flex gap-2"><a className="btn btn-primary" href={link.url} target="_blank"><ExternalLink size={15} /> Open</a><a className="btn btn-soft" href={`/links?edit=${link.id}`}>Edit</a></div></article>)}
        </div>
      </div>
    </AppShell>
  );
}
