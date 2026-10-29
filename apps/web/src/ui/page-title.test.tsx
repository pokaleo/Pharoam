import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageTitle } from "./page-title.tsx";

describe("PageTitle", () => {
  it("is the page's one top heading, with its lead below", () => {
    render(<PageTitle title="Skills" lead="Every level says where it came from." titleId="title" />);
    const heading = screen.getByRole("heading", { level: 1, name: "Skills" });
    expect(heading.id).toBe("title");
    expect(heading.nextElementSibling?.textContent).toBe("Every level says where it came from.");
  });
});
