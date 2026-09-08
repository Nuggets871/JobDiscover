import { Router } from 'express';
import { query } from '../db.ts';
import type { Reaction } from '../model.ts';
import { validateFeedback, AppError } from '../validation.ts';
import { requireAuth, type AuthUser } from '../services/auth.ts';
import { cachedJob } from '../services/offers.ts';
import { h } from '../handler.ts';

export const feedbackRouter = Router();

feedbackRouter.use(requireAuth);

feedbackRouter.get(
  '/',
  h(async (req, res) => {
    const user = (req as typeof req & { user: AuthUser }).user;
    const { rows } = await query(
      'select job_id,verdict,reason,job,created_at from feedback where user_id=$1 order by created_at desc limit 1000',
      [user.id],
    );
    res.json(rows);
  }),
);

feedbackRouter.post(
  '/',
  h(async (req, res) => {
    const user = (req as typeof req & { user: AuthUser }).user;
    const f = validateFeedback(req.body);
    const job = await cachedJob(f.job_id);
    await query(
      `insert into feedback(user_id,job_id,verdict,reason,job,created_at) values($1,$2,$3,$4,$5,now())
      on conflict(user_id,job_id) do update set verdict=excluded.verdict,reason=excluded.reason,job=excluded.job,created_at=excluded.created_at`,
      [user.id, f.job_id, f.verdict, f.reason, job],
    );
    res.json({ ...f, job });
  }),
);

feedbackRouter.delete(
  '/',
  h(async (req, res) => {
    const user = (req as typeof req & { user: AuthUser }).user;
    const id = String(req.query.id || '');
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(id))
      throw new AppError(400, 'Offre invalide.');
    await query('delete from feedback where user_id=$1 and job_id=$2', [
      user.id,
      id,
    ]);
    res.json({ ok: true });
  }),
);