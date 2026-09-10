import express, {
  type NextFunction,
  type Request,
  type Response,
} from 'express';
import path from 'node:path';
import cookieParser from 'cookie-parser';
import { AppError } from './validation.ts';
import { authRouter } from './routes/auth.routes.ts';
import { profileRouter } from './routes/profile.routes.ts';
import { feedbackRouter } from './routes/feedback.routes.ts';
import { offersRouter } from './routes/offers.routes.ts';
import { privacyRouter } from './routes/privacy.routes.ts';
import { miscRouter } from './routes/misc.routes.ts';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), payment=()',
    );
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Vary', 'Cookie');
    const unsafe = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
    const origin = req.get('origin');
    const expected = new URL(process.env.APP_ORIGIN || 'http://localhost:5173')
      .origin;
    if (
      unsafe &&
      req.path !== '/api/maintenance' &&
      ((origin && origin !== expected) ||
        req.get('sec-fetch-site') === 'cross-site')
    ) {
      res.status(403).json({ error: 'Requête non autorisée.' });
      return;
    }
    next();
  });
  app.use(cookieParser());
  app.use(express.json({ limit: '16kb' }));
  app.set('trust proxy', true);

  app.use('/api', miscRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/profile', profileRouter);
  app.use('/api/feedback', feedbackRouter);
  app.use('/api/offers', offersRouter);
  app.use('/api', privacyRouter);

  const publicDir = process.env.PUBLIC_DIR;
  if (publicDir) {
    app.use(
      express.static(publicDir, {
        setHeaders(res, filePath) {
          if (filePath.includes(`${path.sep}assets${path.sep}`))
            res.setHeader(
              'Cache-Control',
              'public, max-age=31536000, immutable',
            );
        },
      }),
    );
    app.use((req, res, next) => {
      if (req.method === 'GET' && !req.path.startsWith('/api/')) {
        res.sendFile('index.html', { root: publicDir });
        return;
      }
      next();
    });
  }

  app.use((_req, res) => {
    res.status(404).json({ error: 'Page introuvable.' });
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const status =
      err instanceof AppError
        ? err.status
        : typeof (err as { status?: unknown })?.status === 'number'
          ? (err as { status: number }).status
          : 500;
    const message =
      err instanceof AppError
        ? err.message
        : 'Une erreur est survenue. Réessaie dans un instant.';
    res.status(status).json({ error: message });
  });

  return app;
}
