/**
 * Setup for the web app's tests: each test starts from an empty page.
 *
 * @packageDocumentation
 */
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});
