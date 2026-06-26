import type { Metadata } from 'next';
import { AuthProvider } from '@/components/AuthProvider';
import '@/styles/globals.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'USHS Portal',
  description: 'USHS TypeScript service portal',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
