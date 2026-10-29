import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'AIM, Angebote in Minuten', template: '%s · AIM' },
  description: 'AIM, Angebote in Minuten. Kalkulation für Stahl- und Metallbau, ein Produkt von toolwerk.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
