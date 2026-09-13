"use client";

import { Button } from "@/components/ui/button";
import { useState } from "react";
import { deleteAutomationRule, setAutomationRuleEnabled } from "./actions";

export function AutomationRuleControls({
  propertyId,
  ruleId,
  enabled,
}: {
  propertyId: string;
  ruleId: string;
  enabled: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      await setAutomationRuleEnabled(propertyId, ruleId, !enabled);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await deleteAutomationRule(propertyId, ruleId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <Button size="sm" variant="outline" disabled={busy} onClick={toggle}>
          {enabled ? "Disable" : "Enable"}
        </Button>
        <Button size="sm" variant="destructive" disabled={busy} onClick={remove}>
          Delete
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
