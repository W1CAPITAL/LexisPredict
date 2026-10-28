import { describe, expect, it } from "vitest";
import { notificationVersion, validNotificationCursor } from "./notification-long-poll";

describe("long polling — fingerprints de notificações", () => {
  const original = [
    { id: "a", created_at: "2026-10-28T11:00:00Z", updated_at: "2026-10-28T11:00:00Z", lida: false },
  ];

  it("mantém cursor estável quando a lista não muda", () => {
    expect(notificationVersion(original)).toBe(notificationVersion([...original]));
    expect(notificationVersion(original)).toMatch(/^[0-9a-f]{64}$/);
  });
  it("detecta inserções, leituras, alterações e exclusões", () => {
    const cursor = notificationVersion(original);
    expect(notificationVersion([...original, { ...original[0], id: "b" }])).not.toBe(cursor);
    expect(notificationVersion([{ ...original[0], lida: true, read_at: "2026-10-28T11:01:00Z" }])).not.toBe(cursor);
    expect(notificationVersion([{ ...original[0], updated_at: "2026-10-28T11:02:00Z" }])).not.toBe(cursor);
    expect(notificationVersion([])).not.toBe(cursor);
  });
  it("rejeita cursores arbitrários e não confia em IDs fornecidos pela URL", () => {
    const cursor = notificationVersion(original);
    expect(validNotificationCursor(cursor)).toBe(cursor);
    expect(validNotificationCursor("abc")).toBeNull();
    expect(validNotificationCursor("a".repeat(1000))).toBeNull();
    expect(validNotificationCursor(null)).toBeNull();
  });
});
