import { Router } from 'express';
import { exportAccount, maintenance } from '../services/privacy.ts';
import { requireAuth, type AuthUser } from '../services/auth.ts';
import { limit } from '../services/rate-limit.ts';
import { h } from '../handler.ts';

export const privacyRouter = Router();

privacyRouter.get(
  '/export',
  requireAuth,
  h(async (req, res) => {
    const user = (req as typeof req & { user: AuthUser }).user;
    await limit(`export:${user.id}`, 3, 3600);
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="mes-donnees-jobdiscover.json"',
    );
    res.json(await exportAccount(user));
  }),
);

privacyRouter.post(
  '/maintenance',
  h(async (req, res) => {
    const authorization = String(req.headers.authorization || '');
    res.json(await maintenance(authorization));
  }),
);