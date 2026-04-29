import { Router } from "express";
import rateLimit from "express-rate-limit";
import { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import { requireAdmin } from "../middleware/auth.js";
import { getPublicSettings, updateSettings } from "../services/settingsService.js";
import { generateItem, generateLore, generateMonster, generateNpc } from "../services/worldGeneratorService.js";

export const adminRouter = Router();

const aiLimiter = rateLimit({
  windowMs: 60_000,
  limit: 12,
  standardHeaders: true,
  legacyHeaders: false
});

adminRouter.use(requireAdmin);

adminRouter.get("/settings", async (_req, res) => {
  res.json(await getPublicSettings());
});

adminRouter.put("/settings", async (req, res) => {
  await updateSettings({
    groqApiKey: req.body.groqApiKey,
    groqModelName: req.body.groqModelName,
    aiCreativity: req.body.aiCreativity === undefined ? undefined : Number(req.body.aiCreativity),
    maxTokens: req.body.maxTokens === undefined ? undefined : Number(req.body.maxTokens),
    worldGenerationEnabled: req.body.worldGenerationEnabled,
    safetyEnabled: req.body.safetyEnabled
  });
  res.json(await getPublicSettings());
});

adminRouter.get("/users", async (_req, res) => {
  res.json(await prisma.user.findMany({ select: { id: true, email: true, displayName: true, isAdmin: true, createdAt: true }, orderBy: { createdAt: "desc" } }));
});

adminRouter.get("/world/rooms", async (_req, res) => {
  res.json(await prisma.room.findMany({ include: { exitsFrom: true }, orderBy: { createdAt: "desc" }, take: 200 }));
});

adminRouter.get("/world/monsters", async (_req, res) => {
  res.json(await prisma.monster.findMany({ orderBy: { createdAt: "desc" }, take: 200 }));
});

adminRouter.get("/world/items", async (_req, res) => {
  res.json(await prisma.item.findMany({ orderBy: { createdAt: "desc" }, take: 200 }));
});

adminRouter.get("/world/npcs", async (_req, res) => {
  res.json(await prisma.npc.findMany({ orderBy: { createdAt: "desc" }, take: 200 }));
});

adminRouter.get("/world/lore", async (_req, res) => {
  res.json(await prisma.loreEntry.findMany({ orderBy: { createdAt: "desc" }, take: 200 }));
});

adminRouter.get("/ai-logs", async (_req, res) => {
  res.json(await prisma.aiGenerationLog.findMany({ orderBy: { createdAt: "desc" }, take: 200 }));
});

adminRouter.delete("/:entity/:id", async (req, res) => {
  const { entity, id } = req.params;
  if (entity === "room") {
    await prisma.room.delete({ where: { id } });
  } else if (entity === "monster") {
    await prisma.monster.delete({ where: { id } });
  } else if (entity === "item") {
    await prisma.item.delete({ where: { id } });
  } else if (entity === "npc") {
    await prisma.npc.delete({ where: { id } });
  } else if (entity === "loreEntry") {
    await prisma.loreEntry.delete({ where: { id } });
  } else {
    res.status(400).json({ error: "Unsupported entity" });
    return;
  }
  res.json({ ok: true });
});

adminRouter.post("/generate/:type", aiLimiter, async (req, res) => {
  const type = String(req.params.type);
  const context = String(req.body.context ?? "The Candle Gate");
  if (type === "monster") {
    const data = await generateMonster(context);
    const saved = await prisma.monster.create({ data: { ...data, lootTableJson: data.lootTableJson as Prisma.InputJsonValue, isGenerated: true } });
    res.json(saved);
    return;
  }
  if (type === "item") {
    const data = await generateItem(context);
    const saved = await prisma.item.create({ data: { ...data, effectJson: data.effectJson as Prisma.InputJsonValue, isGenerated: true } });
    res.json(saved);
    return;
  }
  if (type === "npc") {
    const data = await generateNpc(context);
    const saved = await prisma.npc.create({ data: { ...data, memoryJson: data.memoryJson as Prisma.InputJsonValue, isGenerated: true } });
    res.json(saved);
    return;
  }
  if (type === "lore") {
    const data = await generateLore(context);
    const saved = await prisma.loreEntry.create({ data });
    res.json(saved);
    return;
  }
  res.status(400).json({ error: "Supported types: monster, item, npc, lore" });
});
