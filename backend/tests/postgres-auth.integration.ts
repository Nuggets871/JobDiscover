import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import type { AddressInfo } from 'node:net';
import { defaultProfile } from '../src/model.ts';

const databaseUrl = process.env.TEST_DATABASE_URL;

void test(
  'the API supports signup, sessions, profile, feedback and account deletion',
  { skip: !databaseUrl },
  async () => {
    process.env.DATABASE_URL = databaseUrl;
    process.env.DATABASE_SSL = 'false';
    process.env.APP_ORIGIN = 'https://example.test';

    const { createApp } = await import('../src/app.ts');
    const server = createApp().listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

    const client = new pg.Client({ connectionString: databaseUrl });
    await client.connect();
    const email = `account-${crypto.randomUUID()}@example.test`;
    const cookieHeader = (r: Response) => r.headers.get('set-cookie')!.split(';', 1)[0];

    const post = (path: string, body: unknown, cookie = '') =>
      fetch(`${base}${path}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(cookie ? { cookie } : {}),
        },
        body: JSON.stringify(body),
      });
    const get = (path: string, cookie = '') =>
      fetch(`${base}${path}`, { headers: cookie ? { cookie } : {} });

    try {
      const signup = await post('/api/auth/signup', {
        email,
        password: 'une phrase secrète',
      });
      assert.equal(signup.status, 200);
      const cookie = cookieHeader(signup);
      assert.match(cookie, /^jd_session=/);

      assert.equal((await get('/api/me', cookie)).status, 200);
      assert.equal((await (await get('/api/me', cookie)).json()).email, email);

      const profile = { ...defaultProfile, city: 'Lyon' };
      const profilePut = await fetch(`${base}/api/profile`, {
        method: 'PUT',
        headers: { cookie, 'content-type': 'application/json' },
        body: JSON.stringify(profile),
      });
      assert.equal(profilePut.status, 200);
      assert.deepEqual(await (await get('/api/profile', cookie)).json(), profile);

      await client.query(
        `insert into job_cache(id,job,checked_at) values('offre-test', $1::jsonb, now())`,
        [JSON.stringify({ id: 'offre-test', title: 'Accueil', description: 'Accueillir le public' })],
      );
      const feedback = await post(
        '/api/feedback',
        { job_id: 'offre-test', verdict: 'like', reason: null },
        cookie,
      );
      assert.equal(feedback.status, 200);
      const feedbackList = await (await get('/api/feedback', cookie)).json();
      assert.equal(feedbackList.length, 1);
      assert.equal(feedbackList[0].verdict, 'like');

      assert.equal(
        (await post('/api/auth/login', { email, password: 'mauvaise phrase' }))
          .status,
        401,
      );

      const logout = await post('/api/auth/logout', {}, cookie);
      assert.equal(logout.status, 200);
      assert.equal((await get('/api/me', cookie)).status, 401);

      const login = await post('/api/auth/login', {
        email,
        password: 'une phrase secrète',
      });
      assert.equal(login.status, 200);
      const loginCookie = cookieHeader(login);

      const deleteAccount = await post(
        '/api/auth/delete',
        { confirmation: 'SUPPRIMER', password: 'une phrase secrète' },
        loginCookie,
      );
      assert.equal(deleteAccount.status, 200);
      assert.equal(
        (await client.query('select 1 from users where email=$1', [email]))
          .rowCount,
        0,
      );
      assert.equal(
        (await client.query(
          'select 1 from auth_sessions s join users u on u.id=s.user_id where u.email=$1',
          [email],
        )).rowCount,
        0,
      );
    } finally {
      server.close();
      await client.query('delete from users where email=$1', [email]);
      await client.end();
    }
  },
);