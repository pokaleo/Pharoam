import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderUi } from "../__fixtures__/render-ui.tsx";
import { PathwayProvenance } from "./provenance.tsx";

const review = { by: "A reviewer", at: "2026-10-25" };

describe("PathwayProvenance (MVP S10.2, S10.3)", () => {
  it("says who reviewed the pathway and when", async () => {
    renderUi(<PathwayProvenance pathway={{ review, ai: null }} />);
    await screen.findByText("Reviewed by A reviewer on 25 Oct 2026.");
    expect(screen.queryByText("Drafted with AI")).toBeNull();
  });

  it("names the model when AI drafted it, with the AI monogram", async () => {
    renderUi(
      <PathwayProvenance
        pathway={{
          review,
          ai: { task: "draft-pathway@1", model: "anthropic/claude-opus-5-5", at: "2026-10-24T10:00:00Z" },
        }}
      />,
    );
    const tag = (await screen.findByText("Drafted with AI")).closest("span.inline-flex");
    expect(tag?.querySelector(".ai-mark")).toBeTruthy();
    screen.getByText(/Drafted with AI \(anthropic\/claude-opus-5-5\), then reviewed by A reviewer/);
  });
});
