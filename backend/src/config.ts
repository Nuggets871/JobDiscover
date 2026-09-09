export type Config = {
  DATABASE_URL: string;
  DATABASE_SSL: boolean;
  APP_ORIGIN: string;
  SESSION_DAYS: number;
  AUTH_EMAIL_MODE: 'smtp' | 'console';
  SMTP_HOST?: string;
  SMTP_PORT?: number;
  SMTP_USER?: string;
  SMTP_PASS?: string;
  EMAIL_FROM?: string;
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
    AUTH_EMAIL_MODE:
      process.env.AUTH_EMAIL_MODE === 'console' ? 'console' : 'smtp',
    SMTP_HOST: process.env.SMTP_HOST || undefined,
    SMTP_PORT: process.env.SMTP_PORT
      ? Number(process.env.SMTP_PORT)
      : undefined,
    SMTP_USER: process.env.SMTP_USER || undefined,
    SMTP_PASS: process.env.SMTP_PASS || undefined,
    EMAIL_FROM: process.env.EMAIL_FROM || undefined,
    FRANCE_TRAVAIL_CLIENT_ID: process.env.FRANCE_TRAVAIL_CLIENT_ID || undefined,
    FRANCE_TRAVAIL_CLIENT_SECRET:
      process.env.FRANCE_TRAVAIL_CLIENT_SECRET || undefined,
    DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY || undefined,
    DEEPSEEK_MODEL: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
    AI_PUBLIC_JOB_ENRICHMENT: process.env.AI_PUBLIC_JOB_ENRICHMENT || 'false',
    CRON_SECRET: process.env.CRON_SECRET || undefined,
  };
}
