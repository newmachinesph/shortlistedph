import Image from "next/image";

/**
 * The real Didit verification screen, framed in a phone.
 * Source image is 454x753; rendered at half that so it stays sharp on retina.
 */
export function DiditMockup() {
  return (
    <div className="mx-auto w-full max-w-[300px]">
      <div className="rounded-[2.25rem] border-[10px] border-ink bg-ink shadow-2xl shadow-ink/20">
        <div className="relative overflow-hidden rounded-[1.6rem] bg-white">
          <span
            aria-hidden
            className="absolute left-1/2 top-2 z-10 h-1 w-16 -translate-x-1/2 rounded-full bg-ink/15"
          />
          <Image
            src="/didit.png"
            alt="The Didit identity verification screen: ID verification, face verification, proof of address, documents and a questionnaire, taking about four minutes."
            width={454}
            height={753}
            className="h-auto w-full"
            priority
          />
        </div>
      </div>
      <p className="mt-4 text-center text-xs leading-relaxed text-ink-faint">
        What verification looks like. It runs on Didit, not on us, and takes about four minutes.
      </p>
    </div>
  );
}
