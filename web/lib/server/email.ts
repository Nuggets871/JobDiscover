import { AppError, remote, type Config } from './core.ts';

export function emailConfigured(c: Config) {
  return Boolean(c.RESEND_API_KEY && c.EMAIL_FROM);
}

export async function sendAuthEmail(
  c: Config,
  email: string,
  token: string,
  purpose: 'email' | 'recovery',
) {
  if (!emailConfigured(c))
    throw new AppError(503, 'L’envoi des e-mails n’est pas configuré.');
  const url = new URL('/auth/confirm', c.APP_ORIGIN);
  url.searchParams.set('token_hash', token);
  url.searchParams.set('type', purpose);
  const recovery = purpose === 'recovery';
  const response = await remote('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${c.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: c.EMAIL_FROM,
      to: [email],
      subject: recovery
        ? 'Réinitialise ton mot de passe JobDiscover'
        : 'Confirme ton compte JobDiscover',
      text: `${recovery ? 'Réinitialise ton mot de passe' : 'Confirme ton adresse e-mail'} en ouvrant ce lien :\n\n${url.toString()}\n\nCe lien expire dans une heure. Si tu n’es pas à l’origine de cette demande, ignore cet e-mail.`,
      html: `<p>${recovery ? 'Réinitialise ton mot de passe' : 'Confirme ton adresse e-mail'} :</p><p><a href="${url.toString()}">Continuer sur JobDiscover</a></p><p>Ce lien expire dans une heure. Si tu n’es pas à l’origine de cette demande, ignore cet e-mail.</p>`,
    }),
  });
  if (!response.ok)
    throw new AppError(
      503,
      'L’e-mail n’a pas pu être envoyé. Réessaie dans un instant.',
    );
}
