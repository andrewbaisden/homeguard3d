import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WALL_SEGMENTS } from "@/lib/constants";
import { requireAccess } from "@/server/authz";
import { PropertyAccessError } from "@homeguard/auth";
import { prisma } from "@homeguard/database";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NewDoorForm } from "./new-door-form";
import { NewFloorForm } from "./new-floor-form";
import { NewRoomForm } from "./new-room-form";
import { NewWindowForm } from "./new-window-form";
import { OccupancyIndicator } from "./occupancy-indicator";
import { SecurityControl } from "./security-control";

type WallOffset = { wallSegmentIndex: number; offsetMeters: number; widthMeters: number };

function wallLabel(offset: unknown): string {
  const { wallSegmentIndex } = offset as WallOffset;
  return WALL_SEGMENTS[wallSegmentIndex]?.label ?? "Unknown wall";
}

function polygonBounds(polygon: unknown): { width: number; height: number } {
  const points = polygon as Array<{ x: number; y: number }>;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return {
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  };
}

export default async function PropertyPage({
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
    include: {
      securityState: true,
      floors: {
        orderBy: { level: "asc" },
        include: {
          rooms: {
            orderBy: { name: "asc" },
            include: { doors: true, windows: true },
          },
        },
      },
    },
  });

  if (!property) {
    notFound();
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{property.name}</h1>
          <p className="text-sm text-neutral-500">{property.timezone}</p>
        </div>
        <div className="flex items-center gap-3 text-sm text-neutral-500">
          <Link href={`/properties/${property.id}/twin-3d`} className="hover:underline">
            3D twin
          </Link>
          <Link href={`/properties/${property.id}/floor-plan`} className="hover:underline">
            Floor plan
          </Link>
          <Link href={`/properties/${property.id}/devices`} className="hover:underline">
            Devices
          </Link>
          <Link href={`/properties/${property.id}/zones`} className="hover:underline">
            Zones
          </Link>
          <Link href={`/properties/${property.id}/simulation`} className="hover:underline">
            Simulation
          </Link>
          <Link href={`/properties/${property.id}/alerts`} className="hover:underline">
            Alerts
          </Link>
          <Link href={`/properties/${property.id}/automations`} className="hover:underline">
            Automations
          </Link>
        </div>
      </div>

      <SecurityControl
        propertyId={property.id}
        initial={{
          machineState: property.securityState?.machineState ?? "IDLE_DISARMED",
          mode: property.securityState?.mode ?? "DISARMED",
        }}
      />

      <OccupancyIndicator propertyId={property.id} />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Add floor</CardTitle>
        </CardHeader>
        <CardContent>
          <NewFloorForm propertyId={property.id} />
        </CardContent>
      </Card>

      {property.floors.length === 0 && (
        <p className="text-sm text-neutral-500">
          No floors yet. Add one above to start placing rooms.
        </p>
      )}

      {property.floors.map((floor) => (
        <Card key={floor.id}>
          <CardHeader>
            <CardTitle>
              {floor.name}{" "}
              <span className="font-normal text-neutral-400">· level {floor.level}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {floor.rooms.map((room) => {
              const { width, height } = polygonBounds(room.polygon);
              return (
                <div key={room.id} className="flex flex-col gap-3 rounded-lg border p-4">
                  <div>
                    <p className="font-medium">{room.name}</p>
                    <p className="text-xs text-neutral-500">
                      {room.kind.replaceAll("_", " ")} · {width.toFixed(1)}m × {height.toFixed(1)}m
                    </p>
                  </div>

                  {(room.doors.length > 0 || room.windows.length > 0) && (
                    <ul className="flex flex-col gap-0.5 text-sm text-neutral-600">
                      {room.doors.map((door) => (
                        <li key={door.id}>
                          Door · {wallLabel(door.wallOffset)} wall ·{" "}
                          {door.isExterior ? "exterior" : "interior"}
                        </li>
                      ))}
                      {room.windows.map((win) => (
                        <li key={win.id}>Window · {wallLabel(win.wallOffset)} wall</li>
                      ))}
                    </ul>
                  )}

                  <div className="flex flex-col gap-2 border-t pt-3">
                    <NewDoorForm propertyId={property.id} roomId={room.id} />
                    <NewWindowForm propertyId={property.id} roomId={room.id} />
                  </div>
                </div>
              );
            })}

            <NewRoomForm propertyId={property.id} floorId={floor.id} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
