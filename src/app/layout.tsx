import type { Metadata } from "next";
import { Geist, Inter } from "next/font/google";
import Navbar from "@/components/Navbar";
import { AuthProvider } from "@/lib/auth/AuthProvider";
import { PhantomProvider } from "@/contexts/PhantomContext";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export const metadata: Metadata = {
  title: "BagxPress | No Wallet. No Gas. No Friction.",
  description: "Convert Web2 Fans Into Web3 Holders in Seconds. The invisible checkout layer for Bags & Solana ecosystem.",
  openGraph: {
    title: "BagxPress v9.0 — Colosseum Edition",
    description: "The invisible checkout layer for the Bags ecosystem. Seamless Web2 to Web3 onboarding via Stripe & Solana.",
    url: "https://bagxpress.xyz",
    siteName: "BagxPress",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "BagxPress | The Invisible Checkout Layer",
    description: "Convert Web2 Fans Into Web3 Holders in 10 Seconds.",
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${geist.variable} dark`}
      style={{ colorScheme: "dark" }}
    >
      <body className="min-h-screen bg-[var(--color-brand-bg-1)] text-white overflow-x-hidden antialiased">
        <AuthProvider>
          <PhantomProvider>
            <Navbar />
            {children}
          </PhantomProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
