import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Timeline, TimelineEntry } from "./timeline.tsx";

describe("TimelineEntry", () => {
  it("lists the entry with its date, after a dot screen readers skip", () => {
    const { container } = render(
      <Timeline label="Skill history">
        <TimelineEntry dot="demonstrated" when="14 Sep 2026">
          {"Working"}
        </TimelineEntry>
      </Timeline>,
    );
    const entry = screen.getByRole("listitem");
    expect(entry.textContent).toBe("14 Sep 2026Working");
    expect(screen.getByRole("list", { name: "Skill history" })).toBeTruthy();
    expect(container.querySelector("[aria-hidden='true']")?.className).toContain("bg-src-demo");
  });

  it("draws an entry that no longer counts as a hollow dot", () => {
    const { container } = render(
      <Timeline label="Skill history">
        <TimelineEntry dot="retracted" when="20 Jun 2026">
          {"Retracted"}
        </TimelineEntry>
      </Timeline>,
    );
    expect(container.querySelector("[aria-hidden='true']")?.className).toContain("bg-ground");
  });
});
