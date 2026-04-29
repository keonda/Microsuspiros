import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { createCharacter, getGameState, runPlayerCommand } from "../services/gameService.js";

export const gameRouter = Router();

gameRouter.use(requireAuth);

gameRouter.get("/state", async (req, res) => {
  res.json(await getGameState(req.session.userId!));
});

gameRouter.post("/create-character", async (req, res) => {
  const name = String(req.body.name ?? "Wayfarer");
  const character = await createCharacter(req.session.userId!, name);
  res.json({ character, state: await getGameState(req.session.userId!) });
});

gameRouter.post("/command", async (req, res) => {
  const command = String(req.body.command ?? "");
  if (!command.trim()) {
    res.status(400).json({ error: "Command required" });
    return;
  }
  res.json(await runPlayerCommand(req.session.userId!, command));
});

