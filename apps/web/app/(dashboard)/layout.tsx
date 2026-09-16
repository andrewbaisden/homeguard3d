import { Brand } from "@/components/brand";
import { getSession } from "@/lib/session";
import { LayoutGrid } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SignOutButton } from "./sign-out-button";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) {
    redirect("/sign-in");
  }

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-50 border-b border-foreground/10 bg-[#f7f2e5]/90 backdrop-blur-xl">
        <div className="page-shell flex h-[4.5rem] items-center justify-between">
          <div className="flex items-center gap-8">
            <Brand />
            <Link
              href="/properties"
              className="hidden items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold transition-colors hover:bg-white/70 sm:flex"
            >
              <LayoutGrid className="size-4" /> Properties
            </Link>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="hidden max-w-52 truncate md:inline">{session.user.email}</span>
            <span className="grid size-8 place-items-center rounded-full bg-[#8fdcd0] text-xs font-bold text-[#153f3a]">
              {(session.user.name?.[0] ?? session.user.email[0] ?? "H").toUpperCase()}
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="flex-1 py-8 sm:py-10">{children}</main>
    </div>
  );
}
