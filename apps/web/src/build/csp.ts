/**
 * The web app's content security policy, written into the built page.
 *
 * @remarks Scripts only from the app itself, no third-party requests, remote images blocked and Trusted Types
 * required (security §2, §4; AGENTS.md hard rules 7 and 10). Network calls go only to the app itself and the model
 * providers the person can choose (MVP S13.5); with no model set up, the app calls nothing else (S1.5, S13.1). A static
 * host can't send headers, so the policy is a `<meta>` tag; `frame-ancestors` and reporting need headers and are
 * left out. Only the build gets the policy: the development server's hot reload needs inline scripts.
 * @packageDocumentation
 */
import type { Plugin } from "vite";

/** The policy's directives, in the order they are written. */
const DIRECTIVES: readonly (readonly [string, ...string[]])[] = [
  ["default-src", "'self'"],
  ["script-src", "'self'"],
  ["style-src", "'self'"],
  // The theme draws its AI hatching with a data: SVG; remote images are blocked.
  ["img-src", "'self'", "data:"],
  ["font-src", "'self'"],
  // The app itself and the fixed list of model providers, with any port on this machine for a local server
  // (security §4, spike S1). Any other provider needs a self-hosted build with its own list (ADR-0011).
  [
    "connect-src",
    "'self'",
    "https://api.anthropic.com",
    "https://api.openai.com",
    "https://openrouter.ai",
    "http://localhost:*",
    "http://127.0.0.1:*",
  ],
  ["object-src", "'none'"],
  ["base-uri", "'none'"],
  ["form-action", "'none'"],
  ["require-trusted-types-for", "'script'"],
  // No policies may be made: nothing in the app writes HTML or script from strings.
  ["trusted-types", "'none'"],
];

/** The content security policy, as the value of a `Content-Security-Policy` header or `<meta>` tag. */
export const CONTENT_SECURITY_POLICY: string = DIRECTIVES.map((directive) => directive.join(" ")).join("; ");

/**
 * Adds the content security policy to a page, before anything it governs.
 *
 * @remarks Straight after the character set when the page declares one, which must stay first, otherwise first in
 * the head; a policy in a `<meta>` tag applies only to what follows it.
 * @param html - The page's HTML.
 * @returns The page with the policy's `<meta>` tag added.
 */
export function withContentSecurityPolicy(html: string): string {
  const meta = `<meta http-equiv="Content-Security-Policy" content="${CONTENT_SECURITY_POLICY}">`;
  const charset = /<meta\s+charset=[^>]*>/i;
  return charset.test(html)
    ? html.replace(charset, (tag) => tag + meta)
    : html.replace(/<head>/i, (head) => head + meta);
}

/**
 * A Vite plugin that writes the content security policy into the built page.
 *
 * @returns The plugin, applied to builds only.
 */
export function contentSecurityPolicy(): Plugin {
  return {
    name: "pharoam-content-security-policy",
    apply: "build",
    transformIndexHtml: withContentSecurityPolicy,
  };
}
