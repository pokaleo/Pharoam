/**
 * Packages Pharoam must never use: telemetry, analytics, session recording and LangSmith (AGENTS.md hard
 * rule 7).
 *
 * @packageDocumentation
 */

/**
 * The denied packages.
 *
 * @remarks Each entry matches the package name exactly, or as a scope prefix when it ends with "/".
 */
export const TELEMETRY_PACKAGES: readonly string[] = [
  "posthog-js",
  "posthog-node",
  "@sentry/",
  "@vercel/analytics",
  "@vercel/speed-insights",
  "mixpanel",
  "mixpanel-browser",
  "@amplitude/",
  "@segment/",
  "analytics-node",
  "@datadog/",
  "dd-trace",
  "newrelic",
  "@newrelic/",
  "react-ga",
  "react-ga4",
  "logrocket",
  "@fullstory/",
  "hotjar",
  "@hotjar/",
  "@bugsnag/",
  "langsmith",
  "@opentelemetry/",
];

/**
 * Tells whether an import or dependency refers to a denied package.
 *
 * @param specifier - A module specifier or package name, such as `posthog-js` or `@sentry/react/hooks`.
 * @returns `true` when it is a denied package or a subpath of one.
 */
export function isDeniedPackage(specifier: string): boolean {
  return TELEMETRY_PACKAGES.some((entry) =>
    entry.endsWith("/")
      ? specifier.startsWith(entry)
      : specifier === entry || specifier.startsWith(`${entry}/`),
  );
}
