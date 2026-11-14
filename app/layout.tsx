import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Penny — A little clarity for your money', description: 'A simple, thoughtful spending tracker. Every little expense, a clearer picture.' };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: [{ media: '(prefers-color-scheme: light)', color: '#f8f9f5' }, { media: '(prefers-color-scheme: dark)', color: '#141c18' }] };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body><a className="skip-link" href="#main-content">Skip to content</a>{children}</body></html>; }
