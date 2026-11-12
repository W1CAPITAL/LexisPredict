import { describe, expect, it } from "vitest";
import { formatNewProcessCnj } from "./new-process-input";

describe("formatNewProcessCnj", () => {
  it("formats a valid CNJ with its modulo-97 check digits", () => {
    expect(formatNewProcessCnj("10055307620248260082")).toBe("1005530-76.2024.8.26.0082");
  });

  it("accepts an already formatted valid CNJ", () => {
    expect(formatNewProcessCnj("1005530-76.2024.8.26.0082")).toBe("1005530-76.2024.8.26.0082");
  });

  it("rejects missing, incomplete or invalid check digits", () => {
    expect(formatNewProcessCnj("")).toBeNull();
    expect(formatNewProcessCnj("1234567890123456789")).toBeNull();
    expect(formatNewProcessCnj("123456789012345678901")).toBeNull();
    expect(formatNewProcessCnj("10055307720248260082")).toBeNull();
  });
});
