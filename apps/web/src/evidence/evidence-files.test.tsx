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
} from "../__fixtures__/profiles.ts";
import { expectNoAxeViolations } from "../testing/axe.ts";

async function openPaymentsApi(user: UserEvent, memory = fullProfile()) {
  const rendered = await openProfile(user, memory, "Evidence");
  await user.click(await screen.findByRole("link", { name: "Payments API" }));
  await screen.findByRole("heading", { level: 1, name: "Payments API" });
  return { memory, ...rendered };
}

// The list item holding a file's name.
function row(list: HTMLElement, name: string): HTMLElement {
  const item = within(list).getByText(name).closest("li");
  if (item === null) throw new Error(`No row for ${name}.`);
  return item;
}

describe("EvidenceFiles: files kept with evidence (MVP S14)", () => {
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

  it("lists the evidence's files with their sizes, and one not in the folder as missing (S14.1)", async () => {
    const user = userEvent.setup();
    const { container } = await openPaymentsApi(user, await withFiles());

    const files = await screen.findByRole("list", { name: "Files" });
    const certificate = row(files, "certificate.pdf");
    within(certificate).getByText("2 kB");
    const gone = row(files, "gone.pdf");
    within(gone).getByText("Not in your folder");
    expect(within(gone).queryByRole("button", { name: "Download gone.pdf" })).toBeNull();
    await expectNoAxeViolations(container);
  });

  it("attaches a file the person picks, under its own name, and lists it (S14.1)", async () => {
    const user = userEvent.setup();
    const { memory } = await openPaymentsApi(user);
    await screen.findByText("No files yet.", { exact: false });

    await user.upload(screen.getByLabelText("Attach a file"), new File([PDF], "CV 2026.pdf"));

    await screen.findByText("CV 2026.pdf was attached.");
    within(screen.getByRole("list", { name: "Files" })).getByText("CV 2026.pdf");
    expect([...((await memory.readAttachmentOutside(EVIDENCE_ID, "CV 2026.pdf")) ?? [])]).toEqual([...PDF]);
    expect(await memory.readOutside(EVIDENCE)).toContain("attachments:\n  - CV 2026.pdf\n");
  });

  it("refuses a file over 10 MB with a plain explanation, changing nothing (S14.3)", async () => {
    const user = userEvent.setup();
    const { memory } = await openPaymentsApi(user);

    await user.upload(
      screen.getByLabelText("Attach a file"),
      new File([new Uint8Array(10 * 1024 * 1024 + 1)], "big.zip"),
    );

    await screen.findByText("big.zip is over 10 MB, so it wasn't attached.");
    expect(await memory.readOutside(EVIDENCE)).toBe(PAYMENTS_API);
    expect(await memory.connector.attachments(EVIDENCE_ID)).toEqual({ ok: true, value: [] });
  });

  it("downloads a file, and never shows it inside the page (S14.2, hard rule 10)", async () => {
    const user = userEvent.setup();
    const blobs: Blob[] = [];
    URL.createObjectURL = vi.fn((blob: Blob) => {
      blobs.push(blob);
      return "blob:file";
    });
    URL.revokeObjectURL = vi.fn();
    const clicked: HTMLAnchorElement[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push(this);
    });
    const { container } = await openPaymentsApi(user, await withFiles());

    await user.click(await screen.findByRole("button", { name: "Download certificate.pdf" }));

    await vi.waitFor(() => {
      expect(clicked.map((link) => link.download)).toEqual(["certificate.pdf"]);
    });
    const [blob] = blobs;
    if (blob === undefined) throw new Error("Nothing was downloaded.");
    expect(blob.type).toBe("application/octet-stream");
    expect([...new Uint8Array(await blob.arrayBuffer())]).toEqual([...PDF]);
    expect(container.querySelector("iframe, embed, object, img[src^='blob:']")).toBeNull();
  });

  it("deletes a file from the folder after asking, and takes it off the list", async () => {
    const user = userEvent.setup();
    const memory = await withFiles();
    await openPaymentsApi(user, memory);

    await user.click(await screen.findByRole("button", { name: "Remove certificate.pdf" }));
    const ask = screen.getByRole("group", { name: "Delete certificate.pdf from your folder?" });
    await user.click(within(ask).getByRole("button", { name: "Delete it" }));

    await screen.findByText("certificate.pdf was removed.");
    expect(await memory.readAttachmentOutside(EVIDENCE_ID, "certificate.pdf")).toBeUndefined();
    expect(await memory.readOutside(EVIDENCE)).not.toContain("certificate.pdf");
  });

  it("deletes nothing when a file changed in the folder since it was shown (AD10)", async () => {
    const user = userEvent.setup();
    const memory = await withFiles();
    await openPaymentsApi(user, memory);
    await user.click(await screen.findByRole("button", { name: "Remove certificate.pdf" }));
    await memory.putAttachmentOutside(EVIDENCE_ID, "certificate.pdf", new Uint8Array([1]));

    await user.click(screen.getByRole("button", { name: "Delete it" }));

    await screen.findByText(
      "certificate.pdf changed in your folder since it was shown, so it wasn't deleted.",
    );
    expect(await memory.readAttachmentOutside(EVIDENCE_ID, "certificate.pdf")).toEqual(new Uint8Array([1]));
  });

  it("offers no attaching or removing for a diagnostic's record, only downloading", async () => {
    const user = userEvent.setup();
    await openPaymentsApi(user, await withFiles(WITH_FILES.replace("kind: project", "kind: assessment")));

    await screen.findByRole("button", { name: "Download certificate.pdf" });
    expect(screen.queryByLabelText("Attach a file")).toBeNull();
    expect(screen.queryByRole("button", { name: "Remove certificate.pdf" })).toBeNull();
  });

  it("shows the file as it is now after a refusal, so trying again works", async () => {
    const user = userEvent.setup();
    const memory = await withFiles();
    await openPaymentsApi(user, memory);
    await user.click(await screen.findByRole("button", { name: "Remove certificate.pdf" }));
    await memory.putAttachmentOutside(EVIDENCE_ID, "certificate.pdf", new Uint8Array([1]));
    await user.click(screen.getByRole("button", { name: "Delete it" }));
    await screen.findByText(
      "certificate.pdf changed in your folder since it was shown, so it wasn't deleted.",
    );

    await user.click(screen.getByRole("button", { name: "Remove certificate.pdf" }));
    await user.click(screen.getByRole("button", { name: "Delete it" }));

    await screen.findByText("certificate.pdf was removed.");
    expect(await memory.readAttachmentOutside(EVIDENCE_ID, "certificate.pdf")).toBeUndefined();
  });

  it("says a file was deleted when the evidence couldn't then be saved without it", async () => {
    const user = userEvent.setup();
    const memory = await withFiles();
    await openPaymentsApi(user, memory);
    await user.click(await screen.findByRole("button", { name: "Remove certificate.pdf" }));
    await memory.removeOutside(EVIDENCE);

    await user.click(screen.getByRole("button", { name: "Delete it" }));

    await screen.findByText(
      "certificate.pdf was deleted from your folder, but this evidence still lists it.",
    );
  });
});
