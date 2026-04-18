import './globals.css';
import type { ReactNode } from 'react';
import { TRPCProvider } from '@/lib/trpc-client';

export const metadata = { title: 'FB Auto-Post' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="th">
      <body>
        <TRPCProvider>
          <div className="mx-auto max-w-6xl p-6">
            <header className="mb-8 flex items-center justify-between">
              <h1 className="text-2xl font-semibold">FB Auto-Post</h1>
              <nav className="flex gap-4 text-sm">
                <a href="/" className="hover:underline">Dashboard</a>
                <a href="/campaigns" className="hover:underline">Campaigns</a>
                <a href="/groups" className="hover:underline">Groups</a>
                <a href="/logs" className="hover:underline">Logs</a>
                <a href="/settings" className="hover:underline">Settings</a>
                <a href="/session" className="hover:underline">Session</a>
              </nav>
            </header>
            {children}
          </div>
        </TRPCProvider>
      </body>
    </html>
  );
}
