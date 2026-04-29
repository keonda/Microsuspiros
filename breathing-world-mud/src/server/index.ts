import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import session from "express-session";
import pg from "pg";
import connectPgSimple from "connect-pg-simple";
import { authRouter } from "./routes/auth.js";
import { gameRouter } from "./routes/game.js";
import { adminRouter } from "./routes/admin.js";

const app = express();
const port = Number(process.env.PORT ?? 3000);
const isProduction = process.env.NODE_ENV === "production";
const PgSession = connectPgSimple(session);

if (isProduction) {
  app.set("trust proxy", 1);
}

app.use(express.json({ limit: "1mb" }));
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
    credentials: true
  })
);

app.use(
  session({
    store: new PgSession({
      pool: new pg.Pool({ connectionString: process.env.DATABASE_URL }),
      tableName: "session",
      createTableIfMissing: true
    }),
    name: "bwm.sid",
    secret: process.env.SESSION_SECRET ?? "dev-secret-change-me",
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction ? "auto" : false,
      maxAge: 1000 * 60 * 60 * 24 * 30
    }
  })
);

app.get("/api/health", (_req, res) => res.json({ ok: true, name: "Breathing World MUD" }));
app.use("/api/auth", authRouter);
app.use("/api/game", gameRouter);
app.use("/api/admin", adminRouter);

if (isProduction) {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const clientDir = path.resolve(__dirname, "../client");
  app.use(express.static(clientDir));
  app.get(/.*/, (_req, res) => res.sendFile(path.join(clientDir, "index.html")));
}

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(error);
  res.status(500).json({ error: "The world shuddered. Try again." });
});

app.listen(port, () => {
  console.log(`Breathing World MUD API listening on ${port}`);
});
