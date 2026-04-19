import { AIGenerationKind } from "@prisma/client";
import { appConfig } from "@/lib/config";
import { buildPrompt } from "@/lib/ai/prompts";
import type { AIGenerationResult, AISong } from "@/lib/ai/types";

function mockResult(kind: AIGenerationKind, song: AISong) {
  const theme = song.theme || "lo que queda latiendo";
  const mood = song.mood || "intimo";
  const title = song.title;

  const values: Record<AIGenerationKind, string> = {
    YOUTUBE_TITLE: `${title} | MicroSuspiros`,
    YOUTUBE_DESCRIPTION: `${song.hookText || `Un MicroSuspiro sobre ${theme}, contado en voz baja.`}\n\nUna pieza breve de tono ${mood}, para escuchar despacio cuando la memoria pide lugar.\n\nMicroSuspiros: canciones pequenas para emociones grandes.`,
    SHORT_VERSION:
      song.shortVersion ||
      song.hookText ||
      `Hay recuerdos que no vuelven para doler; vuelven para recordarnos que todavia sabemos sentir con ternura.`,
    EXCERPT: song.websiteExcerpt || `Un suspiro sobre ${theme}, con una melancolia suave y luminosa.`,
    HOOK_TEXT: song.hookText || `Una cancion para cuando ${theme.toLowerCase()} se queda respirando en silencio.`,
    TAGS: [theme, mood, "suspiro", "memoria", "amor maduro", "melancolia suave"]
      .map((tag) => tag.toLowerCase())
      .filter((tag, index, all) => tag && all.indexOf(tag) === index)
      .slice(0, 6)
      .join(", "),
    NOTES: `Mantener la interpretacion contenida: voz cercana, pausas largas y un arreglo que deje respirar cada frase.`,
    OTHER: `Borrador para ${title}: ${theme}, ${mood}, con un centro emocional claro y publicable.`
  };

  return values[kind];
}

async function groqCompletion(prompt: string) {
  const config = appConfig();
  if (!config.groqApiKey) {
    throw new Error("Groq is enabled but GROQ_API_KEY is missing.");
  }

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.groqApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: config.groqModel,
      temperature: 0.7,
      max_tokens: 500,
      messages: [
        { role: "system", content: "You are a concise creative assistant for a poetic music publishing workflow." },
        { role: "user", content: prompt }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`Groq request failed with ${response.status}.`);
  }

  const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new Error("Groq returned an empty response.");
  }

  return text;
}

export async function generateAI(kind: AIGenerationKind, song: AISong): Promise<AIGenerationResult> {
  const config = appConfig();
  const prompt = buildPrompt(kind, song);

  if (config.aiProvider === "groq") {
    try {
      return {
        kind,
        provider: "groq",
        prompt,
        result: await groqCompletion(prompt)
      };
    } catch (error) {
      return {
        kind,
        provider: "mock",
        prompt: `${prompt}\n\nGroq fallback reason: ${error instanceof Error ? error.message : "Unknown error"}`,
        result: mockResult(kind, song),
        usedFallback: true
      };
    }
  }

  return {
    kind,
    provider: "mock",
    prompt,
    result: mockResult(kind, song)
  };
}

export async function generateYoutubeTitle(song: AISong) {
  return (await generateAI(AIGenerationKind.YOUTUBE_TITLE, song)).result;
}

export async function generateYoutubeDescription(song: AISong) {
  return (await generateAI(AIGenerationKind.YOUTUBE_DESCRIPTION, song)).result;
}

export async function generateShortVersion(song: AISong) {
  return (await generateAI(AIGenerationKind.SHORT_VERSION, song)).result;
}

export async function generateWebsiteExcerpt(song: AISong) {
  return (await generateAI(AIGenerationKind.EXCERPT, song)).result;
}

export async function generateHookText(song: AISong) {
  return (await generateAI(AIGenerationKind.HOOK_TEXT, song)).result;
}

export async function suggestTags(song: AISong) {
  return (await generateAI(AIGenerationKind.TAGS, song)).result;
}
