import type { Metadata } from "next";
import { Geist, Newsreader } from "next/font/google";
import "./globals.css";

// next/font downloads these at build time and serves them from our own origin (no font CDN at runtime).
const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const newsreader = Newsreader({ subsets: ["latin"], variable: "--font-newsreader", style: ["normal", "italic"] });

export const metadata: Metadata = {
  title: { default: "Verity", template: "%s · Verity" },
  description: "Ruang kerja berkas kantor Notaris/PPAT",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${geist.variable} ${newsreader.variable}`}>
      <body>{children}</body>
    </html>
  );
}
