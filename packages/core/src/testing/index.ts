/**
 * Test support: the shared connector checks, the in-memory reference connector, and a fake model provider.
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
export { fakeProvider, type FakeProvider } from "./fake-provider.ts";
