import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import type { AddressInfo } from 'node:net';
import { defaultProfile } from '../src/model.ts';

const databaseUrl = process.env.TEST_DATABASE_URL;

void test(
  'the API supports email-first signup, sessions, profile, feedback and account deletion',
  { skip: !databaseUrl },
  async () => {
    process.env.DATABASE_URL = databaseUrl;
    process.env.DATABASE_SSL = 'false';
    process.env.APP_ORIGIN = 'https://example.test';
    process.env.AUTH_EMAIL_MODE = 'console';

    const { createApp } = await import('../src/app.ts');
    const { __setEmailCapture } = await import('../src/services/email.ts');
    let emailUrl = '';
    __setEmailCapture((url) => {
      emailUrl = url;
    });
    const server = createApp().listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

    const client = new pg.Client({ connectionString: databaseUrl });
    await client.connect();
    const email = `account-${crypto.randomUUID()}@example.test`;
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
      const start = await post('/api/auth/start', { email });
      assert.equal(start.status, 200);
      assert.equal((await get('/api/me')).status, 401);

      const confirmation = new URL(emailUrl);
      assert.equal(confirmation.searchParams.get('type'), 'email');
      const confirmed = await post('/api/auth/confirm', {
        token: confirmation.searchParams.get('token'),
        type: confirmation.searchParams.get('type'),
      });
      assert.equal(confirmed.status, 200);
      const createdBody = await confirmed.json();
      assert.equal(createdBody.recovery, false);
      assert.equal(createdBody.created, true);
      assert.equal(createdBody.passwordless, true);
      const cookie = cookieHeader(confirmed);
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

      const setPassword = await post(
        '/api/auth/password',
        { password: 'une phrase secrète' },
        cookie,
      );
      assert.equal(setPassword.status, 200);
      assert.equal(setPassword.headers.get('set-cookie'), null);
      assert.equal((await get('/api/me', cookie)).status, 200);

      const logout = await post('/api/auth/logout', {}, cookie);
      assert.equal(logout.status, 200);
      assert.equal((await get('/api/me', cookie)).status, 401);

      const login = await post('/api/auth/login', {
        email,
        password: 'une phrase secrète',
      });
      assert.equal(login.status, 200);
      const loginCookie = cookieHeader(login);

      const startAgain = await post('/api/auth/start', { email });
      assert.equal(startAgain.status, 200);
      const link = new URL(emailUrl);
      assert.equal(link.searchParams.get('type'), 'login');
      const linkConfirmed = await post('/api/auth/confirm', {
        token: link.searchParams.get('token'),
        type: link.searchParams.get('type'),
      });
      assert.equal(linkConfirmed.status, 200);
      const linkBody = await linkConfirmed.json();
      assert.equal(linkBody.created, false);
      assert.equal(linkBody.passwordless, false);
      assert.equal((await get('/api/me', cookieHeader(linkConfirmed))).status, 200);

      const recovery = await post('/api/auth/recover', { email });
      assert.equal(recovery.status, 200);
      const recoveryUrl = new URL(emailUrl);
      const recoveryConfirmation = await post('/api/auth/confirm', {
        token: recoveryUrl.searchParams.get('token'),
        type: recoveryUrl.searchParams.get('type'),
      });
      assert.equal(recoveryConfirmation.status, 200);
      const recoveryBody = await recoveryConfirmation.json();
      assert.equal(recoveryBody.recovery, true);
      const recoveryCookie = cookieHeader(recoveryConfirmation);
      assert.equal(
        (
          await post('/api/auth/confirm', {
            token: recoveryUrl.searchParams.get('token'),
            type: recoveryUrl.searchParams.get('type'),
          })
        ).status,
        400,
      );
      const reset = await post(
        '/api/auth/password',
        {
          password: 'une nouvelle phrase secrète',
        },
        recoveryCookie,
      );
      assert.equal(reset.status, 200);
      assert.match(reset.headers.get('set-cookie') || '', /Max-Age=0/);
      assert.equal((await get('/api/me', recoveryCookie)).status, 401);
      assert.equal(
        (
          await post('/api/auth/login', {
            email,
            password: 'une phrase secrète',
          })
        ).status,
        401,
      );
      const newLogin = await post('/api/auth/login', {
        email,
        password: 'une nouvelle phrase secrète',
      });
      assert.equal(newLogin.status, 200);
      const newCookie = cookieHeader(newLogin);

      const deleteAccount = await post(
        '/api/auth/delete',
        { confirmation: 'SUPPRIMER', password: 'une nouvelle phrase secrète' },
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

      const passwordlessEmail = `passwordless-${crypto.randomUUID()}@example.test`;
      await post('/api/auth/start', { email: passwordlessEmail });
      const passwordlessUrl = new URL(emailUrl);
      const passwordlessConfirmed = await post('/api/auth/confirm', {
        token: passwordlessUrl.searchParams.get('token'),
        type: passwordlessUrl.searchParams.get('type'),
      });
      assert.equal(passwordlessConfirmed.status, 200);
      const passwordlessBody = await passwordlessConfirmed.json();
      assert.equal(passwordlessBody.passwordless, true);
      const passwordlessCookie = cookieHeader(passwordlessConfirmed);
      const deletePasswordless = await post(
        '/api/auth/delete',
        { confirmation: 'SUPPRIMER' },
        passwordlessCookie,
      );
      assert.equal(deletePasswordless.status, 200);
      assert.equal(
        (
          await client.query('select 1 from users where email=$1', [
            passwordlessEmail,
          ])
        ).rowCount,
        0,
      );
    } finally {
      __setEmailCapture(null);
      server.close();
      await client.query('delete from users where email=$1', [email]);
      await client.query('delete from job_cache where id=$1', [jobId]);
      await client.end();
    }
  },
);
