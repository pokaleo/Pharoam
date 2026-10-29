/**
 * Accessibility checks for the web app's tests.
 *
 * @packageDocumentation
 */
import axe from "axe-core";

/**
 * Runs axe's WCAG 2.2 AA rules on rendered markup and fails with each broken rule.
 *
 * @remarks Every screen must pass (MVP §5 quality bar, ADR-0015). The test DOM has no layout, so rules that need it,
 * such as colour contrast, can't run here; the end-to-end tests in a real browser cover them.
 * @param element - The rendered markup to check.
 * @throws When axe finds a violation, with the rule's ID, its help text and the elements that break it.
 */
export async function expectNoAxeViolations(element: Element): Promise<void> {
  const results = await axe.run(element, {
    runOnly: {
      type: "tag",
      values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"],
    },
    rules: { "color-contrast": { enabled: false } },
  });
  if (results.violations.length > 0) {
    const found = results.violations.map(
      (violation) =>
        `${violation.id}: ${violation.help}\n${violation.nodes.map((node) => `  ${node.html}`).join("\n")}`,
    );
    throw new Error(`Accessibility violations:\n${found.join("\n")}`);
  }
}
