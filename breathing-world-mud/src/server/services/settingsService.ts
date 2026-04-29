import { prisma } from "../db.js";
import { decryptSecret, encryptSecret } from "../utils/crypto.js";

export async function getSettings() {
  const settings = await prisma.appSetting.upsert({
    where: { id: "global" },
    update: {},
    create: { id: "global" }
  });
  return settings;
}

export async function getPublicSettings() {
  const settings = await getSettings();
  return {
    groqApiKeySet: Boolean(settings.groqApiKeyEncrypted),
    groqModelName: settings.groqModelName,
    aiCreativity: settings.aiCreativity,
    maxTokens: settings.maxTokens,
    worldGenerationEnabled: settings.worldGenerationEnabled,
    safetyEnabled: settings.safetyEnabled,
    updatedAt: settings.updatedAt
  };
}

export async function updateSettings(input: {
  groqApiKey?: string;
  groqModelName?: string;
  aiCreativity?: number;
  maxTokens?: number;
  worldGenerationEnabled?: boolean;
  safetyEnabled?: boolean;
}) {
  return prisma.appSetting.upsert({
    where: { id: "global" },
    create: {
      id: "global",
      groqApiKeyEncrypted: input.groqApiKey ? encryptSecret(input.groqApiKey) : undefined,
      groqModelName: input.groqModelName || "llama-3.1-8b-instant",
      aiCreativity: input.aiCreativity ?? 0.7,
      maxTokens: input.maxTokens ?? 500,
      worldGenerationEnabled: input.worldGenerationEnabled ?? true,
      safetyEnabled: input.safetyEnabled ?? true
    },
    update: {
      ...(input.groqApiKey !== undefined ? { groqApiKeyEncrypted: encryptSecret(input.groqApiKey) } : {}),
      ...(input.groqModelName !== undefined ? { groqModelName: input.groqModelName } : {}),
      ...(input.aiCreativity !== undefined ? { aiCreativity: input.aiCreativity } : {}),
      ...(input.maxTokens !== undefined ? { maxTokens: input.maxTokens } : {}),
      ...(input.worldGenerationEnabled !== undefined ? { worldGenerationEnabled: input.worldGenerationEnabled } : {}),
      ...(input.safetyEnabled !== undefined ? { safetyEnabled: input.safetyEnabled } : {})
    }
  });
}

export async function getGroqApiKey() {
  const settings = await getSettings();
  return decryptSecret(settings.groqApiKeyEncrypted);
}
