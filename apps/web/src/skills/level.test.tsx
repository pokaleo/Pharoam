import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Level } from "./level.tsx";

describe("Level", () => {
  it("names the level in words, with a stair glyph that screen readers skip", () => {
    const { container } = render(<Level level={2} name="Working" />);
    expect(screen.getByText("Working")).toBeTruthy();
    expect(container.querySelector("[aria-hidden='true']")?.children).toHaveLength(5);
  });

  it("lights only the step the level stands on, so the glyph says where, never how full", () => {
    const { container } = render(<Level level={3} name="Proficient" />);
    const steps = [...(container.querySelector("[aria-hidden='true']")?.children ?? [])];
    expect(steps.map((step) => step.getAttribute("data-on"))).toEqual([null, null, null, "", null]);
    expect(container.firstElementChild?.getAttribute("data-level")).toBe("3");
  });

  it("takes the channel only when a diagnostic tested it; claims stay in ink", () => {
    render(
      <>
        <Level level={2} name="Tested" source="demonstrated" />
        <Level level={2} name="Claimed" source="self-reported" />
      </>,
    );
    expect(screen.getByText("Tested").className).toContain("text-src-demo");
    expect(screen.getByText("Claimed").className).not.toContain("text-src-demo");
  });

  it("can follow its name with the number, and be struck through when it no longer counts", () => {
    const { container } = render(<Level level={1} name="Beginner" number struck />);
    expect(screen.getByText("1")).toBeTruthy();
    expect(container.firstElementChild?.className).toContain("line-through");
  });
});
