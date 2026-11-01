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

  it("puts the page's actions beside the title, and the way back above it", () => {
    render(
      <PageTitle
        title="Python"
        lead="Programming languages"
        crumbs={[
          <a key="skills" href="#/skills">
            {"Skills"}
          </a>,
        ]}
        crumbsLabel="Breadcrumb"
        actions={<button type="button">{"Record a level"}</button>}
      />,
    );
    const crumbs = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(crumbs.textContent).toContain("Skills");
    expect(crumbs.textContent).toContain("Python");
    expect(screen.getByRole("button", { name: "Record a level" })).toBeTruthy();
  });
});
