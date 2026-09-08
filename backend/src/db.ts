import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import { config } from './config.ts';
import { AppError } from './validation.ts';

let pool: Pool | null = null;

function getPool() {
  const c = config();
  if (!c.DATABASE_URL)
    throw new AppError(503, 'La base de données n’est pas configurée.');
  if (!pool) {
    pool = new Pool({
      connectionString: c.DATABASE_URL,
      max: 3,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 8_000,
      ssl: c.DATABASE_SSL ? { rejectUnauthorized: true } : false,
    });
    pool.on('error', () => undefined);
  }
  return pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values: unknown[] = [],
) {
  try {
    return await getPool().query<T>(text, values);
  } catch {
    throw new AppError(
      503,
      'Impossible d’enregistrer ou de charger les données pour le moment.',
    );
  }
}

export async function transaction<T>(run: (client: PoolClient) => Promise<T>) {
  const client = await getPool().connect();
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