import { describe, expect, it } from "vitest";
import { CONTENT_SECURITY_POLICY } from "../build/csp.ts";
import { PROVIDERS, providerAddress } from "./providers.ts";

describe("PROVIDERS (MVP S13, security §4)", () => {
  it("offers Anthropic, OpenAI, OpenRouter and a local server, each with the address it calls", () => {
    expect(Object.keys(PROVIDERS)).toEqual(["anthropic", "openai", "openrouter", "local"]);
    expect(PROVIDERS.anthropic.address).toBe("https://api.anthropic.com");
    expect(PROVIDERS.openai.address).toBe("https://api.openai.com/v1");
    expect(PROVIDERS.openrouter.address).toBe("https://openrouter.ai/api/v1");
    expect(PROVIDERS.local.address).toBe("http://localhost:11434/v1");
  });

  it("asks for a key from hosted providers only, and links each to its own data policy (S13.7)", () => {
    expect(PROVIDERS.anthropic.needsKey).toBe(true);
    expect(PROVIDERS.local.needsKey).toBe(false);
    for (const kind of ["anthropic", "openai", "openrouter"] as const) {
      expect(PROVIDERS[kind].dataPolicy).toMatch(/^https:\/\//);
    }
    expect(PROVIDERS.local.dataPolicy).toBeUndefined();
  });

  it("only offers addresses the content security policy lets the app reach", () => {
    const connect = /connect-src ([^;]*)/.exec(CONTENT_SECURITY_POLICY)?.[1]?.split(" ") ?? [];
    for (const { address } of Object.values(PROVIDERS)) {
      const origin = new URL(address).origin;
      const local = origin.startsWith("http://localhost:") ? "http://localhost:*" : origin;
      expect(connect).toContain(local);
    }
  });
});

describe("providerAddress (MVP S13.5)", () => {
  it("keeps a hosted provider's fixed address, whatever was typed", () => {
    expect(providerAddress("openrouter", "https://evil.example/v1")).toEqual({
      ok: true,
      value: "https://openrouter.ai/api/v1",
    });
  });

  it.each(["http://localhost:1234/v1", "http://127.0.0.1:11434/v1", "http://localhost:8080/api/v1/"])(
    "accepts a local server at %s",
    (typed) => {
      expect(providerAddress("local", typed)).toEqual({ ok: true, value: typed.replace(/\/+$/, "") });
    },
  );

  it.each([
    "https://example.com/v1",
    "http://192.168.1.20:11434/v1",
    "http://localhost.example.com/v1",
    "ftp://localhost/v1",
    "https://localhost:1234/v1",
    "not an address",
  ])("refuses %s as a local server, since the policy blocks it", (typed) => {
    expect(providerAddress("local", typed)).toEqual({ ok: false, error: { kind: "not-local" } });
  });
});
