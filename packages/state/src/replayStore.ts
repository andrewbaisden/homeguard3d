import type { DomainEvent, ReplayState } from "@homeguard/domain";
import { replayToTime } from "@homeguard/domain";
import { create } from "zustand";

interface ReplayStore {
  propertyId: string | null;
  targetAt: string | null;
  snapshotTakenAt: string | null;
  state: ReplayState | null;
  load: (input: {
    propertyId: string;
    targetAt: string;
    snapshotTakenAt: string;
    base: ReplayState;
    events: DomainEvent[];
  }) => void;
  clear: () => void;
}

export const useReplayStore = create<ReplayStore>((set) => ({
  propertyId: null,
  targetAt: null,
  snapshotTakenAt: null,
  state: null,
  load: ({ propertyId, targetAt, snapshotTakenAt, base, events }) =>
    set({
      propertyId,
      targetAt,
      snapshotTakenAt,
      state: replayToTime(base, events),
    }),
  clear: () =>
    set({
      propertyId: null,
      targetAt: null,
      snapshotTakenAt: null,
      state: null,
    }),
}));
