import { describe, expect, it } from "vitest";
import { formatNewProcessCnj } from "./new-process-input";

describe("formatNewProcessCnj", () => {
  it("formats a valid 20-digit CNJ", () => {
    expect(formatNewProcessCnj("00000000000000000000")).toBe("0000000-00.0000.0.00.0000");
  });

  it("accepts an already formatted CNJ", () => {
    expect(formatNewProcessCnj("0000000-00.0000.0.00.0000")).toBe("0000000-00.0000.0.00.0000");
  });

  it("rejects missing or incomplete CNJ values", () => {
    expect(formatNewProcessCnj("")).toBeNull();
    expect(formatNewProcessCnj("1234567890123456789")).toBeNull();
    expect(formatNewProcessCnj("123456789012345678901")).toBeNull();
  });
});
