"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  type SecurityMachineState,
  type SecurityMode,
  domainEventSchema,
  mapToSecurityDomainEvent,
  transition,
} from "@homeguard/domain";
import { useEffect, useState } from "react";
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
  sseBaseUrl,
}: {
  propertyId: string;
  initial: SecuritySnapshot;
  sseBaseUrl: string;
}) {
  const [snapshot, setSnapshot] = useState(initial);
  const [pendingMode, setPendingMode] = useState<SecurityMode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSnapshot(initial);
  }, [initial]);

  useEffect(() => {
    const source = new EventSource(`${sseBaseUrl}/realtime/${propertyId}/stream`);
    source.onmessage = (message) => {
      let raw: unknown;
      try {
        raw = JSON.parse(message.data);
      } catch {
        return;
      }
      const parsed = domainEventSchema.safeParse(raw);
      if (!parsed.success) return;

      const securityEvent = mapToSecurityDomainEvent(parsed.data);
      if (!securityEvent) return;

      setSnapshot((current) => transition(current, securityEvent).next);
    };
    return () => source.close();
  }, [propertyId, sseBaseUrl]);

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
    <div className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Security</p>
          <p className="text-xs text-neutral-500">
            {snapshot.mode !== "DISARMED" ? `Mode: ${snapshot.mode}` : "Not armed"}
          </p>
        </div>
        <Badge variant={badgeVariant(machineState)}>{MACHINE_STATE_LABEL[machineState]}</Badge>
      </div>

      {machineState === "IDLE_DISARMED" && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={busy} onClick={() => handleArm("HOME")}>
            Arm Home
          </Button>
          <Button size="sm" disabled={busy} onClick={() => handleArm("NIGHT")}>
            Arm Night
          </Button>
          <Button size="sm" disabled={busy} onClick={() => handleArm("AWAY")}>
            Arm Away
          </Button>
        </div>
      )}

      {machineState === "EXIT_DELAY" && (
        <Button size="sm" variant="outline" disabled={busy} onClick={handleCancel}>
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
