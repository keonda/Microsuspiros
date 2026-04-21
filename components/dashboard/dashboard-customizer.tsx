"use client";

import { useMemo, useState } from "react";
import { saveDashboardPreferences } from "@/actions/settings-actions";
import { dashboardPresetSections, dashboardSectionIds, type DashboardPreferences, type DashboardPreset } from "@/lib/dashboard-preferences";

const labels: Record<(typeof dashboardSectionIds)[number], string> = {
  stats: "Stats band",
  "quick-actions": "Quick actions",
  "recent-songs": "Recent songs",
  queue: "Release queue",
  upcoming: "Upcoming releases",
  "recent-activity": "Recent activity",
  "recent-updated": "Recently updated",
  "needs-attention": "Needs attention",
  performance: "Performance",
  campaigns: "Campaign summary"
};

export function DashboardCustomizer({ initial }: { initial: DashboardPreferences }) {
  const [preset, setPreset] = useState<DashboardPreset>(initial.preset);
  const [compact, setCompact] = useState(initial.compact);
  const [enabled, setEnabled] = useState<string[]>(initial.enabledSections);
  const [collapsed, setCollapsed] = useState<string[]>(initial.collapsedSections);

  const sectionLabels = useMemo(() => dashboardSectionIds.map((id) => ({ id, label: labels[id] })), []);

  function applyPreset(nextPreset: DashboardPreset) {
    setPreset(nextPreset);
    setEnabled([...dashboardPresetSections(nextPreset)]);
    setCollapsed(nextPreset === "minimal" ? ["recent-activity", "recent-updated", "campaigns"] : []);
    setCompact(nextPreset === "minimal");
  }

  function toggle(setter: React.Dispatch<React.SetStateAction<string[]>>, id: string) {
    setter((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  return (
    <details className="rounded-lg border border-white/10 bg-white/5 px-4 py-3">
      <summary className="cursor-pointer list-none text-sm font-semibold text-white">Customize Dashboard</summary>
      <form action={saveDashboardPreferences} className="mt-4 space-y-4">
        <div className="flex flex-wrap gap-2">
          {[
            ["full", "Full"],
            ["content", "Content Focus"],
            ["release", "Release Focus"],
            ["minimal", "Minimal"]
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => applyPreset(value as DashboardPreset)}
              className={`rounded-lg px-3 py-2 text-sm ring-1 ${preset === value ? "bg-rose text-ink ring-rose/30" : "bg-white/8 text-mist ring-white/10 hover:bg-white/12"}`}
            >
              {label}
            </button>
          ))}
        </div>

        <input type="hidden" name="preset" value={preset} />
        <input type="hidden" name="compact" value={compact ? "true" : "false"} />

        <label className="flex items-center gap-2 text-sm text-mist/80">
          <input type="checkbox" checked={compact} onChange={(event) => setCompact(event.target.checked)} />
          Compact density
        </label>

        <div className="grid gap-3 md:grid-cols-2">
          {sectionLabels.map((section) => (
            <div key={section.id} className="rounded-lg bg-ink/30 p-3">
              <label className="flex items-center gap-2 text-sm text-white">
                <input
                  type="checkbox"
                  checked={enabled.includes(section.id)}
                  onChange={() => toggle(setEnabled, section.id)}
                />
                {section.label}
              </label>
              <label className="mt-2 flex items-center gap-2 text-xs text-mist/65">
                <input
                  type="checkbox"
                  checked={collapsed.includes(section.id)}
                  onChange={() => toggle(setCollapsed, section.id)}
                />
                Start collapsed
              </label>
              {enabled.includes(section.id) ? <input type="hidden" name="enabledSections" value={section.id} /> : null}
              {collapsed.includes(section.id) ? <input type="hidden" name="collapsedSections" value={section.id} /> : null}
            </div>
          ))}
        </div>

        <button className="rounded-lg bg-rose px-4 py-2 text-sm font-semibold text-ink hover:bg-rose/90">Save dashboard view</button>
      </form>
    </details>
  );
}
