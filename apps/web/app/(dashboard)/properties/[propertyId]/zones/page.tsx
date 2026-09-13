import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAccess } from "@/server/authz";
import { PropertyAccessError } from "@homeguard/auth";
import { prisma } from "@homeguard/database";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddRoomToZoneForm } from "./add-room-to-zone-form";
import { NewZoneForm } from "./new-zone-form";
import { RemoveRoomButton } from "./remove-room-button";

export default async function ZonesPage({
  params,
}: {
  params: Promise<{ propertyId: string }>;
}) {
  const { propertyId } = await params;

  try {
    await requireAccess(propertyId, "VIEWER");
  } catch (error) {
    if (error instanceof PropertyAccessError) {
      notFound();
    }
    throw error;
  }

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: {
      id: true,
      name: true,
      floors: {
        select: { rooms: { orderBy: { name: "asc" }, select: { id: true, name: true } } },
      },
      zones: {
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          modeLinks: { select: { mode: true } },
          rooms: { select: { room: { select: { id: true, name: true } } } },
        },
      },
    },
  });

  if (!property) {
    notFound();
  }

  const allRooms = property.floors.flatMap((floor) => floor.rooms);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <div>
        <Link
          href={`/properties/${property.id}`}
          className="text-sm text-neutral-500 hover:underline"
        >
          ← {property.name}
        </Link>
        <h1 className="text-xl font-semibold">Security zones</h1>
        <p className="text-sm text-neutral-500">
          Zones group rooms and mark which security modes treat them as monitored.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Add zone</CardTitle>
        </CardHeader>
        <CardContent>
          <NewZoneForm propertyId={property.id} />
        </CardContent>
      </Card>

      {property.zones.length === 0 && (
        <p className="text-sm text-neutral-500">
          No zones yet. Add one above — e.g. "Perimeter" active for Home/Night/Away.
        </p>
      )}

      {property.zones.map((zone) => {
        const memberRoomIds = new Set(zone.rooms.map((link) => link.room.id));
        const availableRooms = allRooms.filter((room) => !memberRoomIds.has(room.id));

        return (
          <Card key={zone.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {zone.name}
                <span className="flex gap-1">
                  {zone.modeLinks.map((link) => (
                    <Badge key={link.mode} variant="outline">
                      {link.mode}
                    </Badge>
                  ))}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {zone.rooms.length > 0 ? (
                <ul className="flex flex-col gap-1 text-sm">
                  {zone.rooms.map(({ room }) => (
                    <li key={room.id} className="flex items-center justify-between">
                      {room.name}
                      <RemoveRoomButton
                        propertyId={property.id}
                        zoneId={zone.id}
                        roomId={room.id}
                      />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-neutral-500">No rooms assigned yet.</p>
              )}
              <AddRoomToZoneForm propertyId={property.id} zoneId={zone.id} rooms={availableRooms} />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
