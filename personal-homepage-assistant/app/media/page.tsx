import { RefreshCw, Server } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageTitle, TextInput } from "@/components/crud";
import { PlexConnect } from "@/components/plex-connect";
import { saveIntegrations } from "@/lib/actions";
import { requireUser } from "@/lib/auth";
import { getAllMediaOverview, getConfiguredIntegrations, MediaSectionItem, MediaSummary } from "@/lib/integrations";

export const dynamic = "force-dynamic";

export default async function MediaPage({ searchParams }: { searchParams: Promise<{ saved?: string; refresh?: string }> }) {
  await requireUser();
  const params = await searchParams;
  const [overview, configured] = await Promise.all([
    getAllMediaOverview(params.refresh === "1"),
    getConfiguredIntegrations()
  ]);
  const config = (kind: string) => configured.find((item) => item.kind === kind);

  return (
    <AppShell>
      <PageTitle title="Media" subtitle="Plex, Sonarr, and Radarr status without exposing tokens to the browser." action={<a className="btn btn-soft" href="/media?refresh=1"><RefreshCw size={16} /> Refresh</a>} />
      {params.saved && <p className="card mb-4 py-3 text-sm font-semibold text-moss">Integration settings saved.</p>}

      <section className="mb-4 grid gap-4 xl:grid-cols-3">
        <MediaCard summary={overview.plex} />
        <MediaCard summary={overview.sonarr} />
        <MediaCard summary={overview.radarr} />
      </section>

      <form action={saveIntegrations} className="card space-y-6">
        <div className="flex items-center gap-2">
          <Server size={18} />
          <h2 className="text-xl font-bold">Integration Settings</h2>
        </div>
        <PlexConnect />
        <IntegrationFields kind="plex" title="Plex" urlLabel="Plex server URL" secretLabel="Plex token" configured={config("plex")} />
        <IntegrationFields kind="sonarr" title="Sonarr" urlLabel="Sonarr URL" secretLabel="Sonarr API key" configured={config("sonarr")} />
        <IntegrationFields kind="radarr" title="Radarr" urlLabel="Radarr URL" secretLabel="Radarr API key" configured={config("radarr")} />
        <button className="btn btn-primary">Save integrations</button>
      </form>
    </AppShell>
  );
}

function MediaCard({ summary }: { summary: MediaSummary }) {
  const tone = summary.status === "online" ? "text-moss" : summary.status === "disabled" ? "text-ink/50 dark:text-white/50" : "text-coral";
  return (
    <article className="card">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">{summary.name}</h2>
          <p className={`text-sm font-semibold ${tone}`}>{summary.status}</p>
        </div>
        <span className="badge">{summary.kind}</span>
      </div>
      {summary.error && <p className="mb-3 rounded-xl bg-coral/10 p-3 text-sm text-coral">{summary.error}</p>}
      <div className="mb-3 grid grid-cols-2 gap-2">
        {Object.entries(summary.stats).slice(0, 4).map(([key, value]) => (
          <div key={key} className="rounded-xl bg-ink/5 p-3 dark:bg-white/10">
            <p className="label">{key}</p>
            <p className="font-bold">{String(value ?? "-")}</p>
          </div>
        ))}
      </div>
      {summary.sections.slice(0, 3).map((section) => (
        <div key={section.title} className="mt-3">
          <h3 className="mb-1 text-sm font-bold">{section.title}</h3>
          <div className="space-y-1">
            {(section.items.length ? section.items : ["Nothing to show"]).slice(0, 5).map((item) => <MediaListItem key={mediaItemKey(item)} item={item} />)}
          </div>
        </div>
      ))}
      {summary.lastUpdated && <p className="mt-3 text-xs text-ink/45 dark:text-white/45">Last updated {new Date(summary.lastUpdated).toLocaleString()}</p>}
    </article>
  );
}

function MediaListItem({ item }: { item: string | MediaSectionItem }) {
  if (typeof item === "string") {
    return <p className="line-clamp-1 rounded-lg bg-ink/5 px-2 py-1 text-sm dark:bg-white/10">{item}</p>;
  }
  const body = (
    <div className="flex min-w-0 items-center gap-2 rounded-lg bg-ink/5 p-2 text-sm dark:bg-white/10">
      {item.imageUrl && <img src={item.imageUrl} alt="" className="h-12 w-9 shrink-0 rounded object-cover" />}
      <div className="min-w-0">
        <p className="line-clamp-1 font-semibold">{item.title}</p>
        {item.subtitle && <p className="line-clamp-1 text-xs text-ink/55 dark:text-white/55">{item.subtitle}</p>}
      </div>
    </div>
  );
  return item.sourceUrl ? <a href={item.sourceUrl} target="_blank">{body}</a> : body;
}

function mediaItemKey(item: string | MediaSectionItem) {
  return typeof item === "string" ? item : `${item.title}-${item.subtitle ?? ""}`;
}

function IntegrationFields({ kind, title, urlLabel, secretLabel, configured }: { kind: "plex" | "sonarr" | "radarr"; title: string; urlLabel: string; secretLabel: string; configured?: { name: string; baseUrl: string; enabled: boolean } }) {
  return (
    <fieldset className="rounded-2xl border border-ink/10 p-4 dark:border-white/10">
      <div className="mb-4 flex items-center justify-between gap-3">
        <legend className="text-lg font-bold">{title}</legend>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input className="accent-moss" name={`${kind}Enabled`} type="checkbox" defaultChecked={configured?.enabled} />
          Enabled
        </label>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <TextInput label="Friendly name" name={`${kind}Name`} defaultValue={configured?.name ?? title} />
        <TextInput label={urlLabel} name={`${kind}Url`} defaultValue={configured?.baseUrl ?? ""} />
        <TextInput label={secretLabel} name={kind === "plex" ? `${kind}Token` : `${kind}ApiKey`} type="password" />
      </div>
      <p className="mt-2 text-xs text-ink/50 dark:text-white/50">Leave the token/API key blank to keep the existing saved credential.</p>
    </fieldset>
  );
}
