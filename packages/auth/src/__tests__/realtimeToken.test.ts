import { describe, expect, it } from "vitest";
import { createRealtimeToken, verifyRealtimeToken } from "../realtimeToken";

const secret = "a-test-secret-that-is-long-enough";
const now = 1_700_000_000_000;

describe("realtime property token", () => {
  it("accepts a valid token only for its property", () => {
    const token = createRealtimeToken("property-a", secret, now, 60_000);
    expect(verifyRealtimeToken(token, "property-a", secret, now)).toBe(true);
    expect(verifyRealtimeToken(token, "property-b", secret, now)).toBe(false);
  });

  it("rejects expired and tampered tokens", () => {
    const token = createRealtimeToken("property-a", secret, now, 100);
    expect(verifyRealtimeToken(token, "property-a", secret, now + 100)).toBe(false);
    expect(verifyRealtimeToken(`${token}x`, "property-a", secret, now)).toBe(false);
  });

  it("rejects malformed and missing tokens", () => {
    expect(verifyRealtimeToken(undefined, "property-a", secret, now)).toBe(false);
    expect(verifyRealtimeToken("not-a-token", "property-a", secret, now)).toBe(false);
    expect(verifyRealtimeToken("e30.invalid", "property-a", secret, now)).toBe(false);
  });
});
