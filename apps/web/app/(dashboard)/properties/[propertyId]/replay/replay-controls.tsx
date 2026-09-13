"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useReplayStore } from "@homeguard/state";
import { useState, useTransition } from "react";
import { replayPropertyToTime } from "./actions";

export function ReplayControls({ propertyId }: { propertyId: string }) {
  const [targetAt, setTargetAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const state = useReplayStore((store) => store.state);
  const snapshotTakenAt = useReplayStore((store) => store.snapshotTakenAt);
  const loadedTarget = useReplayStore((store) => store.targetAt);
  const clear = useReplayStore((store) => store.clear);

  function run() {
    setError(null);
    startTransition(async () => {
      try {
        const iso = new Date(targetAt).toISOString();
        const result = await replayPropertyToTime(propertyId, iso);
        useReplayStore.setState({
          propertyId,
          targetAt: result.targetAt,
          snapshotTakenAt: result.snapshotTakenAt,
          state: result.state,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Replay failed.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="replay-target">Replay to</Label>
          <Input
            id="replay-target"
            type="datetime-local"
            value={targetAt}
            onChange={(event) => setTargetAt(event.target.value)}
          />
        </div>
        <Button size="sm" disabled={pending} onClick={run}>
          Load replay
        </Button>
        <Button size="sm" variant="outline" disabled={!state} onClick={() => clear()}>
          Clear
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {state && (
        <div className="flex flex-col gap-3 rounded-lg border p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Replay</Badge>
            <span className="text-xs text-neutral-500">
              Snapshot {snapshotTakenAt} → {loadedTarget}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium">Security</p>
            <Badge variant="outline">{state.security.machineState}</Badge>
            <Badge variant="outline">{state.security.mode}</Badge>
            {state.security.source === "SIMULATION" && <Badge variant="secondary">SIMULATED</Badge>}
          </div>
          <ul className="flex flex-col gap-1 text-sm">
            {Object.values(state.devicesById).map((device) => (
              <li
                key={device.id}
                className="flex justify-between gap-2 border-b py-1 last:border-0"
              >
                <span className="font-mono text-xs">{device.id}</span>
                <span className="text-xs text-neutral-500">
                  {[device.doorState, device.lockState, device.motionState, device.connectivity]
                    .filter(Boolean)
                    .join(" · ") || "no state"}
                  {device.source === "SIMULATION" ? " · SIM" : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
