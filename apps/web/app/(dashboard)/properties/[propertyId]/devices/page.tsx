import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAccess } from "@/server/authz";
import { PropertyAccessError } from "@homeguard/auth";
import { prisma } from "@homeguard/database";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { DeviceRow } from "./device-table";
import { DeviceTable } from "./device-table";
import { NewDeviceForm } from "./new-device-form";

export default async function DevicesPage({
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
        orderBy: { level: "asc" },
        select: { rooms: { orderBy: { name: "asc" }, select: { id: true, name: true } } },
      },
      devices: {
        orderBy: { label: "asc" },
        select: {
          id: true,
          label: true,
          category: true,
          provider: true,
          connectivity: true,
          doorState: true,
          lockState: true,
          motionState: true,
          cameraState: true,
          batteryPct: true,
          tempC: true,
          humidityPct: true,
          stateUpdatedAt: true,
          room: { select: { name: true } },
        },
      },
    },
  });

  if (!property) {
    notFound();
  }

  const rooms = property.floors.flatMap((floor) => floor.rooms);

  const devices: DeviceRow[] = property.devices.map((device) => ({
    id: device.id,
    label: device.label,
    category: device.category,
    provider: device.provider,
    roomName: device.room?.name ?? null,
    connectivity: device.connectivity,
    doorState: device.doorState,
    lockState: device.lockState,
    motionState: device.motionState,
    cameraState: device.cameraState,
    batteryPct: device.batteryPct,
    tempC: device.tempC,
    humidityPct: device.humidityPct,
    stateUpdatedAt: device.stateUpdatedAt?.toISOString() ?? null,
    source: null,
  }));

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8">
      <div>
        <Link
          href={`/properties/${property.id}`}
          className="text-sm text-neutral-500 hover:underline"
        >
          ← {property.name}
        </Link>
        <h1 className="text-xl font-semibold">Devices</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Add device</CardTitle>
        </CardHeader>
        <CardContent>
          <NewDeviceForm propertyId={property.id} rooms={rooms} />
        </CardContent>
      </Card>

      <DeviceTable propertyId={property.id} initialDevices={devices} />
    </div>
  );
}
