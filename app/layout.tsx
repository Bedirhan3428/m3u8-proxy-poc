import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'M3U8 Video Stream PoC | Next.js API Proxy',
  description: 'M3U8 HLS Stream Player with Next.js App Router API Route Proxying',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
