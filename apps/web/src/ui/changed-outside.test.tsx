import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderUi } from "../__fixtures__/render-ui.tsx";
import { ChangedOutsideNotice } from "./changed-outside.tsx";

describe("ChangedOutsideNotice (MVP S12.1)", () => {
  it("says nothing was overwritten and links to where both versions are compared", async () => {
    renderUi(
      <ChangedOutsideNotice
        title="pharoam.md was changed in your folder"
        text="Nothing has been overwritten."
      />,
    );

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("pharoam.md was changed in your folder");
    expect(alert.textContent).toContain("Nothing has been overwritten.");
    expect(screen.getByRole("link", { name: "Compare the two versions" }).getAttribute("href")).toBe(
      "/attention",
    );
  });
});
