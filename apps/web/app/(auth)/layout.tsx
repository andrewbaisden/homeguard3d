import { Brand } from "@/components/brand";
import { Radio, ScanLine, ShieldCheck } from "lucide-react";

const trustSignals = [
  { label: "Protected", icon: ShieldCheck },
  { label: "Mapped", icon: ScanLine },
  { label: "Connected", icon: Radio },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="page-shell flex min-h-screen flex-1 py-5 sm:py-8">
      <div className="grid w-full overflow-hidden rounded-[2rem] bg-[#fffbed]/80 shadow-[0_28px_80px_rgba(21,63,58,0.12)] ring-1 ring-foreground/10 lg:grid-cols-[1.05fr_0.95fr]">
        <aside className="control-surface relative hidden overflow-hidden rounded-none p-12 lg:flex lg:flex-col lg:justify-between">
          <div className="absolute inset-0 opacity-25 soft-grid" />
          <div className="absolute -right-20 -top-20 size-80 rounded-full border-[4.5rem] border-[#0e7065]" />
          <div className="absolute -bottom-14 -left-12 size-64 rotate-12 rounded-[4rem] bg-[#ff5b35]" />
          <div className="relative">
            <Brand inverse />
          </div>
          <div className="relative max-w-lg">
            <span className="eyebrow text-[#d8ff5f] before:bg-[#d8ff5f]">Welcome home</span>
            <h1 className="mt-6 text-6xl font-semibold leading-[0.9] tracking-[-0.07em]">
              Your whole home,
              <span className="text-[#ff916f]"> beautifully clear.</span>
            </h1>
            <p className="mt-6 max-w-md leading-relaxed text-white/65">
              One calm place for live security, spatial awareness and every device that keeps your
              home running.
            </p>
          </div>
          <div className="relative grid grid-cols-3 gap-3">
            {trustSignals.map(({ label, icon: Icon }) => (
              <div
                key={label}
                className="grid aspect-[1.35/1] place-items-center rounded-2xl border border-white/10 bg-white/5"
              >
                <Icon className="size-5 text-[#d8ff5f]" />
              </div>
            ))}
          </div>
        </aside>
        <div className="flex flex-col p-6 sm:p-10 lg:p-14">
          <div className="mb-12 lg:hidden">
            <Brand />
          </div>
          <div className="m-auto w-full max-w-md">{children}</div>
          <p className="mt-12 text-center text-xs text-muted-foreground">
            Secure by design · Private by default
          </p>
        </div>
      </div>
    </div>
  );
}
