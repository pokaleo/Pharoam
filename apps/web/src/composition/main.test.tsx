import "fake-indexeddb/auto";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("main (the composition root)", () => {
  it("starts the app in the page's root element, with the brand's icon", async () => {
    document.body.replaceChildren();
    document.head.append(Object.assign(document.createElement("link"), { rel: "icon" }));
    const root = Object.assign(document.createElement("div"), { id: "root" });
    document.body.append(root);

    await import("./main.tsx");

    // jsdom has no folder picker, so the app says the browser isn't supported, as Firefox or Safari would.
    await screen.findByRole("heading", { level: 1, name: "This browser isn't supported yet" });
    expect(document.querySelector('link[rel="icon"]')?.getAttribute("href")).toMatch(/favicon\.svg$/);
  });
});
