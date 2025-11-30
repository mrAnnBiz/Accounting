import type { Metadata } from "next";
import { Inter } from 'next/font/google';
import "./globals.css";

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Anneruth - Cambridge Accounting Notes',
  description: 'IGCSE and A-Level Accounting study materials and past papers',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} w-full`}>{children}</body>
    </html>
  );
}
