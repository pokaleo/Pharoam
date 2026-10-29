import { createMemoryConnector } from "@pharoam/core/testing";
import { screen } from "@testing-library/react";
import { describe, it } from "vitest";
import { renderApp } from "../__fixtures__/render-app.tsx";
import { expectNoAxeViolations } from "../testing/axe.ts";

describe("UnsupportedPage (MVP §3)", () => {
  it("tells people in a browser that can keep no files which browsers work", async () => {
    const { container } = renderApp({
      name: "my-profile",
      memory: createMemoryConnector(),
      supported: false,
    });

    await screen.findByRole("heading", { level: 1, name: "This browser isn't supported yet" });
    screen.getByText(/a recent version of Safari, Firefox, Chrome, Edge, Brave or Arc/);
    await expectNoAxeViolations(container);
  });

  it("shows at every address, not just the start", async () => {
    renderApp({ name: "my-profile", memory: createMemoryConnector(), supported: false }, "/skills");

    await screen.findByRole("heading", { level: 1, name: "This browser isn't supported yet" });
  });
});
