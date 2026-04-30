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
  title: "BagxPress — Zero UX Creator Token Checkout",
  description: "Convert Web2 fans into Web3 holders instantly on Solana.",
  icons: {
    icon: "/logobxp.png",
    shortcut: "/logobxp.png",
    apple: "/logobxp.png",
  },
  openGraph: {
    title: "BagxPress — Zero UX Creator Token Checkout",
    description: "Convert Web2 fans into Web3 holders instantly on Solana. The invisible checkout layer for the Bags ecosystem.",
    url: "https://bagxpress.vercel.app",
    siteName: "BagxPress",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/logobxp.png",
        width: 800,
        height: 600,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "BagxPress — Zero UX Creator Token Checkout",
    description: "Convert Web2 fans into Web3 holders instantly on Solana.",
    images: ["/logobxp.png"],
  }
};

// PT-BR: Log de versão emitido no cold start do servidor
// EN: Version log emitted on server cold start
console.log("[APP] Running v2.0 Winner Build — BagxPress Hackathon Submission");

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
