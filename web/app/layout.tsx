import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'FormAI — Track form. Improve every rep.',
  description: 'AI gym form coach that watches your lifts, explains your mistakes, and tells you what to fix next.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
