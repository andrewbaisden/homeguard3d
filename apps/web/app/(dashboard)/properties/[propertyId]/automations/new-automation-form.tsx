"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AutomationRuleDefinition } from "@homeguard/domain";
import { useState } from "react";
import { createAutomationRule } from "./actions";

const EVENT_TYPES = [
  "device.offline",
  "device.online",
  "door.opened",
  "motion.started",
  "security.entry_delay_expired",
  "lock.jammed",
] as const;

export function NewAutomationForm({ propertyId }: { propertyId: string }) {
  const [name, setName] = useState("");
  const [eventType, setEventType] = useState<string>(EVENT_TYPES[0]);
  const [severity, setSeverity] = useState<"INFO" | "WARNING" | "CRITICAL">("WARNING");
  const [title, setTitle] = useState("Automation alert");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const definition: AutomationRuleDefinition = {
      trigger: { kind: "event_type", type: eventType },
      conditions: [],
      actions: [{ kind: "RAISE_ALERT", severity, title }],
    };
    try {
      await createAutomationRule(propertyId, { name, definition });
      setName("");
      setTitle("Automation alert");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create rule.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="rule-name">Name</Label>
          <Input
            id="rule-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Offline while Away"
            required
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="rule-trigger">Trigger event</Label>
          <Select value={eventType} onValueChange={(value) => value && setEventType(value)}>
            <SelectTrigger id="rule-trigger" className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EVENT_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="rule-severity">Alert severity</Label>
          <Select
            value={severity}
            onValueChange={(value) =>
              value && setSeverity(value as "INFO" | "WARNING" | "CRITICAL")
            }
          >
            <SelectTrigger id="rule-severity" className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="INFO">INFO</SelectItem>
              <SelectItem value="WARNING">WARNING</SelectItem>
              <SelectItem value="CRITICAL">CRITICAL</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="rule-title">Alert title</Label>
          <Input
            id="rule-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>
      </div>
      <Button type="submit" size="sm" disabled={busy} className="w-fit">
        Create rule
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </form>
  );
}
