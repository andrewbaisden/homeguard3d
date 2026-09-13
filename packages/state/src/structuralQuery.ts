import type { StructuralModel } from "@homeguard/domain";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export function structuralQueryKey(propertyId: string) {
  return ["property", propertyId, "structure"] as const;
}

export function usePropertyStructure(propertyId: string): StructuralModel {
  const { data } = useQuery<StructuralModel>({
    queryKey: structuralQueryKey(propertyId),
    queryFn: () =>
      Promise.reject(new Error("Structural data must be seeded by PropertyStateProvider")),
    staleTime: Number.POSITIVE_INFINITY,
  });
  if (!data) throw new Error(`Missing structural model for property ${propertyId}`);
  return data;
}

export function useUpdateDevicePosition(propertyId: string) {
  const queryClient = useQueryClient();
  return (deviceId: string, positionX: number, positionY: number) => {
    queryClient.setQueryData<StructuralModel>(structuralQueryKey(propertyId), (current) => {
      if (!current) return current;
      return {
        ...current,
        floors: current.floors.map((floor) => ({
          ...floor,
          rooms: floor.rooms.map((room) => ({
            ...room,
            devices: room.devices.map((device) =>
              device.id === deviceId ? { ...device, positionX, positionY } : device,
            ),
          })),
        })),
      };
    });
  };
}
