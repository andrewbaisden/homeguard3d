import { ShieldCheck } from "lucide-react";
import Link from "next/link";

export function Brand({ inverse = false }: { inverse?: boolean }) {
  return (
    <Link
      href="/"
      className={`group inline-flex items-center gap-2.5 font-semibold tracking-[-0.03em] ${
        inverse ? "text-[#fffbed]" : "text-foreground"
      }`}
      aria-label="HomeGuard 3D home"
    >
      <span className="relative grid size-9 place-items-center overflow-hidden rounded-[0.85rem] bg-[#ff5b35] text-[#153f3a] shadow-[inset_0_0_0_1px_rgba(21,63,58,0.14)] transition-transform duration-300 group-hover:-rotate-3 group-hover:scale-105">
        <span className="absolute -right-2 -top-2 size-5 rounded-full bg-[#d8ff5f]" />
        <ShieldCheck className="relative size-[1.15rem] stroke-[2.4]" />
      </span>
      <span className="text-[1.05rem]">
        HomeGuard <span className="font-normal opacity-55">3D</span>
      </span>
    </Link>
  );
}
