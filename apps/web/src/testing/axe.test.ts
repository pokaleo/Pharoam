import { describe, expect, it } from "vitest";
import { expectNoAxeViolations } from "./axe.ts";

function fragment(html: string): HTMLElement {
  const element = document.createElement("div");
  // Built from DOM calls, not HTML strings, as the app's own rules require (hard rule 10).
  element.append(document.createRange().createContextualFragment(html));
  document.body.append(element);
  return element;
}

describe("expectNoAxeViolations", () => {
  it("passes accessible markup", async () => {
    await expectNoAxeViolations(fragment("<main><h1>Title</h1><button>Go</button></main>"));
  });

  it("fails markup that breaks a WCAG rule, naming the rule", async () => {
    await expect(expectNoAxeViolations(fragment("<main><button></button></main>"))).rejects.toThrow(
      /button-name/,
    );
  });
});
