import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "path";
import { fileURLToPath } from "url";
import { env } from "./config/env.js";
import { errorMiddleware } from "./middleware/error.middleware.js";
import { authRoutes } from "./routes/auth.routes.js";
import { postRoutes } from "./routes/post.routes.js";
import { userRoutes } from "./routes/user.routes.js";
import { messageRoutes } from "./routes/message.routes.js";
import { adminRoutes } from "./routes/admin.routes.js";
import { searchRoutes } from "./routes/search.routes.js";
import { reportRoutes } from "./routes/report.routes.js";
import { bugReportRoutes } from "./routes/bugReport.routes.js";
import { organizationRoutes } from "./routes/organization.routes.js";
import { communityRoutes } from "./routes/community.routes.js";
import { friendRoutes } from "./routes/friend.routes.js";
import { announcementRoutes } from "./routes/announcement.routes.js";
import { pushRoutes } from "./routes/push.routes.js";
import { deviceRoutes } from "./routes/device.routes.js";

export function createApp() {
  const app = express();

  // Trust proxy in production (behind DO load balancer)
  if (env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
  }

  // Security headers — extend default CSP to allow OSM tiles and Spaces-hosted images
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          ...helmet.contentSecurityPolicy.getDefaultDirectives(),
          "img-src": [
            "'self'",
            "data:",
            "blob:",
            "https://*.tile.openstreetmap.org",
            "https://*.digitaloceanspaces.com",
            "https://*.cdn.digitaloceanspaces.com",
          ],
          "connect-src": [
            "'self'",
            "https://nominatim.openstreetmap.org",
            "wss:",
          ],
        },
      },
      // Send origin on cross-origin requests so OSM can identify the app
      // (its tile usage policy requires a Referer header).
      referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    }),
  );

  app.use(
    cors({
      origin: env.CLIENT_URL,
      credentials: true,
    }),
  );
  app.use(express.json());
  // CSRF protection comes from the refresh cookie's SameSite=Strict attribute
  // (see setRefreshCookie in auth.routes.ts) — the refresh cookie is the only
  // cookie used for auth, and browsers won't send it on cross-site requests.
  // All other state-changing endpoints authenticate via Authorization: Bearer.
  app.use(cookieParser());

  // Rate limiting is bypassed outside production. React StrictMode + HMR makes
  // it trivial to exhaust a 20/15min budget during dev, and the production
  // thresholds are what we actually care about validating.
  const limiterDisabled = env.NODE_ENV !== "production";

  // Rate limiting for auth endpoints (brute-force protection)
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // 20 attempts per window
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => limiterDisabled,
    message: { message: "Too many requests, please try again later" },
  });

  // Outer perimeter limiter for all /api routes (stacks with authLimiter on /api/auth)
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => limiterDisabled,
    message: { message: "Too many requests, please try again later" },
  });

  // Health check (mounted before apiLimiter so monitors aren't throttled)
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Client error beacon. The client posts here (via sendBeacon) when the app
  // fails to boot or hits an uncaught error — including before login — so
  // otherwise-invisible failures (e.g. a blank first paint on mobile) surface
  // in the server logs. Unauthenticated by design. It has its own limiter so a
  // reload loop on one device can't exhaust the shared /api budget, and is
  // mounted before that budget for the same reason.
  const clientLogLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => limiterDisabled,
  });
  app.post("/api/client-logs", clientLogLimiter, (req, res) => {
    const b = (req.body ?? {}) as Record<string, unknown>;
    const str = (v: unknown, max: number) =>
      typeof v === "string" ? v.slice(0, max) : undefined;
    console.warn("[client-log]", {
      kind: str(b.kind, 64) ?? "unknown",
      detail: str(b.detail, 2000),
      url: str(b.url, 500),
      userAgent: str(b.userAgent, 300),
      referrer: str(b.referrer, 500),
      standalone: typeof b.standalone === "boolean" ? b.standalone : undefined,
      ip: req.ip,
    });
    res.status(204).end();
  });

  app.use("/api", apiLimiter);

  // Routes
  app.use("/api/auth", authLimiter, authRoutes);
  app.use("/api/posts", postRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api/messages", messageRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/search", searchRoutes);
  app.use("/api/reports", reportRoutes);
  app.use("/api/bug-reports", bugReportRoutes);
  app.use("/api/organizations", organizationRoutes);
  app.use("/api/communities", communityRoutes);
  app.use("/api/friends", friendRoutes);
  app.use("/api/announcements", announcementRoutes);
  app.use("/api/push", pushRoutes);
  app.use("/api/devices", deviceRoutes);

  // Serve client static files in production
  if (env.NODE_ENV === "production") {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const clientDist = path.join(__dirname, "../../client/dist");
    app.use(express.static(clientDist));

    // SPA fallback — serve index.html for all non-API routes
    app.get("*", apiLimiter, (req, res, next) => {
      if (req.path.startsWith("/api/")) {
        return next();
      }
      res.sendFile(path.join(clientDist, "index.html"));
    });
  }

  // Error handler (must be last)
  app.use(errorMiddleware);

  return app;
}
