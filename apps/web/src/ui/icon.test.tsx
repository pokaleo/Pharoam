import { render } from "@testing-library/react";
import { Folder } from "lucide-react";
import { describe, expect, it } from "vitest";
import { Icon } from "./icon.tsx";

describe("Icon", () => {
  it("is hidden from screen readers, since the words beside it say what it means", () => {
    const { container } = render(<Icon of={Folder} />);
    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("draws Lucide's outline at the design system's stroke, at the density's icon size unless made smaller", () => {
    const { container } = render(
      <>
        <Icon of={Folder} />
        <Icon of={Folder} size="sm" />
      </>,
    );
    const [normal, small] = container.querySelectorAll("svg");
    expect(normal?.getAttribute("stroke-width")).toBe("1.75");
    expect(normal?.getAttribute("class")).toContain("size-(--icon)");
    expect(small?.getAttribute("class")).toContain("size-3.5");
  });
});
