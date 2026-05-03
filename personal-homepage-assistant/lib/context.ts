import { prisma } from "@/lib/prisma";
import { getMediaAssistantSummary } from "@/lib/integrations";

export async function getAssistantContext() {
  const [sites, channels, projects, notes, tasks, events, links, media] = await Promise.all([
    prisma.site.findMany({ orderBy: { updatedAt: "desc" }, take: 30 }),
    prisma.youTubeChannel.findMany({ orderBy: { updatedAt: "desc" }, take: 30 }),
    prisma.project.findMany({ orderBy: { updatedAt: "desc" }, take: 30 }),
    prisma.note.findMany({ orderBy: { updatedAt: "desc" }, take: 30, include: { project: true } }),
    prisma.task.findMany({ orderBy: [{ status: "asc" }, { dueDate: "asc" }], take: 40, include: { project: true } }),
    prisma.calendarEvent.findMany({ where: { startsAt: { gte: new Date(Date.now() - 86400000) } }, orderBy: { startsAt: "asc" }, take: 30, include: { project: true } }),
    prisma.quickLink.findMany({ orderBy: [{ favorite: "desc" }, { updatedAt: "desc" }], take: 40 }),
    getMediaAssistantSummary()
  ]);

  return JSON.stringify({
    sites: sites.map((s) => ({ name: s.name, url: s.url, category: s.category, status: s.status, description: s.description })),
    channels: channels.map((c) => ({ name: c.name, url: c.url, nicheMood: c.nicheMood, notes: c.notes, studioUrl: c.studioUrl, analyticsUrl: c.analyticsUrl })),
    projects: projects.map((p) => ({ name: p.name, status: p.status, priority: p.priority, description: p.description, links: p.relatedLinks, notes: p.notes, updatedAt: p.updatedAt })),
    notes: notes.map((n) => ({ title: n.title, body: n.body.slice(0, 1600), project: n.project?.name, updatedAt: n.updatedAt })),
    tasks: tasks.map((t) => ({ title: t.title, status: t.status, priority: t.priority, dueDate: t.dueDate, project: t.project?.name, description: t.description })),
    events: events.map((e) => ({ title: e.title, startsAt: e.startsAt, type: e.type, project: e.project?.name, description: e.description })),
    quickLinks: links.map((l) => ({ name: l.name, url: l.url, category: l.category, favorite: l.favorite })),
    media
  });
}
