import Image from "next/image";
import { Board } from "@/components/Board";
import { HeroPills } from "@/components/HeroPills";
import { getBoard } from "@/lib/board";
import { refreshAfterResponse } from "@/lib/refresh";
import { SITE } from "@/lib/site-config";
import hero from "../../public/hero-tape.png";

export const dynamic = "force-dynamic";
// Long enough for a refresh started by this visit to finish after the response.
export const maxDuration = 300;

export default function Home() {
  refreshAfterResponse();
  const board = getBoard();
  return (
    <>
      <section className="wrap relative grid items-center md:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
        <div className="relative z-10 py-6 md:py-8">
          <h1 className="display text-[44px] sm:text-[60px] lg:text-[72px]">{SITE.hook}</h1>
          <p className="mt-4 max-w-[520px] text-[17px] text-muted">
            Live creator fees, market caps, ages and themes for launchpad coins, ranked by what they earn.
          </p>
          <HeroPills />
        </div>
        <div className="pointer-events-none relative hidden justify-self-end md:block" aria-hidden>
          <Image src={hero} alt="" priority sizes="(min-width: 768px) 520px, 0px" className="hero-art h-auto w-[440px] lg:w-[520px]" />
        </div>
      </section>
      <div className="mt-2 md:mt-0">
        <Board initial={board} />
      </div>
    </>
  );
}
