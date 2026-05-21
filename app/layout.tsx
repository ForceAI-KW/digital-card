import type { Metadata } from 'next';
import { Bodoni_Moda, Inter } from 'next/font/google';
import './globals.css';

const bodoni = Bodoni_Moda({ subsets: ['latin'], style: ['italic', 'normal'], variable: '--next-font-serif' });
const inter  = Inter({ subsets: ['latin'], variable: '--next-font-sans' });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://example.invalid'),
  title: { default: 'Digital Card', template: '%s — Digital Card' },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr" className={`${bodoni.variable} ${inter.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
