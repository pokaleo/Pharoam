import { createMemoryConnector } from "@pharoam/core/testing";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderApp } from "./__fixtures__/render-app.tsx";

const render = () => renderApp({ name: "my-profile", memory: createMemoryConnector() });

// Testing Library's queries throw when nothing matches, so finding an element is the assertion.
describe("App", () => {
  it("names the page's language, for screen readers and translation (PRD N9)", async () => {
    render();

    await screen.findByRole("heading", { level: 1 });
    expect(document.documentElement.lang).toBe("en");
    expect(document.documentElement.dir).toBe("ltr");
  });

  it("takes the page title from the translations, like all interface text (hard rule 12)", async () => {
    document.title = "";
    render();

    await screen.findByRole("heading", { level: 1 });
    expect(document.title).toBe("Pharoam");
  });

  it("shows the Pharoam home link with a text name, so the logo never stands alone", async () => {
    render();

    await screen.findByRole("link", { name: "Pharoam home" });
  });
});
