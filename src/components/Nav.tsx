import Image from "next/image";
import Link from "next/link";
import { SITE } from "@/lib/site-config";
import { WalletButton } from "./Wallet";

export function Nav() {
  return (
    <header className="wrap flex h-[68px] items-center justify-between gap-3">
      <Link href="/" className="flex items-center gap-2.5" aria-label={`${SITE.name} home`}>
        <Image src="/logo-96.png" alt="" width={32} height={32} className="rounded-[9px]" priority />
        <span className="display text-[22px] tracking-tight">{SITE.name}</span>
      </Link>
      <nav className="flex items-center gap-1 sm:gap-2">
        <Link href="/#board" className="hidden rounded-full px-3 py-2 text-[15px] font-bold text-muted hover:text-ink sm:block">
          Coins
        </Link>
        <Link href="/themes" className="rounded-full px-3 py-2 text-[15px] font-bold text-muted hover:text-ink">
          Themes
        </Link>
        <Link href="/about" className="hidden rounded-full px-3 py-2 text-[15px] font-bold text-muted hover:text-ink sm:block">
          How it works
        </Link>
        <WalletButton />
      </nav>
    </header>
  );
}
