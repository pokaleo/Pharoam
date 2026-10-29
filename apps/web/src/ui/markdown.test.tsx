import { render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { describe, expect, it } from "vitest";
import { createI18n } from "../i18n.ts";
import { expectNoAxeViolations } from "../testing/axe.ts";
import { Markdown } from "./markdown.tsx";

function renderMarkdown(text: string) {
  return render(
    <I18nextProvider i18n={createI18n()}>
      <Markdown text={text} />
    </I18nextProvider>,
  );
}

describe("Markdown (hard rule 10)", () => {
  it("renders the person's Markdown", () => {
    renderMarkdown("## Payments\n\nI led **three** releases.\n\n- One\n- Two\n");
    screen.getByRole("heading", { name: "Payments" });
    expect(screen.getByText("three").tagName).toBe("STRONG");
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("shows HTML as the text it is, and never runs it (MVP S4.5)", () => {
    const { container } = renderMarkdown(
      'Before <script>alert(1)</script> <b onclick="x()">bold</b> after\n',
    );
    expect(container.querySelector("script, b, [onclick]")).toBeNull();
    expect(container.textContent).toContain("<script>alert(1)</script>");
    expect(container.textContent).toContain('<b onclick="x()">bold</b>');
  });

  it("shows a block of HTML as text too", () => {
    const { container } = renderMarkdown('<div class="x">\n<img src="https://example.com/a.png">\n</div>\n');
    expect(container.querySelector("div.x, img")).toBeNull();
    expect(container.textContent).toContain('<div class="x">');
  });

  it("keeps web links, opening them in a new tab without sending where they came from", () => {
    renderMarkdown("See [the repo](https://example.com/repo).\n");
    const link = screen.getByRole("link", { name: "the repo" });
    expect(link.getAttribute("href")).toBe("https://example.com/repo");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("drops the address of a link that would run script", () => {
    const { container } = renderMarkdown("[click](javascript:alert(1))\n");
    expect(container.querySelector('[href^="javascript"]')).toBeNull();
    screen.getByText("click");
  });

  it("blocks remote images, saying what was left out (security §2)", async () => {
    const { container } = renderMarkdown("![A diagram of the system](https://example.com/diagram.png)\n");
    expect(container.querySelector("img")).toBeNull();
    screen.getByText("Image not loaded: A diagram of the system");
    await expectNoAxeViolations(container);
  });
});
