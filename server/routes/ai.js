import { Router } from "express";
import rateLimit from "express-rate-limit";
import { aiMatchRequestSchema } from "../validation.js";
import { getProvider, templateProvider, templateReason } from "../ai/providers.js";
import { rankListings } from "../ai/matcher.js";
import { config } from "../config.js";
import { query } from "../db.js";
import { AppError } from "../errors.js";
import { LISTING_SELECT, toListing } from "../lib/mappers.js";
import { logger } from "../logger.js";
import { requireRole } from "../middleware/auth.js";
export const aiRouter = Router();
const REASON_TIMEOUT_MS = 25_000;
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 6, // each call can cost money: 6 per minute per IP is plenty for a human
  skip: () => config.isTest,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: (_req, _res, next) =>
    next(new AppError(429, "too_many_requests", "Slow down - try again in a minute")),
});
/**
 * POST /api/ai/match  { cvText }
 * Streams Server-Sent Events: start -> (match -> reason_delta* -> reason_done)* -> done
 * The browser reads them with fetch() + a stream reader (EventSource cannot POST).
 */
aiRouter.post("/match", requireRole("student"), aiLimiter, async (req, res) => {
  const { cvText } = aiMatchRequestSchema.parse(req.body); // validation errors still return normal JSON 400s
  const reqId = String(req.headers["x-request-id"]);
  const provider = getProvider();
  // From here on we speak SSE. Headers first, then events as they happen.
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no", // tell proxies (nginx) not to buffer the stream
  });
  res.flushHeaders();
  // If the user presses "Stop" or closes the tab, abort everything still running.
  const abort = new AbortController();
  res.on("close", () => abort.abort(new Error("client disconnected")));
  const send = (event) => {
    if (!res.writableEnded) res.write(`data: ${JSON.stringify(event)}\n\n`);
  };
  try {
    const { rows } = await query(
      `${LISTING_SELECT} WHERE l.deadline IS NULL OR l.deadline >= CURRENT_DATE ORDER BY l.created_at DESC LIMIT 300`,
    );
    const candidates = rankListings(cvText, rows.map(toListing), 5);
    logger.info(
      {
        reqId,
        provider: provider.name,
        scanned: rows.length,
        candidates: candidates.length,
      },
      "ai match: ranked",
    );
    send({
      type: "start",
      provider: provider.name,
      totalCandidates: candidates.length,
    });
    for (const c of candidates) {
      if (abort.signal.aborted) return;
      const { listing } = c;
      send({
        type: "match",
        listing: {
          id: listing.id,
          title: listing.title,
          companyName: listing.companyName,
          location: listing.location,
          workType: listing.workType,
        },
        score: c.score,
        matchedSkills: c.matchedSkills,
        missingSkills: c.missingSkills,
      });
      // Each explanation gets its own timeout. If the model is slow or fails we fall back to the
      // template text, so the user always gets an answer and the stream never hangs.
      const started = Date.now();
      const signal = AbortSignal.any([abort.signal, AbortSignal.timeout(REASON_TIMEOUT_MS)]);
      let source = provider === templateProvider ? "template" : "ai";
      let emitted = "";
      try {
        for await (const text of provider.explain(c, cvText, signal)) {
          emitted += text;
          send({ type: "reason_delta", listingId: listing.id, text });
        }
      } catch (err) {
        if (abort.signal.aborted) return; // user cancelled: stop quietly
        logger.warn(
          { reqId, listingId: listing.id, err: String(err) },
          "ai match: provider failed, using template",
        );
        source = "template";
        const fallback = templateReason(c);
        // if part of an AI answer was already streamed, reset it with the fallback text
        send({
          type: "reason_delta",
          listingId: listing.id,
          text: emitted ? ` ${fallback}` : fallback,
        });
      }
      logger.info({ reqId, listingId: listing.id, source, ms: Date.now() - started }, "ai match: explained");
      send({ type: "reason_done", listingId: listing.id, source });
    }
    send({ type: "done" });
  } catch (err) {
    logger.error({ reqId, err }, "ai match: failed");
    send({ type: "error", message: "The matcher failed. Please try again." });
  } finally {
    res.end();
  }
});
