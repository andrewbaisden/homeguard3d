"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SimulationStatus } from "@homeguard/domain";
import { useRealtimeStore } from "@homeguard/state";
import { useEffect, useState, useTransition } from "react";
import { controlSimulation, getSimulationStatus } from "./actions";

const SPEED_OPTIONS = [0.25, 0.5, 1, 2, 4, 8] as const;

function formatClock(ms: number): string {
  const totalSeconds = Math.floor(ms / 1_000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function SimulationControls({
  propertyId,
  initial,
}: {
  propertyId: string;
  initial: SimulationStatus;
}) {
  const [status, setStatus] = useState(initial);
  const [scenarioKey, setScenarioKey] = useState(
    initial.run?.scenarioKey ??
      initial.scenarios.find((s) => s.available)?.key ??
      initial.scenarios[0]?.key ??
      "",
  );
  const [speedFactor, setSpeedFactor] = useState<number>(initial.run?.speedFactor ?? 1);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const security = useRealtimeStore((state) => state.properties[propertyId]?.security);
  const runActive = status.run?.status === "RUNNING" || status.run?.status === "PAUSED";

  useEffect(() => {
    if (status.run?.status !== "RUNNING") return;
    const id = window.setInterval(() => {
      void getSimulationStatus(propertyId)
        .then(setStatus)
        .catch(() => {
          /* keep last known status while polling */
        });
    }, 750);
    return () => window.clearInterval(id);
  }, [propertyId, status.run?.status]);

  function run(control: Parameters<typeof controlSimulation>[1]) {
    setError(null);
    startTransition(async () => {
      try {
        const next = await controlSimulation(propertyId, control);
        setStatus(next);
        if (next.run) {
          setScenarioKey(next.run.scenarioKey);
          setSpeedFactor(next.run.speedFactor);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Simulation control failed.");
      }
    });
  }

  const selected = status.scenarios.find((scenario) => scenario.key === scenarioKey);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 rounded-lg border p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Run status</p>
            <p className="text-xs text-neutral-500">
              {status.run
                ? `${status.run.scenarioName} · ${status.run.status.toLowerCase()}`
                : "No simulation run yet"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {runActive && <Badge variant="secondary">SIMULATED</Badge>}
            {status.run && (
              <Badge variant={status.run.status === "RUNNING" ? "destructive" : "outline"}>
                {status.run.status}
              </Badge>
            )}
          </div>
        </div>

        {status.run && (
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-xs text-neutral-500">
              <span>
                Clock {formatClock(status.run.simClockMs)} / {formatClock(status.run.durationMs)}
              </span>
              <span>{status.run.speedFactor}×</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-neutral-100">
              <div
                className="h-full bg-neutral-900 transition-[width]"
                style={{
                  width: `${Math.min(
                    100,
                    status.run.durationMs === 0
                      ? 100
                      : (status.run.simClockMs / status.run.durationMs) * 100,
                  )}%`,
                }}
              />
            </div>
          </div>
        )}

        {security && (
          <p className="text-xs text-neutral-500">
            Live security: {security.machineState.replaceAll("_", " ").toLowerCase()}
            {security.mode !== "DISARMED" ? ` · ${security.mode}` : ""}
            {security.source === "SIMULATION" ? " · SIMULATED" : ""}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-4 rounded-lg border p-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="simulation-scenario">Scenario</Label>
            <Select
              value={scenarioKey}
              onValueChange={(value) => {
                if (typeof value === "string") setScenarioKey(value);
              }}
              disabled={pending || runActive}
            >
              <SelectTrigger id="simulation-scenario" className="w-56">
                <SelectValue>
                  {(value: string | null) =>
                    status.scenarios.find((scenario) => scenario.key === value)?.name ?? value
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {status.scenarios.map((scenario) => (
                  <SelectItem
                    key={scenario.key}
                    value={scenario.key}
                    disabled={!scenario.available}
                  >
                    {scenario.name}
                    {!scenario.available ? " (missing devices)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="simulation-speed">Speed</Label>
            <Select
              value={String(speedFactor)}
              onValueChange={(value) => {
                if (typeof value !== "string") return;
                const next = Number(value);
                setSpeedFactor(next);
                if (runActive) {
                  run({ action: "speed", speedFactor: next });
                }
              }}
              disabled={pending}
            >
              <SelectTrigger id="simulation-speed" className="w-28">
                <SelectValue>{(value: string | null) => `${value ?? "1"}×`}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {SPEED_OPTIONS.map((speed) => (
                  <SelectItem key={speed} value={String(speed)}>
                    {speed}×
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {selected && (
          <p className="text-sm text-neutral-600">
            {selected.description}
            {!selected.available && selected.missingCategories.length > 0
              ? ` Needs: ${selected.missingCategories.join(", ")}.`
              : ""}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={pending || !scenarioKey || selected?.available === false || runActive}
            onClick={() => run({ action: "start", scenarioKey, speedFactor })}
          >
            Start
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={pending || status.run?.status !== "RUNNING"}
            onClick={() => run({ action: "pause" })}
          >
            Pause
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={pending || status.run?.status !== "PAUSED"}
            onClick={() => run({ action: "resume" })}
          >
            Resume
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={pending || !status.run || status.run.status === "IDLE"}
            onClick={() => run({ action: "reset" })}
          >
            Reset
          </Button>
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">Stories</p>
        <ul className="flex flex-col gap-2">
          {status.scenarios.map((scenario) => (
            <li key={scenario.key} className="rounded-lg border px-3 py-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{scenario.name}</span>
                <Badge variant={scenario.available ? "secondary" : "outline"}>
                  {scenario.available ? formatClock(scenario.durationMs) : "unavailable"}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-neutral-500">{scenario.description}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
