import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { authAction } from '../lib/server/auth.ts';
import { authenticate, type Config } from '../lib/server/core.ts';

const databaseUrl = process.env.TEST_DATABASE_URL;

void test(
  'PostgreSQL auth supports verification, rotation, password reset and deletion',
  { skip: !databaseUrl },
  async () => {
    const c: Config = {
      APP_ORIGIN: 'https://example.test',
      DATABASE_URL: databaseUrl,
      DATABASE_SSL: 'false',
      RESEND_API_KEY: 'test-mail-key',
      EMAIL_FROM: 'JobDiscover <test@example.test>',
    };
    const client = new pg.Client({ connectionString: databaseUrl });
    await client.connect();
    const email = `account-${crypto.randomUUID()}@example.test`;
    const originalFetch = globalThis.fetch;
    let emailedToken = '';
    globalThis.fetch = (async (
      _input: RequestInfo | URL,
      init?: RequestInit,
    ) => {
      const payload = JSON.parse(init?.body as string);
      const match = String(payload.text).match(/token_hash=([a-zA-Z0-9_-]+)/);
      emailedToken = match?.[1] || '';
      return Response.json({ id: 'email-fixture' });
    }) as typeof fetch;
    try {
      await authAction(
        new Request('https://example.test/api/auth/signup'),
        c,
        'signup',
        {
          email,
          password: 'première phrase secrète',
        },
      );
      assert.match(emailedToken, /^[a-zA-Z0-9_-]{40,}$/);
      const stored = await client.query(
        'select password_hash from users where email=$1',
        [email],
      );
      assert.equal(stored.rowCount, 1);
      assert.doesNotMatch(
        stored.rows[0].password_hash,
        /première phrase secrète/,
      );

      const confirmed = await authAction(
        new Request('https://example.test/api/auth/confirm'),
        c,
        'confirm',
        {
          token_hash: emailedToken,
          type: 'email',
        },
      );
      const cookies = confirmed.headers.getSetCookie();
      const cookieHeader = cookies
        .map((cookie) => cookie.split(';', 1)[0])
        .join('; ');
      const sessionRequest = new Request('https://example.test/api/me', {
        headers: { cookie: cookieHeader },
      });
      assert.equal((await authenticate(sessionRequest, c)).email, email);
      await assert.rejects(
        authAction(
          new Request('https://example.test/api/auth/confirm'),
          c,
          'confirm',
          { token_hash: emailedToken, type: 'email' },
        ),
        /expiré|utilisé/,
      );

      const refreshCookie = cookies.find((cookie) =>
        cookie.startsWith('__Host-jd_refresh='),
      )!;
      const refreshed = await authAction(
        new Request('https://example.test/api/auth/refresh', {
          headers: { cookie: refreshCookie.split(';', 1)[0] },
        }),
        c,
        'refresh',
        {},
      );
      assert.equal(refreshed.status, 200);
      const replay = await authAction(
        new Request('https://example.test/api/auth/refresh', {
          headers: { cookie: refreshCookie.split(';', 1)[0] },
        }),
        c,
        'refresh',
        {},
      );
      assert.equal(replay.status, 401);

      const refreshedCookieHeader = refreshed.headers
        .getSetCookie()
        .map((cookie) => cookie.split(';', 1)[0])
        .join('; ');

      await authAction(
        new Request('https://example.test/api/auth/recover'),
        c,
        'recover',
        { email },
      );
      const recovered = await authAction(
        new Request('https://example.test/api/auth/confirm'),
        c,
        'confirm',
        {
          token_hash: emailedToken,
          type: 'recovery',
        },
      );
      const recoveryCookieHeader = recovered.headers
        .getSetCookie()
        .map((cookie) => cookie.split(';', 1)[0])
        .join('; ');
      await authAction(
        new Request('https://example.test/api/auth/password', {
          headers: { cookie: recoveryCookieHeader },
        }),
        c,
        'password',
        { password: 'deuxième phrase secrète' },
      );
      await assert.rejects(
        authAction(
          new Request('https://example.test/api/auth/login'),
          c,
          'login',
          {
            email,
            password: 'première phrase secrète',
          },
        ),
        /Connexion impossible/,
      );
      const loggedIn = await authAction(
        new Request('https://example.test/api/auth/login'),
        c,
        'login',
        {
          email,
          password: 'deuxième phrase secrète',
        },
      );
      const loginCookieHeader = loggedIn.headers
        .getSetCookie()
        .map((cookie) => cookie.split(';', 1)[0])
        .join('; ');
      await assert.rejects(
        authenticate(
          new Request('https://example.test/api/me', {
            headers: { cookie: refreshedCookieHeader },
          }),
          c,
        ),
        /expiré/,
      );

      await authAction(
        new Request('https://example.test/api/me', {
          headers: { cookie: loginCookieHeader },
        }),
        c,
        'delete',
        {
          confirmation: 'SUPPRIMER',
          password: 'deuxième phrase secrète',
        },
      );
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
      globalThis.fetch = originalFetch;
      await client.query('delete from users where email=$1', [email]);
      await client.end();
    }
  },
);
