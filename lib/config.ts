export type AIProvider = "mock" | "groq";
export type StorageDriver = "local";
export type DashboardPreset = "full" | "content" | "release" | "minimal";

function bool(value: string | undefined, fallback = false) {
  const cleaned = clean(value).toLowerCase();
  if (!cleaned) return fallback;
  return ["1", "true", "yes", "on"].includes(cleaned);
}

function clean(value: string | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed.replace(/^['"]|['"]$/g, "");
}

export function appConfig() {
  const provider = clean(process.env.AI_PROVIDER).toLowerCase();

  return {
    appName: clean(process.env.APP_NAME) || "MicroSuspiros Admin Panel",
    baseUrl: clean(process.env.BASE_URL),
    aiProvider: provider === "groq" ? "groq" : "mock",
    groqApiKey: clean(process.env.GROQ_API_KEY),
    groqModel: clean(process.env.GROQ_MODEL) || "llama-3.1-8b-instant",
    storageDriver: "local",
    uploadDir: clean(process.env.UPLOAD_DIR) || "public/uploads",
    s3Bucket: clean(process.env.S3_BUCKET),
    s3Region: clean(process.env.S3_REGION),
    s3Endpoint: clean(process.env.S3_ENDPOINT),
    s3AccessKey: clean(process.env.S3_ACCESS_KEY),
    s3SecretKey: clean(process.env.S3_SECRET_KEY),
    defaultTimezone: clean(process.env.DEFAULT_TIMEZONE) || "America/Los_Angeles",
    releaseQueueStaleDays: Number(clean(process.env.RELEASE_QUEUE_STALE_DAYS)) || 21,
    releaseQueueRecentDays: Number(clean(process.env.RELEASE_QUEUE_RECENT_DAYS)) || 7,
    dashboardDefaultPreset: (clean(process.env.DASHBOARD_DEFAULT_PRESET).toLowerCase() as DashboardPreset) || "full",
    youtubeSyncEnabled: bool(process.env.YOUTUBE_SYNC_ENABLED),
    youtubeApiKey: clean(process.env.YOUTUBE_API_KEY),
    youtubeChannelId: clean(process.env.YOUTUBE_CHANNEL_ID),
    websiteSyncEnabled: bool(process.env.WEBSITE_SYNC_ENABLED),
    websiteBaseUrl: clean(process.env.WEBSITE_BASE_URL),
    websiteApiUrl: clean(process.env.WEBSITE_API_URL),
    websiteApiKey: clean(process.env.WEBSITE_API_KEY),
    analyticsImportEnabled: bool(process.env.ANALYTICS_IMPORT_ENABLED),
    analyticsSource: clean(process.env.ANALYTICS_SOURCE),
    syncTimeoutMs: Number(clean(process.env.SYNC_TIMEOUT_MS)) || 7000
  } satisfies {
    appName: string;
    baseUrl: string;
    aiProvider: AIProvider;
    groqApiKey: string;
    groqModel: string;
    storageDriver: StorageDriver;
    uploadDir: string;
    s3Bucket: string;
    s3Region: string;
    s3Endpoint: string;
    s3AccessKey: string;
    s3SecretKey: string;
    defaultTimezone: string;
    releaseQueueStaleDays: number;
    releaseQueueRecentDays: number;
    dashboardDefaultPreset: DashboardPreset;
    youtubeSyncEnabled: boolean;
    youtubeApiKey: string;
    youtubeChannelId: string;
    websiteSyncEnabled: boolean;
    websiteBaseUrl: string;
    websiteApiUrl: string;
    websiteApiKey: string;
    analyticsImportEnabled: boolean;
    analyticsSource: string;
    syncTimeoutMs: number;
  };
}
