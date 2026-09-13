import { requireAccess } from "@/server/authz";
import { PropertyAccessError } from "@homeguard/auth";
import { prisma } from "@homeguard/database";
import Link from "next/link";
import { notFound } from "next/navigation";
import { type FloorData, FloorPlanCanvas } from "./floor-plan-canvas";

// Opened directly by the browser against the realtime service — see
// ARCHITECTURE.md section J. Falls back to the local dev default.
const REALTIME_SSE_BASE_URL = process.env.NEXT_PUBLIC_REALTIME_SSE_URL ?? "http://localhost:8080";

export default async function FloorPlanPage({
  params,
}: {
  params: Promise<{ propertyId: string }>;
}) {
  const { propertyId } = await params;

  let canEdit = false;
  try {
    const access = await requireAccess(propertyId, "VIEWER");
    canEdit = access.role === "ADMIN" || access.role === "OWNER";
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
        orderBy: { level: "asc" },
        select: {
          id: true,
          name: true,
          level: true,
          rooms: {
            orderBy: { name: "asc" },
            select: {
              id: true,
              name: true,
              kind: true,
              polygon: true,
              doors: { select: { id: true, wallOffset: true, isExterior: true } },
              windows: { select: { id: true, wallOffset: true } },
              devices: {
                orderBy: { id: "asc" },
                select: {
                  id: true,
                  label: true,
                  category: true,
                  roomId: true,
                  connectivity: true,
                  doorState: true,
                  lockState: true,
                  motionState: true,
                  cameraState: true,
                  batteryPct: true,
                  tempC: true,
                  humidityPct: true,
                  positionX: true,
                  positionY: true,
                  capabilities: { select: { capability: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!property) {
    notFound();
  }

  const floors: FloorData[] = property.floors.map((floor) => ({
    id: floor.id,
    name: floor.name,
    level: floor.level,
    rooms: floor.rooms.map((room) => ({
      id: room.id,
      name: room.name,
      kind: room.kind,
      polygon: room.polygon as Array<{ x: number; y: number }>,
      doors: room.doors as Array<{
        id: string;
        wallOffset: { wallSegmentIndex: number; offsetMeters: number; widthMeters: number };
        isExterior: boolean;
      }>,
      windows: room.windows as Array<{
        id: string;
        wallOffset: { wallSegmentIndex: number; offsetMeters: number; widthMeters: number };
      }>,
      devices: room.devices.map((device) => ({
        id: device.id,
        label: device.label,
        category: device.category,
        roomId: device.roomId,
        connectivity: device.connectivity,
        doorState: device.doorState,
        lockState: device.lockState,
        motionState: device.motionState,
        cameraState: device.cameraState,
        batteryPct: device.batteryPct,
        tempC: device.tempC,
        humidityPct: device.humidityPct,
        positionX: device.positionX,
        positionY: device.positionY,
        capabilities: device.capabilities.map((c) => c.capability),
      })),
    })),
  }));

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <div>
        <Link
          href={`/properties/${property.id}`}
          className="text-sm text-neutral-500 hover:underline"
        >
          ← {property.name}
        </Link>
        <h1 className="text-xl font-semibold">Floor plan</h1>
      </div>

      {floors.length === 0 ? (
        <p className="text-sm text-neutral-500">
          No floors yet — add one from the property page first.
        </p>
      ) : (
        <FloorPlanCanvas
          propertyId={property.id}
          floors={floors}
          sseBaseUrl={REALTIME_SSE_BASE_URL}
          canEdit={canEdit}
        />
      )}
    </div>
  );
}
