export type AIProvider = "mock" | "groq";

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
    groqModel: clean(process.env.GROQ_MODEL) || "llama-3.1-8b-instant"
  } satisfies {
    appName: string;
    baseUrl: string;
    aiProvider: AIProvider;
    groqApiKey: string;
    groqModel: string;
  };
}
