import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'JobDiscover — Trouve ta prochaine piste',
  description:
    'Explore des offres, découvre des métiers et précise tes envies à ton rythme.',
  robots: { index: false, follow: false },
  icons: { icon: '/favicon.svg' },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        <meta name="theme-color" content="#442d3d" />
      </head>
      <body>
        <a className="skip-link" href="#main-content">
          Aller au contenu
        </a>
        <div id="main-content">{children}</div>
      </body>
    </html>
  );
}
