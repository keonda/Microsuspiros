import { Router } from "express";
import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

export const authRouter = Router();

function publicUser(user: { id: string; email: string; displayName: string; isAdmin: boolean; createdAt: Date }) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    isAdmin: user.isAdmin,
    createdAt: user.createdAt
  };
}

function saveLogin(req: Request, res: Response, user: { id: string; email: string; displayName: string; isAdmin: boolean; createdAt: Date }) {
  req.session.userId = user.id;
  req.session.save((error) => {
    if (error) {
      res.status(500).json({ error: "Could not save session" });
      return;
    }
    res.json({ user: publicUser(user) });
  });
}

authRouter.post("/register", async (req, res) => {
  const email = String(req.body.email ?? "").trim().toLowerCase();
  const password = String(req.body.password ?? "");
  const displayName = String(req.body.displayName ?? "Wayfarer").trim().slice(0, 60);
  if (!email || password.length < 8) {
    res.status(400).json({ error: "Email and an 8+ character password are required" });
    return;
  }

  const count = await prisma.user.count();
  const user = await prisma.user.create({
    data: {
      email,
      displayName: displayName || "Wayfarer",
      passwordHash: await bcrypt.hash(password, 12),
      isAdmin: count === 0
    }
  });
  saveLogin(req, res, user);
});

authRouter.post("/login", async (req, res) => {
  const email = String(req.body.email ?? "").trim().toLowerCase();
  const password = String(req.body.password ?? "");
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }
  saveLogin(req, res, user);
});

authRouter.post("/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.session.userId } });
  res.json({ user: publicUser(user) });
});

authRouter.put("/profile", requireAuth, async (req, res) => {
  const displayName = String(req.body.displayName ?? "").trim().slice(0, 60);
  if (!displayName) {
    res.status(400).json({ error: "Display name is required" });
    return;
  }
  const user = await prisma.user.update({
    where: { id: req.session.userId },
    data: { displayName }
  });
  res.json({ user: publicUser(user) });
});

authRouter.post("/change-password", requireAuth, async (req, res) => {
  const currentPassword = String(req.body.currentPassword ?? "");
  const newPassword = String(req.body.newPassword ?? "");
  if (newPassword.length < 8) {
    res.status(400).json({ error: "New password must be at least 8 characters" });
    return;
  }
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.session.userId } });
  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
    res.status(400).json({ error: "Current password is incorrect" });
    return;
  }
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(newPassword, 12) }
  });
  res.json({ user: publicUser(updated) });
});
