export type AIProvider = "mock" | "groq";
export type StorageDriver = "local";

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
    releaseQueueRecentDays: Number(clean(process.env.RELEASE_QUEUE_RECENT_DAYS)) || 7
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
  };
}
