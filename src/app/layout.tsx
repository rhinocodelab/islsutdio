
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter', 
});

export const metadata: Metadata = {
  title: 'ISL Studio',
  description: 'AI-powered Indian Sign Language (ISL) communication support. Transcribe and translate spoken languages.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en-IN" className={`${inter.variable} h-full`}>
      <body className={'h-full font-body antialiased'}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
