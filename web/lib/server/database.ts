import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import { AppError, type Config } from './core.ts';

let pool: Pool | undefined;
let poolUrl = '';

export function databaseConfigured(c: Config) {
  return Boolean(c.DATABASE_URL);
}

function getPool(c: Config) {
  if (!c.DATABASE_URL)
    throw new AppError(503, 'La base de données n’est pas configurée.');
  if (!pool || poolUrl !== c.DATABASE_URL) {
    void pool?.end();
    poolUrl = c.DATABASE_URL;
    pool = new Pool({
      connectionString: c.DATABASE_URL,
      max: 3,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 8_000,
      ssl: c.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: true },
    });
    pool.on('error', () => undefined);
  }
  return pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  c: Config,
  text: string,
  values: unknown[] = [],
) {
  try {
    return await getPool(c).query<T>(text, values);
  } catch {
    throw new AppError(
      503,
      'Impossible d’enregistrer ou de charger les données pour le moment.',
    );
  }
}

export async function transaction<T>(
  c: Config,
  run: (client: PoolClient) => Promise<T>,
) {
  const client = await getPool(c).connect();
  try {
    await client.query('begin');
    const result = await run(client);
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}
