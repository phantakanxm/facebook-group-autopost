import './globals.css';
import type { ReactNode } from 'react';
import { TRPCProvider } from '@/lib/trpc-client';
import { SessionBanner } from '@/components/session-banner';
import { AppShell } from '@/components/app-shell';
import { FeedbackProvider } from '@/components/ui/feedback';
import { LocaleProvider } from '@/lib/i18n';

export const metadata = {
  title: 'Atelier · Broadcast studio',
  description: 'A calm workshop for queueing Facebook group posts with intention.',
};

const themeInit = `
(function(){
  try {
    var stored = localStorage.getItem('theme');
    var prefers = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var mode = stored || (prefers ? 'dark' : 'light');
    if (mode === 'dark') document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="th" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>
        <TRPCProvider>
          <LocaleProvider>
            <FeedbackProvider>
              <AppShell>
                <SessionBanner />
                {children}
              </AppShell>
            </FeedbackProvider>
          </LocaleProvider>
        </TRPCProvider>
      </body>
    </html>
  );
}
