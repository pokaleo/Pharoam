import { err, ok, type ProviderError } from "@pharoam/core";
import { fakeProvider } from "@pharoam/core/testing";
import { screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { emptyProfile, openProfile } from "../__fixtures__/profiles.ts";
import type { LoadProvider, ProviderChoice } from "../ai/providers.ts";
import { expectNoAxeViolations } from "../testing/axe.ts";

interface FakeModels {
  readonly models?: readonly { readonly id: string; readonly name: string }[] | ProviderError;
  readonly answer?: unknown;
  readonly failure?: ProviderError;
}

// A provider loader that answers as the test decides, and keeps every choice it was asked to load.
function providers(fake: FakeModels = {}): { load: LoadProvider; loaded: ProviderChoice[] } {
  const loaded: ProviderChoice[] = [];
  const load: LoadProvider = (choice) => {
    loaded.push(choice);
    const provider = fakeProvider(() =>
      fake.failure === undefined ? ok(fake.answer ?? { ready: true }) : err(fake.failure),
    );
    const models = fake.models ?? [];
    return Promise.resolve({
      ...provider,
      listModels: () => Promise.resolve("kind" in models ? err(models) : ok(models)),
    });
  };
  return { load, loaded };
}

const CLAUDE = [
  { id: "claude-a", name: "Claude A" },
  { id: "claude-b", name: "Claude B" },
];

describe("SettingsPage (MVP S13)", () => {
  it("sets up a model from the provider's own list, with the key kept in memory only (S13.2, S13.4, S13.7)", async () => {
    const user = userEvent.setup();
    const memory = emptyProfile();
    const fake = providers({ models: CLAUDE });
    const { container } = await openProfile(user, memory, "Settings", fake.load);

    await screen.findByRole("heading", { level: 1, name: "Settings" });
    screen.getByText(/No model is set up/);
    await user.click(screen.getByRole("radio", { name: "Anthropic" }));
    const terms = screen.getByText(/What you send goes to Anthropic, under its own terms/);
    expect(
      within(terms.closest("div") ?? terms)
        .getByRole("link")
        .getAttribute("href"),
    ).toBe("https://www.anthropic.com/legal/privacy");
    await user.type(screen.getByLabelText("API key"), "sk-ant-secret");
    await user.click(screen.getByRole("button", { name: "Show models" }));
    await user.selectOptions(await screen.findByRole("combobox", { name: "Model" }), "claude-b");
    await user.click(screen.getByRole("button", { name: "Use this model" }));

    await screen.findByText("Using Claude B (claude-b) from Anthropic.");
    expect(fake.loaded).toEqual([
      { kind: "anthropic", address: "https://api.anthropic.com", apiKey: "sk-ant-secret" },
    ]);
    expect(container.textContent).not.toContain("sk-ant-secret");
    expect(memory.writes()).toBe(0);
    expect(localStorage.length + sessionStorage.length).toBe(0);
    await expectNoAxeViolations(container);
  });

  it("lets the person type a model ID when the provider can't list its models (S13.2)", async () => {
    const user = userEvent.setup();
    await openProfile(user, emptyProfile(), "Settings", providers({ models: { kind: "unreachable" } }).load);

    await user.click(screen.getByRole("radio", { name: "OpenRouter" }));
    await user.type(screen.getByLabelText("API key"), "sk-or");
    await user.click(screen.getByRole("button", { name: "Show models" }));
    await screen.findByText(/couldn't reach OpenRouter/);
    await user.type(screen.getByLabelText("Or type a model ID"), "some/model");
    await user.click(screen.getByRole("button", { name: "Use this model" }));

    await screen.findByText("Using some/model from OpenRouter.");
  });

  it.each([
    [{ answer: { ready: true } }, "It works: the model answered in the shape Pharoam needs."],
    [{ failure: { kind: "unauthorised" } as const }, "Anthropic refused the key. Check it and try again."],
    [{ answer: "Sure, I'm ready!" }, /answered, but not in the shape Pharoam needs/],
  ])("tests the model with a call that sends nothing of the person's (S13.3)", async (fake, expected) => {
    const user = userEvent.setup();
    await openProfile(user, emptyProfile(), "Settings", providers({ ...fake, models: CLAUDE }).load);
    await user.click(screen.getByRole("radio", { name: "Anthropic" }));
    await user.type(screen.getByLabelText("API key"), "k");
    await user.click(screen.getByRole("button", { name: "Show models" }));
    await user.selectOptions(await screen.findByRole("combobox", { name: "Model" }), "claude-a");
    await user.click(screen.getByRole("button", { name: "Use this model" }));

    await user.click(await screen.findByRole("button", { name: "Test the model" }));

    await screen.findByText(expected);
  });

  it("refuses a local server address that isn't on this machine, without calling it (S13.5)", async () => {
    const user = userEvent.setup();
    const fake = providers();
    await openProfile(user, emptyProfile(), "Settings", fake.load);

    await user.click(screen.getByRole("radio", { name: /local server/ }));
    const address = screen.getByLabelText("Address");
    await user.clear(address);
    await user.type(address, "http://192.168.1.20:11434/v1");
    await user.click(screen.getByRole("button", { name: "Show models" }));

    await screen.findByText(/can only reach a local server on this machine/);
    expect(fake.loaded).toEqual([]);
  });

  it("explains the two steps a local server needs, and that Safari can't reach one (S13.6)", async () => {
    const user = userEvent.setup();
    await openProfile(user, emptyProfile(), "Settings", providers().load);

    await user.click(screen.getByRole("radio", { name: /local server/ }));

    screen.getByText(/OLLAMA_ORIGINS/);
    screen.getByText(/Enable CORS/);
    screen.getByText(/Safari/);
    screen.getByText("What you send stays on this machine.");
  });

  it("removes the model, forgetting its key (S13.8)", async () => {
    const user = userEvent.setup();
    await openProfile(user, emptyProfile(), "Settings", providers({ models: CLAUDE }).load);
    await user.click(screen.getByRole("radio", { name: "Anthropic" }));
    await user.type(screen.getByLabelText("API key"), "k");
    await user.click(screen.getByRole("button", { name: "Show models" }));
    await user.selectOptions(await screen.findByRole("combobox", { name: "Model" }), "claude-a");
    await user.click(screen.getByRole("button", { name: "Use this model" }));

    await user.click(await screen.findByRole("button", { name: "Remove the model" }));

    await screen.findByText(/No model is set up/);
  });
});
