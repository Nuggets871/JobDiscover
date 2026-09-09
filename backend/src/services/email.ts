import nodemailer, { type Transporter } from 'nodemailer';
import { config } from '../config.ts';
import { AppError } from '../validation.ts';

export type AuthPurpose = 'email' | 'recovery';
export type EmailCapture = (url: string, to: string) => void;

let capture: EmailCapture | null = null;
let transporter: Transporter | null = null;
let transporterKey = '';

export function __setEmailCapture(fn: EmailCapture | null) {
  capture = fn;
}

export function emailConfigured() {
  const c = config();
  if (c.AUTH_EMAIL_MODE === 'console')
    return process.env.NODE_ENV !== 'production';
  return Boolean(
    c.SMTP_HOST && c.SMTP_PORT && c.SMTP_USER && c.SMTP_PASS && c.EMAIL_FROM,
  );
}

function smtpTransport() {
  const c = config();
  if (
    !c.SMTP_HOST ||
    !c.SMTP_PORT ||
    !c.SMTP_USER ||
    !c.SMTP_PASS ||
    !c.EMAIL_FROM
  )
    return null;
  const key = `${c.SMTP_HOST}:${c.SMTP_PORT}:${c.SMTP_USER}`;
  if (!transporter || key !== transporterKey) {
    transporter = nodemailer.createTransport({
      host: c.SMTP_HOST,
      port: c.SMTP_PORT,
      secure: c.SMTP_PORT === 465,
      auth: { user: c.SMTP_USER, pass: c.SMTP_PASS },
    });
    transporterKey = key;
  }
  return { transporter, from: c.EMAIL_FROM };
}

export async function sendAuthEmail(
  email: string,
  token: string,
  purpose: AuthPurpose,
) {
  const c = config();
  const url = new URL('/auth/confirm', c.APP_ORIGIN);
  url.searchParams.set('token', token);
  url.searchParams.set('type', purpose);
  if (capture) return capture(url.toString(), email);
  if (
    c.AUTH_EMAIL_MODE === 'console' &&
    process.env.NODE_ENV !== 'production'
  ) {
    console.log(`[auth-email] ${email}: ${url.toString()}`);
    return;
  }
  const smtp = smtpTransport();
  if (!smtp)
    throw new AppError(503, 'L’envoi des e-mails n’est pas configuré.');
  const recovery = purpose === 'recovery';
  const action = recovery
    ? 'Réinitialise ton mot de passe'
    : 'Confirme ton adresse e-mail';
  try {
    await smtp.transporter.sendMail({
      from: smtp.from,
      to: email,
      subject: recovery
        ? 'Réinitialise ton mot de passe JobDiscover'
        : 'Confirme ton compte JobDiscover',
      text: `${action} en ouvrant ce lien :\n\n${url}\n\nCe lien expire dans une heure.`,
      html: `<p>${action} :</p><p><a href="${url}">Continuer sur JobDiscover</a></p><p>Ce lien expire dans une heure.</p>`,
    });
  } catch {
    throw new AppError(
      503,
      'L’e-mail n’a pas pu être envoyé. Réessaie dans un instant.',
    );
  }
}
