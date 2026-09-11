import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import type { AddressInfo } from 'node:net';
import { defaultProfile } from '../src/model.ts';

const databaseUrl = process.env.TEST_DATABASE_URL;

void test(
  'the API supports email+password signup, sessions, profile, feedback and account deletion',
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
    const password = 'une longue phrase secrète';
    const jobId = `integration-${crypto.randomUUID()}`;
    const cookieHeader = (r: Response) =>
      r.headers.get('set-cookie')!.split(';', 1)[0];

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
      const registered = await post('/api/auth/register', {
        email,
        password,
      });
      assert.equal(registered.status, 200);
      const cookie = cookieHeader(registered);
      assert.match(cookie, /^jd_session=/);
      assert.equal((await get('/api/me', cookie)).status, 200);
      assert.equal((await (await get('/api/me', cookie)).json()).email, email);

      const duplicate = await post('/api/auth/register', { email, password });
      assert.equal(duplicate.status, 409);

      const profile = { ...defaultProfile, city: 'Lyon' };
      const profilePut = await fetch(`${base}/api/profile`, {
        method: 'PUT',
        headers: { cookie, 'content-type': 'application/json' },
        body: JSON.stringify(profile),
      });
      assert.equal(profilePut.status, 200);
      assert.deepEqual(
        await (await get('/api/profile', cookie)).json(),
        profile,
      );

      await client.query(
        `insert into job_cache(id,job,checked_at) values($1, $2::jsonb, now())`,
        [
          jobId,
          JSON.stringify({
            id: jobId,
            title: 'Accueil',
            description: 'Accueillir le public',
          }),
        ],
      );
      const feedback = await post(
        '/api/feedback',
        { job_id: jobId, verdict: 'like', reason: null },
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

      const login = await post('/api/auth/login', { email, password });
      assert.equal(login.status, 200);
      const loginCookie = cookieHeader(login);
      assert.equal((await get('/api/me', loginCookie)).status, 200);

      const change = await post(
        '/api/auth/password',
        { password: 'une nouvelle phrase secrète' },
        loginCookie,
      );
      assert.equal(change.status, 200);
      assert.match(change.headers.get('set-cookie') || '', /Max-Age=0/);
      assert.equal((await get('/api/me', loginCookie)).status, 401);
      assert.equal(
        (await post('/api/auth/login', { email, password })).status,
        401,
      );
      const newPassword = 'une nouvelle phrase secrète';
      const newLogin = await post('/api/auth/login', {
        email,
        password: newPassword,
      });
      assert.equal(newLogin.status, 200);
      const newCookie = cookieHeader(newLogin);

      const deleteAccount = await post(
        '/api/auth/delete',
        { confirmation: 'SUPPRIMER', password: newPassword },
        newCookie,
      );
      assert.equal(deleteAccount.status, 200);
      assert.equal(
        (await client.query('select 1 from users where email=$1', [email]))
          .rowCount,
        0,
      );
      assert.equal(
        (
          await client.query(
            'select 1 from auth_sessions s join users u on u.id=s.user_id where u.email=$1',
            [email],
          )
        ).rowCount,
        0,
      );
    } finally {
      server.close();
      await client.query('delete from users where email=$1', [email]);
      await client.query('delete from job_cache where id=$1', [jobId]);
      await client.end();
    }
  },
);