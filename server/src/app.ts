import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import { env } from './config/env.js';
import { errorMiddleware } from './middleware/error.middleware.js';
import { authRoutes } from './routes/auth.routes.js';
import { postRoutes } from './routes/post.routes.js';
import { userRoutes } from './routes/user.routes.js';
import { messageRoutes } from './routes/message.routes.js';
import { adminRoutes } from './routes/admin.routes.js';
import { searchRoutes } from './routes/search.routes.js';
import { reportRoutes } from './routes/report.routes.js';
import { organizationRoutes } from './routes/organization.routes.js';
import { communityRoutes } from './routes/community.routes.js';

export function createApp() {
  const app = express();

  // Trust proxy in production (behind DO load balancer)
  if (env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
  }

  // Security headers — extend default CSP to allow OSM tiles and Spaces-hosted images
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          ...helmet.contentSecurityPolicy.getDefaultDirectives(),
          'img-src': [
            "'self'",
            'data:',
            'blob:',
            'https://*.tile.openstreetmap.org',
            'https://*.digitaloceanspaces.com',
            'https://*.cdn.digitaloceanspaces.com',
          ],
          'connect-src': [
            "'self'",
            'https://nominatim.openstreetmap.org',
            'wss:',
          ],
        },
      },
      // Send origin on cross-origin requests so OSM can identify the app
      // (its tile usage policy requires a Referer header).
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
  );

  app.use(cors({
    origin: env.CLIENT_URL,
    credentials: true,
  }));
  app.use(express.json());
  app.use(cookieParser());

  // Rate limiting for auth endpoints (brute-force protection)
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // 20 attempts per window
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many requests, please try again later' },
  });

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Routes
  app.use('/api/auth', authLimiter, authRoutes);
  app.use('/api/posts', postRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/messages', messageRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/search', searchRoutes);
  app.use('/api/reports', reportRoutes);
  app.use('/api/organizations', organizationRoutes);
  app.use('/api/communities', communityRoutes);

  // Serve client static files in production
  if (env.NODE_ENV === 'production') {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const clientDist = path.join(__dirname, '../../client/dist');
    app.use(express.static(clientDist));

    // SPA fallback — serve index.html for all non-API routes
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) {
        return next();
      }
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  // Error handler (must be last)
  app.use(errorMiddleware);

  return app;
}
