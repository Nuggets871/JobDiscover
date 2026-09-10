import { Router } from 'express';
import { query } from '../db.ts';
import { defaultProfile, type Profile } from '../model.ts';
import { validateProfile, string, object, AppError } from '../validation.ts';
import { requireAuth, type AuthUser } from '../services/auth.ts';
import { analyzeDesires } from '../services/desires.ts';
import { h } from '../handler.ts';

export const profileRouter = Router();

profileRouter.use(requireAuth);

profileRouter.get(
  '/',
  h(async (req, res) => {
    const user = (req as typeof req & { user: AuthUser }).user;
    const { rows } = await query<{ preferences: unknown }>(
      'select preferences from profiles where user_id=$1',
      [user.id],
    );
    res.json(
      rows.length
        ? { ...defaultProfile, ...(rows[0].preferences as Partial<Profile>) }
        : defaultProfile,
    );
  }),
);

profileRouter.put(
  '/',
  h(async (req, res) => {
    const user = (req as typeof req & { user: AuthUser }).user;
    const p = validateProfile(req.body);
    await query(
      `insert into profiles(user_id,preferences,updated_at) values($1,$2,now())
      on conflict(user_id) do update set preferences=excluded.preferences,updated_at=excluded.updated_at`,
      [user.id, p],
    );
    res.json(p);
  }),
);

profileRouter.post(
  '/desires',
  h(async (req, res) => {
    const user = (req as typeof req & { user: AuthUser }).user;
    const text = string(object(req.body).text, 2000);
    if (text.length < 10)
      throw new AppError(400, 'Décris en quelques mots ce que tu aimerais faire.');
    res.json(await analyzeDesires(user.id, text));
  }),
);