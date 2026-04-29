import { Router } from "express";
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
  req.session.userId = user.id;
  res.json({ user: publicUser(user) });
});

authRouter.post("/login", async (req, res) => {
  const email = String(req.body.email ?? "").trim().toLowerCase();
  const password = String(req.body.password ?? "");
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }
  req.session.userId = user.id;
  res.json({ user: publicUser(user) });
});

authRouter.post("/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.session.userId } });
  res.json({ user: publicUser(user) });
});

