import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUserId } from "@/lib/session";
import { prisma } from "@homeguard/database";
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

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Properties</h1>
        <Button nativeButton={false} render={<Link href="/properties/new">New property</Link>} />
      </div>

      {memberships.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-neutral-500">
            No properties yet. Create your first property to start modeling its floors and rooms.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {memberships.map(({ property, role }) => (
            <Link key={property.id} href={`/properties/${property.id}`}>
              <Card className="transition-colors hover:bg-muted/50">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    {property.name}
                    <Badge variant="outline">{property.securityState?.mode ?? "DISARMED"}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-between text-sm text-neutral-500">
                  <span>{property.floors.length} floors</span>
                  <span>{role}</span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
