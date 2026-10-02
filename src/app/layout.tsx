import type { Metadata } from "next";
import Link from "next/link";
import { Archivo, JetBrains_Mono } from "next/font/google";
import { Nav } from "@/components/Nav";
import { WalletDialog } from "@/components/Wallet";
import { SITE } from "@/lib/site-config";
import "./globals.css";

const archivo = Archivo({ variable: "--font-archivo", subsets: ["latin"], weight: ["500", "700", "900"] });
const mono = JetBrains_Mono({ variable: "--font-jbmono", subsets: ["latin"], weight: ["500", "700"] });

export const metadata: Metadata = {
  title: `${SITE.name} — ${SITE.hook}`,
  description: SITE.description,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${archivo.variable} ${mono.variable} antialiased`}>
      <body className="flex min-h-screen flex-col">
        <Nav />
        <main className="flex-1">{children}</main>
        <footer className="wrap mt-16 flex flex-col gap-2 border-t border-line py-8 text-[13px] text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>
            {SITE.name} reads public launchpad data for Robinhood Chain. Read-only: no trading, no signing. Not financial advice.
          </p>
          <div className="flex gap-4">
            <Link href="/about" className="hover:text-ink">
              How the numbers are measured
            </Link>
            <Link href="/themes" className="hover:text-ink">
              Themes
            </Link>
          </div>
        </footer>
        <WalletDialog />
      </body>
    </html>
  );
}
