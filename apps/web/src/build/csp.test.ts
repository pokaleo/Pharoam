import { describe, expect, it } from "vitest";
import { CONTENT_SECURITY_POLICY, withContentSecurityPolicy } from "./csp.ts";

// The policy's directives, by name.
const directives = new Map(
  CONTENT_SECURITY_POLICY.split(";").map((part) => {
    const [name = "", ...values] = part.trim().split(/\s+/);
    return [name, values];
  }),
);

describe("the content security policy (security §4)", () => {
  it("allows scripts only from the app itself, never inline or evaluated", () => {
    expect(directives.get("script-src")).toEqual(["'self'"]);
    expect(CONTENT_SECURITY_POLICY).not.toMatch(/unsafe-inline|unsafe-eval|https?:/);
  });

  it("allows network requests only to the app itself in v0.1 (MVP S1.5)", () => {
    expect(directives.get("connect-src")).toEqual(["'self'"]);
    expect(directives.get("default-src")).toEqual(["'self'"]);
  });

  it("blocks remote images; data URIs are allowed for the theme's own patterns (hard rule 10)", () => {
    expect(directives.get("img-src")).toEqual(["'self'", "data:"]);
  });

  it("requires Trusted Types for anything that would run as script", () => {
    expect(directives.get("require-trusted-types-for")).toEqual(["'script'"]);
    expect(directives.get("trusted-types")).toEqual(["'none'"]);
  });

  it("allows no plugins, base URL changes or form submissions", () => {
    expect(directives.get("object-src")).toEqual(["'none'"]);
    expect(directives.get("base-uri")).toEqual(["'none'"]);
    expect(directives.get("form-action")).toEqual(["'none'"]);
  });
});

describe("withContentSecurityPolicy", () => {
  const meta = `<meta http-equiv="Content-Security-Policy" content="${CONTENT_SECURITY_POLICY}">`;

  it("puts the policy straight after the character set, before anything it governs", () => {
    const html = withContentSecurityPolicy(
      '<html><head>\n<meta charset="utf-8" /><script src="x"></script></head></html>',
    );
    expect(html).toBe(`<html><head>\n<meta charset="utf-8" />${meta}<script src="x"></script></head></html>`);
  });

  it("puts the policy first in a head without a character set", () => {
    const html = withContentSecurityPolicy('<html><head><script src="x"></script></head></html>');
    expect(html).toBe(`<html><head>${meta}<script src="x"></script></head></html>`);
  });
});
