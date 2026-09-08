import { Router } from 'express';
import { remote, requireOK } from '../services/http.ts';
import { AppError } from '../validation.ts';
import { requireAuth, type AuthUser } from '../services/auth.ts';
import { h } from '../handler.ts';

export const miscRouter = Router();

miscRouter.get('/health', (_req, res) => res.send('ok'));

miscRouter.get(
  '/me',
  requireAuth,
  h(async (req, res) => {
    const user = (req as typeof req & { user: AuthUser }).user;
    res.json({ email: user.email });
  }),
);

miscRouter.get(
  '/status',
  h(async (_req, res) => {
    res.json({
      accounts: Boolean(process.env.DATABASE_URL),
      offers: Boolean(
        process.env.FRANCE_TRAVAIL_CLIENT_ID &&
          process.env.FRANCE_TRAVAIL_CLIENT_SECRET,
      ),
      ai: Boolean(process.env.DEEPSEEK_API_KEY),
    });
  }),
);

miscRouter.get(
  '/communes',
  h(async (req, res) => {
    const postal = String(req.query.postal || '');
    if (!/^[0-9]{5}$/.test(postal))
      throw new AppError(400, 'Entre un code postal à 5 chiffres.');
    const r = await remote(
      `https://geo.api.gouv.fr/communes?codePostal=${postal}&fields=nom,code,centre&format=json`,
    );
    await requireOK(r);
    res.json(await r.json());
  }),
);