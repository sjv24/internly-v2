import cookieParser from "cookie-parser";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { config } from "./config.js";
import { query } from "./db.js";
import { logger } from "./logger.js";
import { loadUser } from "./middleware/auth.js";
import { apiNotFound, errorHandler } from "./middleware/errorHandler.js";
import { originCheck } from "./middleware/originCheck.js";
import { requestId } from "./middleware/requestId.js";
import { accountRouter } from "./routes/account.js";
import { aiRouter } from "./routes/ai.js";
import { applicationsRouter } from "./routes/applications.js";
import { authRouter } from "./routes/auth.js";
import { listingsRouter } from "./routes/listings.js";

/** Builds the Express app. Kept separate from `listen()` so tests can use it without a port. */
export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  if (config.isProd) app.set("trust proxy", 1); // behind the hosting platform's proxy

  // ---- the middleware pipeline: every request flows through these, top to bottom ----
  app.use(requestId); //                        1. tag the request with an id
  app.use((req, res, next) => {
    //                                          2. access log: one JSON line per finished request
    const started = Date.now();
    res.on("finish", () => {
      if (req.path === "/health") return;
      logger.info(
        {
          reqId: req.headers["x-request-id"],
          method: req.method,
          url: req.originalUrl,
          status: res.statusCode,
          ms: Date.now() - started,
        },
        "request",
      );
    });
    next();
  });
  app.use(helmet()); //                         3. security headers (CSP, no sniffing, ...)
  app.use(express.json({ limit: "100kb" })); // 4. parse JSON bodies (size-capped)
  app.use(cookieParser()); //                   5. parse cookies
  app.use(
    "/api",
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 600,
      skip: () => config.isTest,
      standardHeaders: "draft-7",
      legacyHeaders: false,
    }),
  );
  app.use("/api", originCheck); //              6. CSRF check on state-changing requests
  app.use("/api", loadUser); //                 7. cookie -> req.user

  // ---- API routes ----
  const health = async (_req, res) => {
    try {
      await query("SELECT 1");
      res.json({ status: "ok", db: "up", uptimeSeconds: Math.round(process.uptime()) });
    } catch {
      res.status(503).json({ status: "degraded", db: "down" });
    }
  };
  app.get("/health", health);
  app.get("/api/health", health);

  app.use("/api/auth", authRouter);
  app.use("/api/listings", listingsRouter);
  app.use("/api/applications", applicationsRouter);
  app.use("/api/account", accountRouter);
  app.use("/api/ai", aiRouter);
  app.use("/api", apiNotFound);

  // ---- the front end: plain HTML/CSS/JS files served as they are (no build step) ----
  // `extensions: ["html"]` lets /listings open public/listings.html
  app.use(express.static(config.publicDir, { extensions: ["html"], maxAge: config.isProd ? "1h" : 0 }));
  app.use((_req, res) => res.status(404).sendFile("404.html", { root: config.publicDir }));

  app.use(errorHandler); // last: turns any thrown error into a JSON response
  return app;
}
