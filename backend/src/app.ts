import express, {
  type NextFunction,
  type Request,
  type Response,
} from 'express';
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
  app.use(cookieParser());
  app.use(express.json({ limit: '16kb' }));
  app.set('trust proxy', true);

  app.use('/api', miscRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/profile', profileRouter);
  app.use('/api/feedback', feedbackRouter);
  app.use('/api/offers', offersRouter);
  app.use('/api', privacyRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: 'Page introuvable.' });
  });

  app.use(
    (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
      const status =
        err instanceof AppError
          ? err.status
          : typeof (err as { status?: unknown })?.status === 'number'
            ? ((err as { status: number }).status)
            : 500;
      const message =
        err instanceof AppError
          ? err.message
          : 'Une erreur est survenue. Réessaie dans un instant.';
      res.status(status).json({ error: message });
    },
  );

  return app;
}