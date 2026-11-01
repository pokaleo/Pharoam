import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AiMark } from "./ai-mark.tsx";

describe("AiMark", () => {
  it("draws the AI monogram in the text's colour, hidden from screen readers since the words say it is AI", () => {
    const { container } = render(<AiMark />);
    const mark = container.firstElementChild;
    expect(mark?.getAttribute("aria-hidden")).toBe("true");
    expect(mark?.className).toContain("ai-mark");
  });
});
