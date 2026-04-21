import Link from "next/link";
import { PageHeading } from "@/components/page-heading";
import { Card, CardTitle } from "@/components/ui/card";
import { appConfig } from "@/lib/config";
import { dateLabel } from "@/lib/format";
import { integrationStatuses } from "@/lib/integrations";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const [lastSynced, recentEvents] = await Promise.all([
    prisma.publishEvent.findFirst({ where: { lastSyncedAt: { not: null } }, orderBy: { lastSyncedAt: "desc" } }),
    prisma.publishEvent.findMany({ take: 8, orderBy: { createdAt: "desc" }, include: { song: true } })
  ]);
  const config = appConfig();
  const statuses = integrationStatuses();

  return (
    <>
      <PageHeading title="Integrations" subtitle="Operational status for optional syncs, exports, and analytics foundations." />
      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <Card>
          <CardTitle title="Status" eyebrow={lastSynced?.lastSyncedAt ? `last sync ${dateLabel(lastSynced.lastSyncedAt)}` : "no sync yet"} />
          <div className="space-y-3">
            {statuses.map((status) => (
              <div key={status.id} className="rounded-lg bg-white/5 p-4">
                <p className="font-medium text-white">{status.label}</p>
                <p className="mt-1 text-sm text-mist/65">Mode: {status.mode}</p>
                {status.warning ? <p className="mt-2 text-xs text-gold">{status.warning}</p> : null}
              </div>
            ))}
          </div>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardTitle title="Environment Notes" />
            <div className="grid gap-2 text-sm text-mist/70">
              <p>Default timezone: {config.defaultTimezone}</p>
              <p>YouTube sync: {config.youtubeSyncEnabled ? "enabled" : "disabled"}</p>
              <p>Website sync: {config.websiteSyncEnabled ? "enabled" : "disabled"}</p>
              <p>Analytics import: {config.analyticsImportEnabled ? "enabled" : "disabled"}</p>
              <p>Dashboard default preset: {config.dashboardDefaultPreset}</p>
            </div>
          </Card>
          <Card>
            <CardTitle title="Recent External Links" eyebrow={`${recentEvents.length} events`} />
            {recentEvents.length ? (
              <div className="divide-y divide-white/10">
                {recentEvents.map((event) => (
                  <Link key={event.id} href={`/songs/${event.songId}`} className="block py-3">
                    <p className="font-medium text-white">{event.song.title}</p>
                    <p className="text-sm text-mist/55">{event.platform} · {event.syncStatus} · {event.externalId || "no external id"}</p>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="rounded-lg bg-white/5 p-4 text-sm text-mist/65">No linked publish events yet.</p>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
