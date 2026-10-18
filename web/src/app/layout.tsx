import type { Metadata } from 'next';
import { IBM_Plex_Mono, Manrope } from 'next/font/google';
import type { ReactNode } from 'react';
import { WebVitals } from '@/components/web-vitals';
import '@/styles/globals.scss';

const sans = Manrope({ subsets: ['latin'], variable: '--font-sans' });
const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: { default: 'Financial Tracker', template: '%s · Financial Tracker' },
  description: 'Track accounts, income and expenses — or just tell the assistant.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>
        <WebVitals />
        {children}
      </body>
    </html>
  );
}
