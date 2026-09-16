"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { SecurityMachineState, SecurityMode } from "@homeguard/domain";
import { useRealtimeStore } from "@homeguard/state";
import { MoonStar, ShieldCheck, Sun, TentTree } from "lucide-react";
import { useState } from "react";
import { armSecurity, cancelArm, disarmSecurity } from "./security-actions";

export interface SecuritySnapshot {
  machineState: SecurityMachineState;
  mode: SecurityMode;
}

const MACHINE_STATE_LABEL: Record<SecurityMachineState, string> = {
  IDLE_DISARMED: "Disarmed",
  EXIT_DELAY: "Arming…",
  ARMED: "Armed",
  ENTRY_DELAY: "Entry delay",
  ALERT: "Alert",
  ALARM: "ALARM",
  DISARMING: "Disarming…",
};

function badgeVariant(machineState: SecurityMachineState): "outline" | "secondary" | "destructive" {
  if (machineState === "IDLE_DISARMED") return "outline";
  if (machineState === "ARMED") return "secondary";
  return "destructive"; // EXIT_DELAY/ENTRY_DELAY/ALERT/ALARM/DISARMING all warrant attention
}

export function SecurityControl({
  propertyId,
  initial,
}: {
  propertyId: string;
  initial: SecuritySnapshot;
}) {
  const snapshot = useRealtimeStore((state) => state.properties[propertyId]?.security) ?? {
    ...initial,
    changedAt: new Date(0).toISOString(),
    source: null,
  };
  const [pendingMode, setPendingMode] = useState<SecurityMode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleArm(mode: SecurityMode, override = false) {
    if (mode === "DISARMED") return;
    setBusy(true);
    setError(null);
    try {
      await armSecurity(propertyId, mode, override);
      setPendingMode(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to arm.");
      setPendingMode(mode);
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel() {
    setBusy(true);
    setError(null);
    try {
      await cancelArm(propertyId);
    } finally {
      setBusy(false);
    }
  }

  async function handleDisarm() {
    setBusy(true);
    setError(null);
    try {
      await disarmSecurity(propertyId);
      setPendingMode(null);
    } finally {
      setBusy(false);
    }
  }

  const { machineState } = snapshot;

  return (
    <div className="control-surface flex min-h-36 flex-col gap-4 p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-full bg-white/10 text-[#d8ff5f]">
            <ShieldCheck className="size-5" />
          </span>
          <div>
            <p className="font-semibold">Security</p>
            <p className="text-xs text-white/50">
              {snapshot.mode !== "DISARMED" ? `Mode: ${snapshot.mode}` : "Not armed"}
            </p>
          </div>
        </div>
        <Badge
          variant={badgeVariant(machineState)}
          className={machineState === "IDLE_DISARMED" ? "border-white/20 text-white" : undefined}
        >
          {MACHINE_STATE_LABEL[machineState]}
        </Badge>
      </div>
      {snapshot.source === "SIMULATION" && (
        <Badge variant="secondary" className="w-fit">
          SIMULATED
        </Badge>
      )}

      {machineState === "IDLE_DISARMED" && (
        <div className="flex flex-wrap gap-2">
          <Button
            className="bg-[#ff916f] text-[#153f3a] hover:bg-[#ffa88d]"
            size="sm"
            disabled={busy}
            onClick={() => handleArm("HOME")}
          >
            <Sun /> Home
          </Button>
          <Button
            className="bg-[#6957e8] text-white hover:bg-[#7d6bed]"
            size="sm"
            disabled={busy}
            onClick={() => handleArm("NIGHT")}
          >
            <MoonStar /> Night
          </Button>
          <Button
            className="bg-[#d8ff5f] text-[#153f3a] hover:bg-[#e4ff8a]"
            size="sm"
            disabled={busy}
            onClick={() => handleArm("AWAY")}
          >
            <TentTree /> Away
          </Button>
        </div>
      )}

      {machineState === "EXIT_DELAY" && (
        <Button
          className="border-white/25 bg-white/5 text-white hover:bg-white/10 hover:text-white"
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={handleCancel}
        >
          Cancel arming
        </Button>
      )}

      {(machineState === "ARMED" ||
        machineState === "ENTRY_DELAY" ||
        machineState === "ALERT" ||
        machineState === "ALARM") && (
        <Button size="sm" variant="destructive" disabled={busy} onClick={handleDisarm}>
          Disarm
        </Button>
      )}

      {error && (
        <div className="flex flex-col gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-2">
          <p className="text-xs text-destructive">{error}</p>
          {pendingMode && (
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => handleArm(pendingMode, true)}
            >
              Arm anyway
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
