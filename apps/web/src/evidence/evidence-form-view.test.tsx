import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useState, type ReactElement } from "react";
import { I18nextProvider } from "react-i18next";
import { describe, expect, it, vi } from "vitest";
import { createI18n } from "../i18n.ts";
import type { SkillChoice } from "../profile/skills.ts";
import { expectNoAxeViolations } from "../testing/axe.ts";
import { NO_ANSWERS, type EvidenceAnswers, type FieldErrors } from "./answers.ts";
import { EvidenceFormView } from "./evidence-form-view.tsx";

const SKILLS: readonly SkillChoice[] = [
  { slug: "sql", name: "SQL", aliases: [] },
  { slug: "ab-testing", name: "Experiment design and A/B testing", aliases: ["A/B testing"] },
];

// The form with its answers held in state, as the pages hold them, and what it last reported.
function Harness({ errors = {}, onSubmit }: { errors?: FieldErrors; onSubmit: () => void }): ReactElement {
  const [answers, setAnswers] = useState<EvidenceAnswers>(NO_ANSWERS);
  return (
    <I18nextProvider i18n={createI18n()}>
      <h1 id="title">{"Add evidence"}</h1>
      <EvidenceFormView
        labelledBy="title"
        answers={answers}
        onChange={setAnswers}
        errors={errors}
        skills={SKILLS}
        onSubmit={onSubmit}
      >
        <button type="submit">{"Continue"}</button>
      </EvidenceFormView>
      <output aria-label="Skills chosen">{answers.skills.join(",")}</output>
    </I18nextProvider>
  );
}

describe("EvidenceFormView (MVP S4.1, S4.6)", () => {
  it("asks the kind first, then shows the common fields plus the kind's own", async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness onSubmit={vi.fn()} />);

    screen.getByRole("radio", { name: "Project" });
    screen.getByLabelText(/Your role/);
    expect(screen.queryByLabelText(/Course code/)).toBeNull();

    await user.click(screen.getByRole("radio", { name: "Course or module" }));
    screen.getByLabelText(/Course code/);
    expect(screen.queryByLabelText(/Your role/)).toBeNull();
    await expectNoAxeViolations(container);
  });

  it("keeps every answer when the kind changes", async () => {
    const user = userEvent.setup();
    render(<Harness onSubmit={vi.fn()} />);

    await user.type(screen.getByLabelText("Title"), "Databases");
    await user.click(screen.getByRole("radio", { name: "Course or module" }));

    expect(screen.getByLabelText<HTMLInputElement>("Title").value).toBe("Databases");
  });

  it("picks skills by name or another name, stores them by slug, and removes them", async () => {
    const user = userEvent.setup();
    render(<Harness onSubmit={vi.fn()} />);

    await user.type(screen.getByLabelText("Find a skill"), "a/b testing");
    await user.click(screen.getByRole("button", { name: "Add skill" }));
    await user.type(screen.getByLabelText("Find a skill"), "SQL{Enter}");

    expect(screen.getByRole("status", { name: "Skills chosen" }).textContent).toBe("ab-testing,sql");
    await user.click(screen.getByRole("button", { name: "Remove SQL" }));
    expect(screen.getByRole("status", { name: "Skills chosen" }).textContent).toBe("ab-testing");
  });

  it("says when no skill has the name typed, adding nothing", async () => {
    const user = userEvent.setup();
    render(<Harness onSubmit={vi.fn()} />);

    await user.type(screen.getByLabelText("Find a skill"), "Cobol");
    await user.click(screen.getByRole("button", { name: "Add skill" }));

    screen.getByText("There's no skill called Cobol. Pick one from the list.");
    expect(screen.getByRole("status", { name: "Skills chosen" }).textContent).toBe("");
  });

  it("shows what to fix next to a field, and submits through the page", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Harness errors={{ title: "title" }} onSubmit={onSubmit} />);

    screen.getByText("Give it a title, such as the project's name or your job title.");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(onSubmit).toHaveBeenCalledOnce();
  });
});
