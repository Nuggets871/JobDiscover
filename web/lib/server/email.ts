import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { AppError, type Config } from './core.ts';

export type EmailCapture = (url: string, to: string) => void;
export let __emailCapture: EmailCapture | null = null;
export function __setEmailCapture(fn: EmailCapture | null) {
  __emailCapture = fn;
}

let transporter: Transporter | null = null;
let transporterKey = '';

function getTransporter(c: Config) {
  const host = c.SMTP_HOST;
  const port = c.SMTP_PORT;
  const user = c.SMTP_USER;
  const pass = c.SMTP_PASS;
  if (!host || !port || !user || !pass) return null;
  const key = `${host}:${port}:${user}`;
  if (!transporter || transporterKey !== key) {
    transporter = nodemailer.createTransport({
      host,
      port: Number(port),
      secure: port === '465',
      auth: { user, pass },
    });
    transporterKey = key;
  }
  return transporter;
}

export function emailConfigured(c: Config) {
  return Boolean(
    c.SMTP_HOST && c.SMTP_PORT && c.SMTP_USER && c.SMTP_PASS && c.EMAIL_FROM,
  );
}

export async function sendAuthEmail(
  c: Config,
  email: string,
  token: string,
  purpose: 'email' | 'recovery',
) {
  const url = new URL('/auth/confirm', c.APP_ORIGIN);
  url.searchParams.set('token_hash', token);
  url.searchParams.set('type', purpose);
  if (__emailCapture) {
    __emailCapture(url.toString(), email);
    return;
  }
  const transport = getTransporter(c);
  if (!transport)
    throw new AppError(503, 'L’envoi des e-mails n’est pas configuré.');
  const recovery = purpose === 'recovery';
  const text = `${recovery ? 'Réinitialise ton mot de passe' : 'Confirme ton adresse e-mail'} en ouvrant ce lien :\n\n${url.toString()}\n\nCe lien expire dans une heure. Si tu n’es pas à l’origine de cette demande, ignore cet e-mail.`;
  const html = `<p>${recovery ? 'Réinitialise ton mot de passe' : 'Confirme ton adresse e-mail'} :</p><p><a href="${url.toString()}">Continuer sur JobDiscover</a></p><p>Ce lien expire dans une heure. Si tu n’es pas à l’origine de cette demande, ignore cet e-mail.</p>`;
  try {
    await transport.sendMail({
      from: c.EMAIL_FROM,
      to: email,
      subject: recovery
        ? 'Réinitialise ton mot de passe JobDiscover'
        : 'Confirme ton compte JobDiscover',
      text,
      html,
    });
  } catch {
    throw new AppError(
      503,
      'L’e-mail n’a pas pu être envoyé. Réessaie dans un instant.',
    );
  }
}
