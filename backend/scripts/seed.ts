import { passwordHash } from '../src/crypto.ts';
import { query } from '../src/db.ts';

if (process.env.ALLOW_DEV_SEED !== 'true')
  throw new Error('Refusing seed without ALLOW_DEV_SEED=true');

const login = 'ggez@example.fr';
const password = 'ggez';
const encoded = await passwordHash(password);

await query(
  `insert into users(email,password_hash,email_verified_at)
   values($1,$2,now())
   on conflict(email) do update set
     password_hash=excluded.password_hash,
     email_verified_at=now(),
     password_changed_at=now()`,
  [login, encoded],
);

process.stdout.write('Compte de développement ggez créé.\n');
process.exit(0);
