import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import fs from "node:fs";
import path from "node:path";
import { pinoHttp } from "pino-http";
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
  app.use(requestId); //                                   1. tag the request with an id
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => String(req.headers["x-request-id"]), // 2. structured access log (uses that id)
      autoLogging: { ignore: (req) => req.url === "/health" },
    }),
  );
  app.use(helmet()); //                                    3. security headers (CSP, no sniffing, ...)
  app.use(cors({ origin: config.clientOrigins, credentials: true })); // 4. who may call us from a browser
  app.use(express.json({ limit: "100kb" })); //            5. parse JSON bodies (size-capped)
  app.use(cookieParser()); //                              6. parse cookies
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
  app.use("/api", originCheck); //                         7. CSRF check on state-changing requests
  app.use("/api", loadUser); //                            8. cookie -> req.user

  // ---- routes ----
  const health = async (_req: express.Request, res: express.Response) => {
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

  // ---- production: the API also serves the built React app (one deployable, no CORS pain) ----
  if (fs.existsSync(path.join(config.webDist, "index.html"))) {
    app.use(express.static(config.webDist, { index: false, maxAge: "1h" }));
    // any other GET is a front-end route (/listings, /login ...): hand it to React Router
    app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(config.webDist, "index.html")));
  }

  app.use(errorHandler); // last: turns any thrown error into a JSON response
  return app;
}
