import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

import { pool } from "./db.js";
import authRouter from "./routes/auth.js";
import profileRouter from "./routes/profile.js";
import customersRouter from "./routes/customers.js";
import productsRouter from "./routes/products.js";
import licensesRouter from "./routes/licenses.js";
import paymentsRouter from "./routes/payments.js";
import paymentSettingsRouter from "./routes/payment-settings.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use(
  cors({
    origin: (origin, cb) => cb(null, true),
    credentials: true,
  }),
);

app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true, db: "up" });
  } catch (err) {
    res.status(500).json({ ok: false, db: "down", error: (err as Error).message });
  }
});

app.use("/api/auth", authRouter);
app.use("/api/profile", profileRouter);
app.use("/api/customers", customersRouter);
app.use("/api/products", productsRouter);
app.use("/api/licenses", licensesRouter);
app.use("/api/payments", paymentsRouter);
app.use("/api/payment-settings", paymentSettingsRouter);

// Servir frontend buildado (web/) se existir
const webDir = path.resolve(__dirname, "../web");
if (fs.existsSync(webDir)) {
  app.use(express.static(webDir));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    const indexFile = path.join(webDir, "index.html");
    if (fs.existsSync(indexFile)) return res.sendFile(indexFile);
    next();
  });
} else {
  app.get("/", (_req, res) => {
    res
      .type("text/plain")
      .send(
        "Axis Licenças — backend rodando.\n\n" +
          "Frontend ainda não foi copiado para selfhost/web/.\n" +
          "API disponível em /api/*. Use /api/health para verificar.\n",
      );
  });
}

// Error handler genérico
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[server.error]", err);
  res.status(500).json({ error: "Erro interno" });
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, "0.0.0.0", () => {
  console.log(`[server] axis-licencas rodando em http://0.0.0.0:${port}`);
});
