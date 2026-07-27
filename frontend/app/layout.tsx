import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'M3U8 Video Stream PoC | Proxy + HLS.js',
  description: 'Türkiye IP Proxy destekli M3U8 HLS Master Manifest Stream PoC',
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
