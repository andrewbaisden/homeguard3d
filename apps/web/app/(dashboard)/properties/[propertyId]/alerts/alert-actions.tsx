"use client";

import { Button } from "@/components/ui/button";
import { useState } from "react";
import { acknowledgeAlert, resolveAlert } from "./actions";

export function AlertActions({
  propertyId,
  alertId,
  status,
}: {
  propertyId: string;
  alertId: string;
  status: "OPEN" | "ACKNOWLEDGED" | "RESOLVED";
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: "ack" | "resolve") {
    setBusy(true);
    setError(null);
    try {
      if (action === "ack") await acknowledgeAlert(propertyId, alertId);
      else await resolveAlert(propertyId, alertId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  if (status === "RESOLVED") return null;

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        {status === "OPEN" && (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => run("ack")}>
            Acknowledge
          </Button>
        )}
        <Button size="sm" variant="destructive" disabled={busy} onClick={() => run("resolve")}>
          Resolve
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
