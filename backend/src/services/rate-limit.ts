import { query } from '../db.ts';
import { AppError } from '../validation.ts';

export async function limit(key: string, max: number, seconds: number) {
  const digest = Array.from(
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key)),
    ),
  )
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('');
  const result = await query<{ allowed: boolean }>(
    'select consume_rate_limit($1,$2,$3) as allowed',
    [digest, max, seconds],
  );
  if (result.rows[0]?.allowed !== true)
    throw new AppError(
      429,
      'Un peu trop de tentatives. Réessaie dans quelques minutes.',
    );
}