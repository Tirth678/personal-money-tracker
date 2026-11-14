import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Penny — A little clarity for your money', description: 'A simple, thoughtful spending tracker. Every little expense, a clearer picture.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
