import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  publicCommercialSignupEnabled,
  probeCommercialSignupSchema,
  REQUIRED_COMMERCIAL_RELATIONS,
} from "./signup-readiness";

describe("commercial signup must fail closed before using production auth", () => {
  it("defaults public signup to OFF unless explicitly enabled on the server", () => {
    expect(publicCommercialSignupEnabled(undefined)).toBe(false);
    expect(publicCommercialSignupEnabled("TRUE")).toBe(false);
    expect(publicCommercialSignupEnabled("1")).toBe(false);
    expect(publicCommercialSignupEnabled("true")).toBe(true);
  });

  it("checks required tables and columns without reading any customer rows", async () => {
    const calls: Array<{ table: string; columns: string; head: boolean; limit: number }> = [];
    const client = {
      from(table: string) {
        return {
          select(columns: string, options: { head: true }) {
            return {
              async limit(limit: number) {
                calls.push({ table, columns, head: options.head, limit });
                return { error: null };
              },
            };
          },
        };
      },
    };
    expect(await probeCommercialSignupSchema(client)).toEqual({ ok: true, missing: [] });
    expect(calls.length).toBe(REQUIRED_COMMERCIAL_RELATIONS.length);
    expect(calls.every(call => call.head && call.limit === 0)).toBe(true);
    expect(calls.some(call => call.table === "assinaturas")).toBe(true);
    expect(calls.some(call => call.table === "commercial_signup_attempts")).toBe(true);
  });

  it("refuses onboarding on a missing table, broken query or exception", async () => {
    const client = {
      from(table: string) {
        return {
          select() {
            return {
              async limit() {
                if (table === "assinaturas") return { error: { message: "Table not found" } };
                if (table === "commercial_audit_log") throw new Error("Unavailable");
                return { error: null };
              },
            };
          },
        };
      },
    };
    const result = await probeCommercialSignupSchema(client);
    expect(result.ok).toBe(false);
    expect(result.missing).toContain("assinaturas");
    expect(result.missing).toContain("commercial_audit_log");
  });

  it("prevents account recovery by unverified email and fail-open rate limit storage", () => {
    const source = readFileSync(resolve(process.cwd(), "src/app/actions/commercial-signup-actions.ts"), "utf8");
    expect(source).toContain("publicCommercialSignupEnabled(process.env.LEXIS_COMMERCIAL_SIGNUP_ENABLED)");
    expect(source).toContain("probeCommercialSignupSchema(admin)");
    expect(source).toContain("email_confirm: false");
    expect(source).not.toContain("admin.auth.admin.listUsers(");
    expect(source).not.toContain("admin.auth.admin.updateUserById(");
    expect(source).toContain("if (writeError) return { ok: false");
    expect(source).toContain("if (error) return { ok: false");
    const gate = source.indexOf("if (!publicCommercialSignupEnabled(process.env.LEXIS_COMMERCIAL_SIGNUP_ENABLED))");
    const create = source.indexOf("admin.auth.admin.createUser(");
    expect(gate).toBeGreaterThan(-1);
    expect(create).toBeGreaterThan(gate);
    expect(source.indexOf("probeCommercialSignupSchema(admin)")).toBeLessThan(create);
  });
});
