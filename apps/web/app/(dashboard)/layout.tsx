import { getSession } from "@/lib/session";
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
      <header className="flex items-center justify-between border-b px-6 py-3">
        <Link href="/properties" className="font-semibold">
          HomeGuard 3D
        </Link>
        <div className="flex items-center gap-3 text-sm text-neutral-500">
          <span>{session.user.email}</span>
          <SignOutButton />
        </div>
      </header>
      <main className="flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
