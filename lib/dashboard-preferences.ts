import type { Prisma } from "@prisma/client";

export const dashboardSectionIds = [
  "stats",
  "quick-actions",
  "recent-songs",
  "queue",
  "upcoming",
  "recent-activity",
  "recent-updated",
  "needs-attention",
  "performance",
  "campaigns"
] as const;

export type DashboardSectionId = (typeof dashboardSectionIds)[number];
export type DashboardPreset = "full" | "content" | "release" | "minimal";

export type DashboardPreferences = {
  preset: DashboardPreset;
  compact: boolean;
  enabledSections: DashboardSectionId[];
  collapsedSections: DashboardSectionId[];
};

const presetMap: Record<DashboardPreset, DashboardSectionId[]> = {
  full: [...dashboardSectionIds],
  content: ["stats", "quick-actions", "recent-songs", "recent-updated", "needs-attention", "performance"],
  release: ["stats", "queue", "upcoming", "campaigns", "recent-activity", "needs-attention"],
  minimal: ["stats", "queue", "quick-actions"]
};

export function dashboardPresetSections(preset: DashboardPreset) {
  return presetMap[preset];
}

export function defaultDashboardPreferences(preset: DashboardPreset = "full"): DashboardPreferences {
  return {
    preset,
    compact: false,
    enabledSections: dashboardPresetSections(preset),
    collapsedSections: []
  };
}

export function resolveDashboardPreferences(value: Prisma.JsonValue | null | undefined, defaultPreset: DashboardPreset = "full"): DashboardPreferences {
  const defaults = defaultDashboardPreferences(defaultPreset);
  if (!value || typeof value !== "object" || Array.isArray(value)) return defaults;

  const record = value as Record<string, unknown>;
  const preset = typeof record.preset === "string" && record.preset in presetMap ? record.preset as DashboardPreset : defaults.preset;
  const enabledSections = Array.isArray(record.enabledSections)
    ? record.enabledSections.filter((item): item is DashboardSectionId => typeof item === "string" && dashboardSectionIds.includes(item as DashboardSectionId))
    : dashboardPresetSections(preset);
  const collapsedSections = Array.isArray(record.collapsedSections)
    ? record.collapsedSections.filter((item): item is DashboardSectionId => typeof item === "string" && dashboardSectionIds.includes(item as DashboardSectionId))
    : [];

  return {
    preset,
    compact: Boolean(record.compact),
    enabledSections: enabledSections.length ? enabledSections : dashboardPresetSections(preset),
    collapsedSections
  };
}

export function dashboardSectionEnabled(preferences: DashboardPreferences, sectionId: DashboardSectionId) {
  return preferences.enabledSections.includes(sectionId);
}

export function dashboardSectionCollapsed(preferences: DashboardPreferences, sectionId: DashboardSectionId) {
  return preferences.collapsedSections.includes(sectionId);
}
