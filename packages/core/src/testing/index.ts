/**
 * Test support for storage connectors: the shared connector checks and the in-memory reference connector.
 *
 * @remarks Imported as `@pharoam/core/testing`, apart from the core itself, so it is never part of the app. Every
 * connector's tests run {@link CONNECTOR_CHECKS} against it (ENGINEERING §4):
 *
 * ```ts
 * it.each(CONNECTOR_CHECKS)("$name", (check) => check.run(() => folderHarness()));
 * ```
 * @packageDocumentation
 */
export { CONNECTOR_CHECKS, type ConnectorCheck } from "./connector-checks.ts";
export { createMemoryConnector, type ConnectorHarness, type MemoryConnector } from "./memory-connector.ts";
