import { createMemoryConnector, type MemoryConnector } from "@pharoam/core/testing";
import { act, render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { describe, expect, it, vi } from "vitest";
import { NO_PLACES } from "../__fixtures__/render-ui.tsx";
import { PHAROAM } from "../__fixtures__/profiles.ts";
import { loadContentPack } from "../content.ts";
import { createI18n } from "../i18n.ts";
import { SessionProvider, useSession, type SessionControls } from "./session.tsx";

// Renders the provider and hands back its controls, as the latest render saw them.
function renderSession(places = NO_PLACES): () => SessionControls {
  let latest: SessionControls | undefined;
  function Probe() {
    latest = useSession();
    return <p>{latest.session.status}</p>;
  }
  render(
    <I18nextProvider i18n={createI18n()}>
      <SessionProvider services={{ places, content: loadContentPack }}>
        <Probe />
      </SessionProvider>
    </I18nextProvider>,
  );
  return () => {
    if (latest === undefined) throw new Error("not rendered");
    return latest;
  };
}

async function connect(controls: () => SessionControls, memory: MemoryConnector) {
  let result: Awaited<ReturnType<SessionControls["connect"]>> | undefined;
  await act(async () => {
    result = await controls().connect({ name: "my-profile", storage: memory.connector });
  });
  return result;
}

describe("SessionProvider", () => {
  it("starts closed", () => {
    renderSession();
    screen.getByText("closed");
  });

  it("opens a folder with a profile, reading it and writing nothing (MVP S2.1)", async () => {
    const memory = createMemoryConnector({ "pharoam.md": PHAROAM });
    const controls = renderSession();

    expect(await connect(controls, memory)).toEqual({ ok: true, value: undefined });

    screen.getByText("open");
    const session = controls().session;
    expect(session.status === "open" && session.place).toBe("my-profile");
    expect(memory.writes()).toBe(0);
  });

  it("offers to create a profile in a folder without one (MVP S2.3)", async () => {
    const controls = renderSession();
    await connect(controls, createMemoryConnector());
    screen.getByText("no-profile");

    const session = controls().session;
    if (session.status !== "no-profile") throw new Error(session.status);
    await act(async () => {
      await session.service.createProfile({});
      controls().profileCreated();
    });
    screen.getByText("open");
  });

  it("never offers to replace a pharoam.md it can't read (hard rule 3)", async () => {
    const controls = renderSession();
    await connect(controls, createMemoryConnector({ "pharoam.md": "---\nschema: [broken\n---\n" }));
    screen.getByText("unreadable-profile");
  });

  it("reports a folder that can't be read, staying closed", async () => {
    const memory = createMemoryConnector({ "pharoam.md": PHAROAM });
    memory.loseAccess();
    const controls = renderSession();

    const result = await connect(controls, memory);

    expect(result?.ok).toBe(false);
    screen.getByText("closed");
  });

  it("forgets the folder and everything read on disconnecting (MVP S2.4)", async () => {
    const forget = vi.fn(() => Promise.resolve());
    const controls = renderSession({ ...NO_PLACES, forget });
    await connect(controls, createMemoryConnector({ "pharoam.md": PHAROAM }));
    const session = controls().session;
    if (session.status !== "open") throw new Error(session.status);

    await act(async () => {
      await controls().disconnect();
    });

    screen.getByText("closed");
    expect(forget).toHaveBeenCalledOnce();
    expect(session.service.records()).toEqual([]);
  });

  it("re-renders the screens after a save", async () => {
    const controls = renderSession();
    await connect(controls, createMemoryConnector({ "pharoam.md": PHAROAM }));
    const before = controls().session;

    act(() => {
      controls().changed();
    });

    const after = controls().session;
    expect(before.status === "open" && after.status === "open" && after.revision).toBe(1);
  });
});

describe("useSession", () => {
  it("is a bug outside SessionProvider", () => {
    function Outside() {
      useSession();
      return null;
    }
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => render(<Outside />)).toThrow("useSession must be called inside SessionProvider");
  });
});
