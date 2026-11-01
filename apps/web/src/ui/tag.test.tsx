import { render, screen } from "@testing-library/react";
import { UserRound } from "lucide-react";
import { describe, expect, it } from "vitest";
import { Tag } from "./tag.tsx";

describe("Tag", () => {
  it("shows its word, with an icon beside it that screen readers skip", () => {
    const { container } = render(<Tag icon={UserRound}>{"Self-reported"}</Tag>);
    expect(screen.getByText("Self-reported")).toBeTruthy();
    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("takes the colours of its vocabulary item, neutral unless told otherwise", () => {
    render(
      <>
        <Tag>{"Plain"}</Tag>
        <Tag tone="demonstrated">{"Demonstrated"}</Tag>
        <Tag tone="ai-judged">{"AI judgement"}</Tag>
        <Tag tone="attention">{"Needs attention"}</Tag>
      </>,
    );
    expect(screen.getByText("Plain").className).toContain("bg-panel");
    expect(screen.getByText("Demonstrated").className).toContain("bg-src-demo-wash");
    expect(screen.getByText("AI judgement").className).toContain("outline-dashed");
    expect(screen.getByText("Needs attention").className).toContain("bg-notice-wash");
  });
});
