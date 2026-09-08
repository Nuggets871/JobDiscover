import { readdir, readFile } from 'node:fs/promises';
import pg from 'pg';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: true },
});
await client.connect();
try {
  await client.query(
    'create table if not exists schema_migrations(name text primary key,applied_at timestamptz not null default now())',
  );
  for (const name of (
    await readdir(new URL('../migrations/', import.meta.url))
  )
    .filter((file) => file.endsWith('.sql'))
    .sort()) {
    const applied = await client.query(
      'select 1 from schema_migrations where name=$1',
      [name],
    );
    if (applied.rowCount) continue;
    await client.query('begin');
    try {
      await client.query(
        await readFile(
          new URL(`../migrations/${name}`, import.meta.url),
          'utf8',
        ),
      );
      await client.query('insert into schema_migrations(name) values($1)', [
        name,
      ]);
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    }
    process.stdout.write(`Applied ${name}\n`);
  }
} finally {
  await client.end();
}