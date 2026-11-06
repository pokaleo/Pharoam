import { err } from "@pharoam/core";
import { createMemoryConnector } from "@pharoam/core/testing";
import { screen, within } from "@testing-library/react";
import { userEvent, type UserEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  EVIDENCE,
  EVIDENCE_ID,
  fullProfile,
  openProfile,
  PAYMENTS_API,
  PHAROAM,
  SQL,
} from "../__fixtures__/profiles.ts";
import { expectNoAxeViolations } from "../testing/axe.ts";

async function openPaymentsApi(user: UserEvent, memory = fullProfile()) {
  const rendered = await openProfile(user, memory, "Evidence");
  await user.click(await screen.findByRole("link", { name: "Payments API" }));
  await screen.findByRole("heading", { level: 1, name: "Payments API" });
  return { memory, ...rendered };
}

describe("EvidencePage", () => {
  it("shows links as links, skills by name, and what the person did as safe Markdown (MVP S4.5)", async () => {
    const user = userEvent.setup();
    const { container } = await openPaymentsApi(user);

    expect(screen.getByRole("link", { name: "https://example.com/payments" }).getAttribute("href")).toBe(
      "https://example.com/payments",
    );
    expect(screen.getByText("refunds").tagName).toBe("STRONG");
    screen.getByText("Python");
    screen.getByText(EVIDENCE);
    await expectNoAxeViolations(container);
  });

  it("asks before deleting, naming the levels that cite the evidence, then removes the file (MVP S5.2, S5.3)", async () => {
    const user = userEvent.setup();
    const { memory, container } = await openPaymentsApi(user);

    await user.click(screen.getByRole("button", { name: "Delete" }));

    const confirm = await screen.findByRole("alertdialog", { name: "Delete Payments API?" });
    within(confirm).getByText(/SQL/);
    expect(await memory.readOutside(EVIDENCE)).toBeDefined();
    await expectNoAxeViolations(container);

    await user.click(within(confirm).getByRole("button", { name: "Delete it" }));

    await screen.findByRole("heading", { level: 1, name: "Evidence" });
    screen.getByText("Payments API was deleted from your folder.");
    expect(await memory.readOutside(EVIDENCE)).toBeUndefined();
    // The level that cited it is never changed (hard rule 4).
    expect(await memory.readOutside(SQL)).toContain(`- ${EVIDENCE_ID}`);
  });

  it("keeps the evidence when the person changes their mind", async () => {
    const user = userEvent.setup();
    const { memory } = await openPaymentsApi(user);
    await user.click(screen.getByRole("button", { name: "Delete" }));

    await user.click(screen.getByRole("button", { name: "Keep it" }));

    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(await memory.readOutside(EVIDENCE)).toBeDefined();
  });
});

describe("files kept with evidence (MVP S14)", () => {
  const PDF = new Uint8Array(2048).fill(7);
  const WITH_FILES = PAYMENTS_API.replace(
    "source: manual",
    "attachments:\n  - certificate.pdf\n  - gone.pdf\nsource: manual",
  );

  async function withFiles(text = WITH_FILES) {
    const memory = createMemoryConnector({ "pharoam.md": PHAROAM, [EVIDENCE]: text });
    await memory.putAttachmentOutside(EVIDENCE_ID, "certificate.pdf", PDF);
    return memory;
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the files before deleting evidence, and keeps them unless the person says otherwise (S14.4)", async () => {
    const user = userEvent.setup();
    const memory = await withFiles();
    await openPaymentsApi(user, memory);
    await screen.findByRole("button", { name: "Download certificate.pdf" });

    await user.click(screen.getByRole("button", { name: "Delete" }));
    const confirm = await screen.findByRole("alertdialog", { name: "Delete Payments API?" });
    within(confirm).getByText("certificate.pdf");
    expect(
      within(confirm).getByRole("checkbox", { name: "Also delete its files from your folder" }),
    ).toHaveProperty("checked", false);
    await user.click(within(confirm).getByRole("button", { name: "Delete it" }));

    await screen.findByText("Payments API was deleted from your folder.");
    expect(await memory.readAttachmentOutside(EVIDENCE_ID, "certificate.pdf")).toBeDefined();
  });

  it("deletes the evidence's files too when the person asks, and nothing else (S14.4)", async () => {
    const user = userEvent.setup();
    const memory = await withFiles();
    await memory.putAttachmentOutside(EVIDENCE_ID, "mine.txt", new Uint8Array([1]));
    await openPaymentsApi(user, memory);
    await screen.findByRole("button", { name: "Download certificate.pdf" });

    await user.click(screen.getByRole("button", { name: "Delete" }));
    const confirm = await screen.findByRole("alertdialog", { name: "Delete Payments API?" });
    await user.click(
      within(confirm).getByRole("checkbox", { name: "Also delete its files from your folder" }),
    );
    await user.click(within(confirm).getByRole("button", { name: "Delete it" }));

    await screen.findByText("Payments API was deleted from your folder.");
    expect(await memory.readAttachmentOutside(EVIDENCE_ID, "certificate.pdf")).toBeUndefined();
    expect(await memory.readAttachmentOutside(EVIDENCE_ID, "mine.txt")).toBeDefined();
  });

  it("says which files were kept because they changed in the folder since they were shown (S14.4, AD10)", async () => {
    const user = userEvent.setup();
    const memory = await withFiles();
    await openPaymentsApi(user, memory);
    await screen.findByRole("button", { name: "Download certificate.pdf" });
    await user.click(screen.getByRole("button", { name: "Delete" }));
    const confirm = await screen.findByRole("alertdialog", { name: "Delete Payments API?" });
    await user.click(
      within(confirm).getByRole("checkbox", { name: "Also delete its files from your folder" }),
    );
    await memory.putAttachmentOutside(EVIDENCE_ID, "certificate.pdf", new Uint8Array([1]));

    await user.click(within(confirm).getByRole("button", { name: "Delete it" }));

    await screen.findByText(
      "Payments API was deleted from your folder. These files were kept, as they changed in your folder since they were shown or couldn't be deleted: certificate.pdf.",
    );
    expect(await memory.readAttachmentOutside(EVIDENCE_ID, "certificate.pdf")).toEqual(new Uint8Array([1]));
  });

  it("says when it couldn't list the evidence's files before deleting it, and keeps them (S14.4)", async () => {
    const user = userEvent.setup();
    const memory = await withFiles();
    const failing = {
      ...memory,
      connector: {
        ...memory.connector,
        attachments: () => Promise.resolve(err({ kind: "unavailable" as const, reason: "Gone." })),
      },
    };
    await openPaymentsApi(user, failing);
    await screen.findByText("Pharoam couldn't list this evidence's files.");

    await user.click(screen.getByRole("button", { name: "Delete" }));
    const confirm = await screen.findByRole("alertdialog", { name: "Delete Payments API?" });
    within(confirm).getByText("Pharoam couldn't list its files, so any it has will be kept.");
    await user.click(within(confirm).getByRole("button", { name: "Delete it" }));

    await screen.findByText("Payments API was deleted from your folder.");
    expect(await memory.readAttachmentOutside(EVIDENCE_ID, "certificate.pdf")).toBeDefined();
  });
});
