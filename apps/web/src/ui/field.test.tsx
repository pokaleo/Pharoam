import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { expectNoAxeViolations } from "../testing/axe.ts";
import { SelectField, TextAreaField, TextField } from "./field.tsx";

// The text of the elements that describe a field.
function description(field: HTMLElement): string {
  const ids = (field.getAttribute("aria-describedby") ?? "").split(" ").filter((id) => id !== "");
  return ids.map((id) => document.getElementById(id)?.textContent ?? "").join(" | ");
}

describe("TextField", () => {
  it("is labelled, with its hint read with it", async () => {
    const { container } = render(<TextField label="Title" hint="What it was." />);
    const field = screen.getByLabelText("Title");
    expect(description(field)).toBe("What it was.");
    expect(field.getAttribute("aria-invalid")).toBeNull();
    await expectNoAxeViolations(container);
  });

  it("marks a field to fix and reads what to fix with it, next to the field (MVP S4.4)", async () => {
    const { container } = render(<TextField label="Title" hint="What it was." error="Give it a title." />);
    const field = screen.getByLabelText("Title");
    expect(field.getAttribute("aria-invalid")).toBe("true");
    expect(description(field)).toBe("What it was. | Give it a title.");
    await expectNoAxeViolations(container);
  });

  it("has no description when there is neither hint nor error", () => {
    render(<TextField label="Title" />);
    expect(screen.getByLabelText("Title").getAttribute("aria-describedby")).toBeNull();
  });
});

describe("TextAreaField", () => {
  it("is a labelled text area of several lines", () => {
    render(<TextAreaField label="What you did" error="Check this answer." />);
    const field = screen.getByLabelText("What you did");
    expect(field.tagName).toBe("TEXTAREA");
    expect(description(field)).toBe("Check this answer.");
  });
});

describe("SelectField", () => {
  it("is a labelled choice of the options given, in order", () => {
    render(
      <SelectField
        label="Domain"
        options={[
          { value: "", label: "All domains" },
          { value: "data", label: "Data" },
        ]}
      />,
    );
    const select = screen.getByLabelText<HTMLSelectElement>("Domain");
    expect([...select.options].map((option) => option.textContent)).toEqual(["All domains", "Data"]);
  });
});
