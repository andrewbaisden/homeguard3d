import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WALL_SEGMENTS } from "@/lib/constants";
import { requireAccess } from "@/server/authz";
import { PropertyAccessError } from "@homeguard/auth";
import { prisma } from "@homeguard/database";
import { AppWindow, DoorOpen, Layers3 } from "lucide-react";
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
      _count: { select: { devices: true, alerts: true } },
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
    <div className="flex flex-col gap-8">
      <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="relative min-h-72 overflow-hidden rounded-[1.7rem] bg-[#ff916f] p-7 sm:p-9">
          <div className="absolute -right-14 -top-16 size-60 rounded-full border-[3.5rem] border-[#fffbed]/30" />
          <div className="relative flex h-full flex-col justify-between">
            <div>
              <span className="eyebrow">Live overview</span>
              <h2 className="mt-5 max-w-lg text-4xl font-semibold leading-[0.95] tracking-[-0.06em] sm:text-5xl">
                Your home at a glance.
              </h2>
              <p className="mt-4 text-sm opacity-65">Local time · {property.timezone}</p>
            </div>
            <div className="mt-12 grid grid-cols-3 gap-2">
              {[
                { label: "Floors", value: property.floors.length },
                { label: "Devices", value: property._count.devices },
                { label: "Alerts", value: property._count.alerts },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl bg-[#fffbed]/55 p-3 sm:p-4">
                  <p className="text-2xl font-semibold tracking-tight">{item.value}</p>
                  <p className="mt-1 text-xs font-medium opacity-60">{item.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="grid gap-4">
          <SecurityControl
            propertyId={property.id}
            initial={{
              machineState: property.securityState?.machineState ?? "IDLE_DISARMED",
              mode: property.securityState?.mode ?? "DISARMED",
            }}
          />
          <OccupancyIndicator propertyId={property.id} />
        </div>
      </section>

      <Card className="bg-white/55">
        <CardHeader>
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-full bg-[#d8ff5f]">
              <Layers3 className="size-4" />
            </span>
            <div>
              <CardTitle>Add a floor</CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Grow the structure of your digital twin.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <NewFloorForm propertyId={property.id} />
        </CardContent>
      </Card>

      {property.floors.length === 0 && (
        <p className="rounded-[1.3rem] border border-dashed border-foreground/20 bg-white/25 p-10 text-center text-sm text-muted-foreground">
          No floors yet. Add one above to start placing rooms.
        </p>
      )}

      {property.floors.map((floor) => (
        <Card key={floor.id} className="bg-[#fffbed]/75">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <span className="eyebrow">Level {floor.level}</span>
                <CardTitle className="mt-3 text-2xl font-semibold tracking-[-0.04em]">
                  {floor.name}
                </CardTitle>
              </div>
              <span className="rounded-full bg-[#8fdcd0] px-3 py-1.5 text-xs font-bold">
                {floor.rooms.length} {floor.rooms.length === 1 ? "room" : "rooms"}
              </span>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-2">
            {floor.rooms.map((room) => {
              const { width, height } = polygonBounds(room.polygon);
              return (
                <div
                  key={room.id}
                  className="flex flex-col gap-4 rounded-[1.15rem] border bg-white/55 p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold">{room.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {room.kind.replaceAll("_", " ")} · {width.toFixed(1)}m × {height.toFixed(1)}
                        m
                      </p>
                    </div>
                    <span className="grid size-9 place-items-center rounded-full bg-[#f3a7c4]">
                      <AppWindow className="size-4" />
                    </span>
                  </div>

                  {(room.doors.length > 0 || room.windows.length > 0) && (
                    <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground">
                      {room.doors.map((door) => (
                        <li key={door.id}>
                          <DoorOpen className="mr-1.5 inline size-3.5" /> Door ·{" "}
                          {wallLabel(door.wallOffset)} wall ·{" "}
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

            <div className="lg:col-span-2">
              <NewRoomForm propertyId={property.id} floorId={floor.id} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
