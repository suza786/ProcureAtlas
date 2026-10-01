import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ProcureAtlas AI — Global Tender Intelligence & Bid Operations",
  description: "The Intelligence and Operating System for Global Public Procurement. Discover opportunities, assess eligibility, build evidence-backed proposals, and manage bid operations.",
  keywords: ["procurement", "tender", "bid management", "government contracts", "procurement intelligence", "Bangladesh", "World Bank", "ADB"],
  authors: [{ name: "ProcureAtlas AI" }],
  manifest: "/manifest.json",
  icons: {
    icon: "/logo.svg",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ProcureAtlas",
  },
  openGraph: {
    title: "ProcureAtlas AI",
    description: "Global Tender Intelligence & Bid Operations Platform",
    siteName: "ProcureAtlas AI",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ProcureAtlas AI",
    description: "Global Tender Intelligence & Bid Operations Platform",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
