import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Empty } from "./empty.tsx";

describe("Empty", () => {
  it("keeps the list's frame, says why it is empty and offers the way to fill it", () => {
    const { container } = render(
      <Empty text="No evidence yet." action={<button type="button">{"Add"}</button>} />,
    );
    expect(screen.getByText("No evidence yet.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add" })).toBeTruthy();
    expect(container.firstElementChild?.className).toContain("border-dashed");
  });
});
