import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { expectNoAxeViolations } from "../testing/axe.ts";
import { Notice } from "./notice.tsx";

describe("Notice", () => {
  it("is announced as an alert, with its title and what to do next", async () => {
    const { container } = render(
      <Notice tone="attention" title="Nothing was overwritten">
        {"Choose which version to keep."}
      </Notice>,
    );
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toBe("Nothing was overwritten" + "Choose which version to keep.");
    await expectNoAxeViolations(container);
  });

  it("tints by tone: attention for something to look at, problem for something that went wrong", () => {
    render(
      <>
        <Notice tone="attention" title="Look" />
        <Notice tone="problem" title="Wrong" />
      </>,
    );
    const [attention, problem] = screen.getAllByRole("alert");
    expect(attention?.className).toContain("bg-notice-wash");
    expect(problem?.className).toContain("bg-problem-wash");
  });
});
