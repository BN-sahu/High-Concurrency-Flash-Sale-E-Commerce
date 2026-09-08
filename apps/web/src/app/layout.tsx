import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

import { Navbar } from "../components/Navbar";
import Script from "next/script";

export const metadata: Metadata = {
  title: "FlashDrop — Exclusive Flash Sales",
  description: "High-performance flash sale platform. Limited drops, zero overselling. Grab exclusive deals before they're gone.",
  keywords: ["flash sale", "limited edition", "exclusive drops", "e-commerce"],
  openGraph: {
    title: "FlashDrop — Exclusive Flash Sales",
    description: "Limited drops, zero overselling. Grab exclusive deals before they're gone.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-[var(--background)] text-[var(--foreground)]">
        <Navbar />

        <main className="flex-1 pt-16">
          {children}
        </main>

        <footer className="border-t border-[var(--card-border)] mt-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="gradient-text font-bold">FlashDrop</span>
                <span className="text-[var(--text-muted)] text-sm">© 2024</span>
              </div>
              <div className="flex gap-6 text-sm text-[var(--text-muted)]">
                <span>Zero Overselling Guarantee</span>
                <span>•</span>
                <span>Atomic Transactions</span>
                <span>•</span>
                <span>Enterprise Grade</span>
              </div>
            </div>
          </div>
        </footer>

        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: 'var(--surface-raised)',
              border: '1px solid var(--card-border)',
              color: 'var(--foreground)',
            },
          }}
        />
        <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="beforeInteractive" />
      </body>
    </html>
  );
}
