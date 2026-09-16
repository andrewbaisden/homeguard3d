import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/session";
import { ArrowUpRight, BellRing, Boxes, Eye, Radio, ScanLine, ShieldCheck } from "lucide-react";
import Link from "next/link";

const signals = [
  { label: "Front door", status: "Locked", tone: "bg-[#d8ff5f]" },
  { label: "Kitchen", status: "Motion clear", tone: "bg-[#ff916f]" },
  { label: "Garden cam", status: "Online", tone: "bg-[#8fdcd0]" },
];

export default async function Home() {
  const session = await getSession();

  return (
    <main className="min-h-screen">
      <header className="page-shell flex h-20 items-center justify-between">
        <Brand />
        <nav
          className="hidden items-center gap-8 text-sm font-medium md:flex"
          aria-label="Main navigation"
        >
          <a href="#how-it-works" className="transition-opacity hover:opacity-55">
            How it works
          </a>
          <a href="#live-home" className="transition-opacity hover:opacity-55">
            Live home
          </a>
          <a href="#security" className="transition-opacity hover:opacity-55">
            Security
          </a>
        </nav>
        <Button
          variant="outline"
          nativeButton={false}
          render={
            <Link href={session ? "/properties" : "/sign-in"}>
              {session ? "Open dashboard" : "Sign in"}
              <ArrowUpRight />
            </Link>
          }
        />
      </header>

      <section className="page-shell pb-6 pt-2 sm:pb-10">
        <div className="relative overflow-hidden rounded-[2rem] bg-[#153f3a] px-6 pb-7 pt-12 text-[#fffbed] sm:px-10 sm:pb-10 lg:min-h-[620px] lg:px-14 lg:py-16">
          <div className="absolute inset-0 opacity-25 soft-grid" />
          <div className="absolute -right-24 -top-32 size-[28rem] rounded-full border-[5rem] border-[#0e7065] opacity-60" />
          <div className="absolute -bottom-20 left-[42%] size-64 rotate-12 rounded-[4rem] bg-[#ff5b35] opacity-95" />

          <div className="relative z-10 grid gap-12 lg:grid-cols-[1.02fr_0.98fr] lg:items-center">
            <div className="max-w-2xl">
              <span className="eyebrow text-[#d8ff5f] before:bg-[#d8ff5f]">
                Your home, fully in view
              </span>
              <h1 className="mt-7 text-5xl font-semibold leading-[0.88] tracking-[-0.075em] sm:text-7xl lg:text-[6.25rem]">
                Calm lives
                <br />
                <span className="text-[#ff916f]">in the details.</span>
              </h1>
              <p className="mt-7 max-w-lg text-base leading-relaxed text-[#fffbed]/70 sm:text-lg">
                See every room, sensor and security signal as one living digital twin—beautifully
                clear, always current.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Button
                  size="lg"
                  className="bg-[#d8ff5f] text-[#153f3a] shadow-none hover:bg-[#e4ff8a]"
                  nativeButton={false}
                  render={
                    <Link href={session ? "/properties" : "/sign-up"}>
                      {session ? "View your homes" : "Create your home"}
                      <ArrowUpRight />
                    </Link>
                  }
                />
                <Button
                  size="lg"
                  variant="outline"
                  className="border-white/25 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                  nativeButton={false}
                  render={<a href="#how-it-works">Explore the system</a>}
                />
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-[520px] lg:translate-y-5">
              <div className="absolute -left-5 top-14 hidden h-24 w-24 rotate-[-12deg] rounded-[1.75rem] bg-[#6957e8] md:block" />
              <div className="relative rotate-[2deg] rounded-[2rem] bg-[#f8f2df] p-4 text-[#153f3a] shadow-[0_40px_90px_rgba(0,0,0,0.28)] sm:p-5">
                <div className="mb-4 flex items-center justify-between px-1">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#153f3a]/50">
                      Hawthorn House
                    </p>
                    <p className="mt-1 text-lg font-semibold tracking-tight">Everything is calm</p>
                  </div>
                  <span className="inline-flex items-center gap-2 rounded-full bg-[#d8ff5f] px-3 py-1.5 text-xs font-bold">
                    <span className="size-2 animate-pulse rounded-full bg-[#153f3a]" /> Live
                  </span>
                </div>

                <div className="soft-grid relative aspect-[1.2/1] overflow-hidden rounded-[1.4rem] bg-[#8fdcd0] p-6">
                  <div className="absolute -right-10 -top-12 size-40 rounded-full border-[2.5rem] border-[#fffbed]/45" />
                  <div className="relative grid h-full grid-cols-[1.3fr_0.7fr] grid-rows-2 gap-2">
                    <div className="relative row-span-2 rounded-[1.1rem] border-2 border-[#153f3a] bg-[#f8f2df]/85 p-4">
                      <p className="text-xs font-semibold">Living room</p>
                      <div className="absolute bottom-5 left-5 right-5 h-14 rounded-2xl bg-[#ff916f] shadow-[inset_0_0_0_2px_#153f3a]" />
                      <span className="absolute right-5 top-5 size-3 rounded-full bg-[#6957e8] ring-4 ring-[#6957e8]/20" />
                    </div>
                    <div className="relative rounded-[1.1rem] border-2 border-[#153f3a] bg-[#d8ff5f]/85 p-3">
                      <p className="text-xs font-semibold">Kitchen</p>
                      <ScanLine className="absolute bottom-3 right-3 size-5" />
                    </div>
                    <div className="relative rounded-[1.1rem] border-2 border-[#153f3a] bg-[#fffbed]/85 p-3">
                      <p className="text-xs font-semibold">Entry</p>
                      <span className="absolute bottom-3 right-3 block h-8 w-4 rounded-t-full border-2 border-[#153f3a] bg-[#ff5b35]" />
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  {signals.map((signal) => (
                    <div key={signal.label} className="rounded-2xl bg-white/70 p-3">
                      <span className={`mb-3 block size-2.5 rounded-full ${signal.tone}`} />
                      <p className="text-[0.65rem] font-medium text-[#153f3a]/50">{signal.label}</p>
                      <p className="mt-0.5 text-xs font-semibold">{signal.status}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="absolute -bottom-6 -right-3 flex items-center gap-2 rounded-2xl bg-[#ff5b35] px-4 py-3 text-sm font-bold text-[#153f3a] shadow-xl sm:-right-7">
                <ShieldCheck className="size-5" /> All zones protected
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="page-shell py-20 sm:py-28">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
          <div>
            <span className="eyebrow">One home model</span>
            <h2 className="section-title mt-6 max-w-md">Every view tells the same story.</h2>
          </div>
          <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground lg:pt-9">
            From a quick floor-plan check to an immersive 3D walkthrough, HomeGuard reads one
            trusted source of truth. No stale screens. No second guessing.
          </p>
        </div>

        <div className="mt-14 grid gap-4 md:grid-cols-3">
          <article className="min-h-72 overflow-hidden rounded-[1.7rem] bg-[#ff5b35] p-7 text-[#153f3a]">
            <div className="flex items-start justify-between">
              <span className="grid size-12 place-items-center rounded-full bg-[#fffbed]/75">
                <Eye className="size-5" />
              </span>
              <span className="text-xs font-bold">01</span>
            </div>
            <h3 className="mt-20 text-3xl font-semibold tracking-[-0.05em]">See the whole home.</h3>
            <p className="mt-3 max-w-xs text-sm leading-relaxed opacity-70">
              Rooms, openings and devices arranged into one clear, spatial picture.
            </p>
          </article>
          <article className="min-h-72 overflow-hidden rounded-[1.7rem] bg-[#6957e8] p-7 text-white">
            <div className="flex items-start justify-between">
              <span className="grid size-12 place-items-center rounded-full bg-white/15">
                <Radio className="size-5" />
              </span>
              <span className="text-xs font-bold">02</span>
            </div>
            <h3 className="mt-20 text-3xl font-semibold tracking-[-0.05em]">
              Follow every signal.
            </h3>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-white/70">
              Live state flows everywhere at once, from sensors to alerts to both visual twins.
            </p>
          </article>
          <article className="min-h-72 overflow-hidden rounded-[1.7rem] bg-[#d8ff5f] p-7 text-[#153f3a]">
            <div className="flex items-start justify-between">
              <span className="grid size-12 place-items-center rounded-full bg-[#153f3a] text-[#d8ff5f]">
                <BellRing className="size-5" />
              </span>
              <span className="text-xs font-bold">03</span>
            </div>
            <h3 className="mt-20 text-3xl font-semibold tracking-[-0.05em]">
              Act with confidence.
            </h3>
            <p className="mt-3 max-w-xs text-sm leading-relaxed opacity-70">
              Arm, simulate and respond with context that is immediate and easy to trust.
            </p>
          </article>
        </div>
      </section>

      <section id="live-home" className="page-shell pb-20 sm:pb-28">
        <div className="grid overflow-hidden rounded-[2rem] bg-[#f3a7c4] lg:grid-cols-2">
          <div className="relative min-h-[360px] overflow-hidden bg-[#087b70] p-8 sm:min-h-[480px] sm:p-12">
            <div className="absolute -left-24 -top-24 size-80 rounded-full border-[4rem] border-[#d8ff5f]/30" />
            <div className="absolute bottom-12 left-12 right-12 top-12 rotate-[-4deg] rounded-[2rem] bg-[#fffbed] p-5 shadow-2xl">
              <div className="mb-4 flex items-center justify-between text-[#153f3a]">
                <span className="text-xs font-bold uppercase tracking-[0.18em]">Digital twin</span>
                <Boxes className="size-5" />
              </div>
              <div className="soft-grid relative h-[calc(100%-2.25rem)] overflow-hidden rounded-[1.4rem] bg-[#c9e9e2]">
                <div className="absolute left-[16%] top-[20%] h-[55%] w-[66%] skew-y-[-8deg] rounded-2xl border-[3px] border-[#153f3a] bg-[#fffbed]/80 shadow-[14px_14px_0_#ff5b35]" />
                <div className="absolute left-[22%] top-[27%] h-[42%] w-[25%] skew-y-[-8deg] border-r-[3px] border-[#153f3a]" />
                <div className="absolute right-[26%] top-[38%] size-4 rounded-full bg-[#6957e8] ring-8 ring-[#6957e8]/15" />
              </div>
            </div>
          </div>
          <div className="flex flex-col justify-center p-8 text-[#153f3a] sm:p-12 lg:p-16">
            <span className="eyebrow">Spatial by design</span>
            <h2 className="section-title mt-6">Not just data. Your actual home.</h2>
            <p className="mt-6 max-w-lg leading-relaxed text-[#153f3a]/70">
              The 2D plan, 3D scene and device dashboard stay in lockstep, so a door is never open
              in one view and closed in another.
            </p>
            <Link
              href={session ? "/properties" : "/sign-up"}
              className="mt-8 inline-flex w-fit items-center gap-2 border-b-2 border-[#153f3a] pb-1 text-sm font-bold"
            >
              Step inside <ArrowUpRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>

      <section id="security" className="bg-[#153f3a] py-20 text-[#fffbed] sm:py-24">
        <div className="page-shell flex flex-col items-start justify-between gap-10 lg:flex-row lg:items-end">
          <div>
            <span className="eyebrow text-[#d8ff5f] before:bg-[#d8ff5f]">Ready when you are</span>
            <h2 className="mt-6 max-w-3xl text-4xl font-semibold leading-[0.95] tracking-[-0.06em] sm:text-6xl">
              A more vivid way to feel secure.
            </h2>
          </div>
          <Button
            size="lg"
            className="bg-[#ff5b35] text-[#153f3a] shadow-none hover:bg-[#ff795a]"
            nativeButton={false}
            render={
              <Link href={session ? "/properties" : "/sign-up"}>
                Get started <ArrowUpRight />
              </Link>
            }
          />
        </div>
        <div className="page-shell mt-16 flex items-center justify-between border-t border-white/15 pt-8 text-xs text-white/45">
          <Brand inverse />
          <p>One home. One trusted state.</p>
        </div>
      </section>
    </main>
  );
}
