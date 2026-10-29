/**
 * The web app's content security policy, written into the built page.
 *
 * @remarks Scripts only from the app itself, no third-party requests, remote images blocked and Trusted Types
 * required (security §2, §4; AGENTS.md hard rules 7 and 10). v0.1 talks to no outside service, so every request
 * stays on the app's own origin (MVP S1.5); model providers and the relay are added here when they arrive. A static
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
  ["connect-src", "'self'"],
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
