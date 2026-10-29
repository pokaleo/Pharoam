import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, it } from "vitest";
import { fullProfile, openProfile } from "../__fixtures__/profiles.ts";
import { renderApp } from "../__fixtures__/render-app.tsx";

describe("ProfileRoute", () => {
  it("goes to the start page when no profile is open, since nothing is kept between visits", async () => {
    renderApp({ name: "my-profile", memory: fullProfile() }, "/skills");

    await screen.findByRole("heading", { level: 1, name: "Your skills, in files you own" });
  });

  it("shows the page in the app shell once a profile is open", async () => {
    const user = userEvent.setup();
    await openProfile(user, fullProfile(), "About you");

    await screen.findByRole("heading", { level: 1, name: "About you" });
    screen.getByRole("navigation", { name: "Main" });
  });
});
