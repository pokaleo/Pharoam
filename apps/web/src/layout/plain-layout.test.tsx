import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderUi } from "../__fixtures__/render-ui.tsx";
import { expectNoAxeViolations } from "../testing/axe.ts";
import { PlainLayout } from "./plain-layout.tsx";

describe("PlainLayout", () => {
  it("puts the brand above the page, named in words so the logo never stands alone", async () => {
    const { container } = renderUi(
      <PlainLayout>
        <h1>{"Page"}</h1>
      </PlainLayout>,
    );

    const home = await screen.findByRole("link", { name: "Pharoam home" });
    expect(home.getAttribute("href")).toBe("/");
    // The wordmark is decoration: the link carries the name.
    expect(home.querySelector("img")?.getAttribute("alt")).toBe("");
    expect(screen.getByRole("main").textContent).toBe("Page");
    await expectNoAxeViolations(container);
  });
});
