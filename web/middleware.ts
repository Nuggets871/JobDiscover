import { NextResponse, type NextRequest } from 'next/server';
export function middleware(req: NextRequest) {
  const production = process.env.NODE_ENV === 'production';
  const nonce = btoa(crypto.randomUUID());
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${production ? '' : " 'unsafe-eval'"}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    `connect-src 'self'${production ? '' : ' ws: wss:'}`,
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'self' https://chatgpt.com https://*.chatgpt.com",
    "frame-src 'none'",
    ...(production ? ['upgrade-insecure-requests'] : []),
  ].join('; ');
  const h = new Headers(req.headers);
  h.set('Content-Security-Policy', csp);
  const response = NextResponse.next({ request: { headers: h } });
  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'no-referrer');
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=()',
  );
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  response.headers.set('Vary', 'Cookie');
  if (production)
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains',
    );
  return response;
}
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.svg).*)'],
};
