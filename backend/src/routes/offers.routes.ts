import { Router } from 'express';
import { query } from '../db.ts';
import { defaultProfile } from '../model.ts';
import { validateProfile, AppError } from '../validation.ts';
import { requireAuth, type AuthUser } from '../services/auth.ts';
import { searchOffers, verifyJob } from '../services/offers.ts';
import { enrich } from '../services/enrichment.ts';
import { limit } from '../services/rate-limit.ts';
import { h } from '../handler.ts';

export const offersRouter = Router();

offersRouter.use(requireAuth);

offersRouter.get(
  '/',
  h(async (req, res) => {
    const user = (req as typeof req & { user: AuthUser }).user;
    await limit(`user:${user.id}`, 120, 60);
    await limit(`search:${user.id}`, 12, 600);
    const { rows } = await query<{ preferences: unknown }>(
      'select preferences from profiles where user_id=$1',
      [user.id],
    );
    const p = validateProfile(rows[0]?.preferences || defaultProfile);
    res.json(await searchOffers(p));
  }),
);

offersRouter.get(
  '/:id',
  h(async (req, res) => {
    const user = (req as typeof req & { user: AuthUser }).user;
    const id = req.params.id || '';
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(id))
      throw new AppError(400, 'Offre invalide.');
    await limit(`user:${user.id}`, 120, 60);
    await limit(`detail:${user.id}`, 30, 600);
    res.json(await enrich(await verifyJob(id)));
  }),
);