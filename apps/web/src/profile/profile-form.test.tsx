import type { ProfileFields } from "@pharoam/core";
import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderUi } from "../__fixtures__/render-ui.tsx";
import { ProfileForm } from "./profile-form.tsx";

function renderForm(initial?: ProfileFields) {
  const onSubmit = vi.fn<(fields: ProfileFields) => void>();
  renderUi(
    <>
      <h1 id="title">{"About you"}</h1>
      <ProfileForm labelledBy="title" onSubmit={onSubmit} {...(initial === undefined ? {} : { initial })}>
        <button type="submit">{"Save"}</button>
      </ProfileForm>
    </>,
  );
  return onSubmit;
}

describe("ProfileForm (MVP S1.2, S3.1)", () => {
  it("starts from the profile's current fields", async () => {
    renderForm({
      headline: "Backend developer",
      situation: { stage: "working", field: "Fintech" },
      region: "GB",
      focus: { pathways: ["backend-engineer"] },
    });

    expect((await screen.findByLabelText<HTMLInputElement>("Headline")).value).toBe("Backend developer");
    expect(screen.getByLabelText<HTMLSelectElement>("What are you doing now?").value).toBe("working");
    expect(screen.getByLabelText<HTMLInputElement>(/In which field/).value).toBe("Fintech");
    expect(screen.getByLabelText<HTMLSelectElement>(/Country/).value).toBe("GB");
    expect(
      (await screen.findByRole<HTMLInputElement>("checkbox", { name: "Backend engineer" })).checked,
    ).toBe(true);
  });

  it("asks for the field of work only once there is a stage", async () => {
    const user = userEvent.setup();
    renderForm();

    const field = await screen.findByLabelText<HTMLInputElement>(/In which field/);
    expect(field.disabled).toBe(true);
    await user.selectOptions(screen.getByLabelText("What are you doing now?"), "Studying");
    expect(field.disabled).toBe(false);
  });

  it("hands the answers to the page as profile fields", async () => {
    const user = userEvent.setup();
    const onSubmit = renderForm();

    await user.type(await screen.findByLabelText("Headline"), "Career changer");
    await user.click(await screen.findByRole("checkbox", { name: "Frontend engineer" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(onSubmit).toHaveBeenCalledWith({
      headline: "Career changer",
      focus: { pathways: ["frontend-engineer"] },
    });
  });
});
