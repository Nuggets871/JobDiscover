export type Config = {
  DATABASE_URL: string;
  DATABASE_SSL: boolean;
  APP_ORIGIN: string;
  SESSION_DAYS: number;
  FRANCE_TRAVAIL_CLIENT_ID?: string;
  FRANCE_TRAVAIL_CLIENT_SECRET?: string;
  DEEPSEEK_API_KEY?: string;
  DEEPSEEK_MODEL: string;
  AI_PUBLIC_JOB_ENRICHMENT: string;
  CRON_SECRET?: string;
};

export function config(): Config {
  return {
    DATABASE_URL: process.env.DATABASE_URL || '',
    DATABASE_SSL: process.env.DATABASE_SSL !== 'false',
    APP_ORIGIN: process.env.APP_ORIGIN || 'http://localhost:5173',
    SESSION_DAYS: Number(process.env.SESSION_DAYS || 30),
    FRANCE_TRAVAIL_CLIENT_ID:
      process.env.FRANCE_TRAVAIL_CLIENT_ID || undefined,
    FRANCE_TRAVAIL_CLIENT_SECRET:
      process.env.FRANCE_TRAVAIL_CLIENT_SECRET || undefined,
    DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY || undefined,
    DEEPSEEK_MODEL: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
    AI_PUBLIC_JOB_ENRICHMENT:
      process.env.AI_PUBLIC_JOB_ENRICHMENT || 'false',
    CRON_SECRET: process.env.CRON_SECRET || undefined,
  };
}