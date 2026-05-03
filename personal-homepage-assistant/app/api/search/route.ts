import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  await requireUser();
  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) return NextResponse.json({ results: [] });
  const contains = { contains: q, mode: "insensitive" as const };
  const [sites, channels, projects, notes, tasks, links, events] = await Promise.all([
    prisma.site.findMany({ where: { OR: [{ name: contains }, { description: contains }, { category: contains }] }, take: 6 }),
    prisma.youTubeChannel.findMany({ where: { OR: [{ name: contains }, { description: contains }, { nicheMood: contains }, { notes: contains }] }, take: 6 }),
    prisma.project.findMany({ where: { OR: [{ name: contains }, { description: contains }, { notes: contains }, { relatedLinks: contains }] }, take: 6 }),
    prisma.note.findMany({ where: { OR: [{ title: contains }, { body: contains }] }, take: 6 }),
    prisma.task.findMany({ where: { OR: [{ title: contains }, { description: contains }] }, take: 6 }),
    prisma.quickLink.findMany({ where: { OR: [{ name: contains }, { category: contains }, { url: contains }] }, take: 6 }),
    prisma.calendarEvent.findMany({ where: { OR: [{ title: contains }, { description: contains }] }, take: 6 })
  ]);

  return NextResponse.json({
    results: [
      ...sites.map((x) => ({ type: "site", id: x.id, title: x.name, subtitle: x.description, href: "/sites" })),
      ...channels.map((x) => ({ type: "channel", id: x.id, title: x.name, subtitle: x.nicheMood, href: "/channels" })),
      ...projects.map((x) => ({ type: "project", id: x.id, title: x.name, subtitle: x.description, href: "/projects" })),
      ...notes.map((x) => ({ type: "note", id: x.id, title: x.title, subtitle: x.body, href: "/notes" })),
      ...tasks.map((x) => ({ type: "task", id: x.id, title: x.title, subtitle: x.description, href: "/tasks" })),
      ...links.map((x) => ({ type: "link", id: x.id, title: x.name, subtitle: x.url, href: "/links" })),
      ...events.map((x) => ({ type: "event", id: x.id, title: x.title, subtitle: x.description, href: "/calendar" }))
    ].slice(0, 18)
  });
}
