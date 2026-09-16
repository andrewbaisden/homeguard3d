import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUserId } from "@/lib/session";
import { prisma } from "@homeguard/database";
import { ArrowUpRight, Building2, Plus, ShieldCheck } from "lucide-react";
import Link from "next/link";

export default async function PropertiesPage() {
  const userId = await getCurrentUserId();
  if (!userId) {
    // The (dashboard) layout already redirects unauthenticated visitors —
    // this only guards against calling findMany() with no user filter.
    return null;
  }

  const memberships = await prisma.membership.findMany({
    where: { userId },
    include: {
      property: {
        include: { securityState: true, floors: { select: { id: true } } },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const cardTones = ["bg-[#8fdcd0]", "bg-[#f3a7c4]", "bg-[#ff916f]", "bg-[#d8ff5f]"];

  return (
    <div className="page-shell flex flex-col gap-10">
      <section className="relative overflow-hidden rounded-[1.8rem] bg-[#153f3a] px-7 py-9 text-[#fffbed] sm:px-10 sm:py-11">
        <div className="absolute inset-0 opacity-20 soft-grid" />
        <div className="absolute -right-16 -top-24 size-72 rounded-full border-[3.5rem] border-[#0e7065]" />
        <div className="relative flex flex-col items-start justify-between gap-8 sm:flex-row sm:items-end">
          <div>
            <span className="eyebrow text-[#d8ff5f] before:bg-[#d8ff5f]">Your places</span>
            <h1 className="mt-5 text-4xl font-semibold tracking-[-0.06em] sm:text-5xl">
              Home starts here.
            </h1>
            <p className="mt-3 max-w-lg text-sm leading-relaxed text-white/60">
              Choose a property to see its live security picture, devices and digital twin.
            </p>
          </div>
          <Button
            size="lg"
            className="bg-[#ff5b35] text-[#153f3a] shadow-none hover:bg-[#ff795a]"
            nativeButton={false}
            render={
              <Link href="/properties/new">
                <Plus /> New property
              </Link>
            }
          />
        </div>
      </section>

      {memberships.length === 0 ? (
        <Card className="border-dashed bg-white/35 shadow-none">
          <CardContent className="flex flex-col items-center py-16 text-center">
            <span className="mb-5 grid size-14 place-items-center rounded-2xl bg-[#8fdcd0]">
              <Building2 className="size-6" />
            </span>
            <p className="text-lg font-semibold">No properties yet</p>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              Create your first property to start mapping floors, rooms and live devices.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div>
          <div className="mb-5 flex items-center justify-between">
            <div>
              <span className="eyebrow">Portfolio</span>
              <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em]">Your properties</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              {memberships.length} {memberships.length === 1 ? "home" : "homes"}
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {memberships.map(({ property, role }, index) => (
              <Link key={property.id} href={`/properties/${property.id}`} className="group">
                <Card
                  className={`${cardTones[index % cardTones.length]} min-h-64 justify-between shadow-none ring-0 transition-transform duration-300 group-hover:-translate-y-1`}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <span className="grid size-11 place-items-center rounded-full bg-[#fffbed]/75">
                        <ShieldCheck className="size-5" />
                      </span>
                      <ArrowUpRight className="size-5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </div>
                    <CardTitle className="mt-10 text-2xl font-semibold tracking-[-0.045em]">
                      {property.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex items-center justify-between text-sm">
                    <span className="opacity-65">
                      {property.floors.length} {property.floors.length === 1 ? "floor" : "floors"} ·{" "}
                      {role.toLowerCase()}
                    </span>
                    <Badge className="bg-[#153f3a] text-[#fffbed]">
                      {property.securityState?.mode ?? "DISARMED"}
                    </Badge>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
