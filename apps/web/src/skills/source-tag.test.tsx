import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderUi } from "../__fixtures__/render-ui.tsx";
import { SourceTag } from "./source-tag.tsx";

describe("SourceTag", () => {
  it("names each of the four sources in the design system's fixed words", async () => {
    renderUi(
      <>
        <SourceTag provenance="self-reported" />
        <SourceTag provenance="ai-judged" />
        <SourceTag provenance="demonstrated" />
        <SourceTag provenance="ai-correlated" />
      </>,
    );
    for (const word of ["Self-reported", "AI judgement", "Demonstrated", "AI correlated"]) {
      expect(await screen.findByText(word)).toBeTruthy();
    }
  });

  it("marks AI-made sources with the AI monogram and a dashed edge", async () => {
    renderUi(<SourceTag provenance="ai-judged" />);
    const tag = (await screen.findByText("AI judgement")).closest("span.inline-flex");
    expect(tag?.querySelector(".ai-mark")).toBeTruthy();
    expect(tag?.className).toContain("outline-dashed");
  });
});
