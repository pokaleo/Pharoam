import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button, buttonClassName } from "./button.tsx";

describe("Button", () => {
  it("is a plain button unless told otherwise, so it never submits a form by accident", () => {
    render(<Button>{"Save"}</Button>);
    expect(screen.getByRole("button", { name: "Save" }).getAttribute("type")).toBe("button");
  });

  it("submits a form when it is the form's submit button", () => {
    render(<Button type="submit">{"Save"}</Button>);
    expect(screen.getByRole("button", { name: "Save" }).getAttribute("type")).toBe("submit");
  });

  it("does what it is given when clicked", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>{"Go"}</Button>);
    await userEvent.setup().click(screen.getByRole("button", { name: "Go" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("styles the one main action with the primary fill, and others plainly", () => {
    render(
      <>
        <Button variant="primary">{"Main"}</Button>
        <Button>{"Other"}</Button>
      </>,
    );
    expect(screen.getByRole("button", { name: "Main" }).className).toContain("bg-primary");
    expect(screen.getByRole("button", { name: "Other" }).className).toContain("bg-surface");
  });
});

describe("buttonClassName", () => {
  it("gives links the same look as buttons, for each variant", () => {
    expect(buttonClassName("primary")).toContain("bg-primary");
    expect(buttonClassName("secondary")).toContain("border-line-strong");
    expect(buttonClassName("quiet")).toContain("bg-transparent");
  });
});
