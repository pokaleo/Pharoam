import { createMemoryConnector } from "@pharoam/core/testing";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderApp } from "../__fixtures__/render-app.tsx";
import { expectNoAxeViolations } from "../testing/axe.ts";

describe("NotFoundPage", () => {
  it("explains an unknown address in the person's language, with a way back", async () => {
    const { container } = renderApp({ name: "my-profile", memory: createMemoryConnector() }, "/no-such-page");

    await screen.findByRole("heading", { level: 1, name: "There's nothing at this address" });
    expect(screen.getByRole("link", { name: "Go to the start page" }).getAttribute("href")).toBe("/");
    await expectNoAxeViolations(container);
  });
});
