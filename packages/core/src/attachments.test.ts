import { describe, expect, it } from "vitest";
import { MAX_ATTACHMENT_BYTES, attachmentName, isAttachmentName, numberedName } from "./attachments.ts";

describe("an attachment's name (MVP S14.1)", () => {
  it("keeps a file's own name", () => {
    expect(attachmentName("Certificate of completion.pdf")).toBe("Certificate of completion.pdf");
    expect(attachmentName("CV – Développeuse.docx")).toBe("CV – Développeuse.docx");
  });

  it("keeps only the last part of a path", () => {
    expect(attachmentName("C:\\Users\\me\\cv.pdf")).toBe("cv.pdf");
    expect(attachmentName("../../pharoam.md")).toBe("pharoam.md");
  });

  it("replaces characters a folder can't hold on every system", () => {
    expect(attachmentName('a<b>c:d"e|f?g*h.txt')).toBe("a-b-c-d-e-f-g-h.txt");
    expect(attachmentName("tab\there\u0000.txt")).toBe("tab-here-.txt");
  });

  it("is never hidden, a folder's own name, or ends in a dot or space", () => {
    expect(attachmentName(".env")).toBe("env");
    expect(attachmentName("..")).toBe("attachment");
    expect(attachmentName("notes. . ")).toBe("notes");
    expect(attachmentName("   ")).toBe("attachment");
  });

  it("avoids names Windows reserves for devices", () => {
    expect(attachmentName("CON")).toBe("CON-file");
    expect(attachmentName("nul.txt")).toBe("nul-file.txt");
    expect(attachmentName("console.txt")).toBe("console.txt");
  });

  it("is short enough for any folder, keeping the extension", () => {
    const name = attachmentName(`${"a".repeat(300)}.pdf`);
    expect(name.length).toBeLessThanOrEqual(120);
    expect(name.endsWith("a.pdf")).toBe(true);
  });

  it("writes accented letters one way, so the same name always matches", () => {
    expect(attachmentName("Cafe\u0301.txt")).toBe("Café.txt");
  });

  it("is a name storage can safely use", () => {
    for (const raw of ["../x", ".hidden", "a/b\\c", "CON", "x".repeat(400), "ok.pdf"])
      expect(isAttachmentName(attachmentName(raw))).toBe(true);
    for (const unsafe of ["", ".", "..", "a/b", "a\\b", ".env", "a:b", "x".repeat(121), "nul"])
      expect(isAttachmentName(unsafe)).toBe(false);
  });
});

describe("names storage always accepts", () => {
  // A fixed sequence of awkward names: dots, spaces, separators, device names, long runs and invisible marks.
  const PIECES = [
    "a",
    "Z",
    "é",
    "e\u0301",
    ".",
    " ",
    "..",
    "/",
    "\\",
    ":",
    "nul",
    "CON",
    "com1",
    "lpt¹",
    "conin$",
    "\u202e",
    "\u200b",
    "x".repeat(40),
    "日本",
    "😀",
    ".pdf",
    ".tar",
    ". ",
    " .",
  ];
  function* names(): Generator<string> {
    let seed = 7;
    const next = (): number => (seed = (seed * 1103515245 + 12345) % 2 ** 31);
    for (let i = 0; i < 3000; i++) {
      let name = "";
      const length = next() % 12;
      for (let j = 0; j < length; j++) name += PIECES[next() % PIECES.length] ?? "";
      yield name;
    }
  }

  it("are given for any name, and stay safe when numbered", () => {
    for (const raw of names()) {
      const name = attachmentName(raw);
      expect(isAttachmentName(name), JSON.stringify(raw)).toBe(true);
      expect(isAttachmentName(numberedName(name, 12)), JSON.stringify(raw)).toBe(true);
    }
  });

  it("are given for the names a review found unsafe", () => {
    expect(attachmentName("nul.tar.gz")).toBe("nul-file.tar.gz");
    expect(attachmentName("con .txt")).toBe("con-file.txt");
    expect(attachmentName("CONOUT$")).toBe("CONOUT$-file");
    expect(attachmentName("com¹.txt")).toBe("com¹-file.txt");
    for (const raw of ["nul..txt", `${"a".repeat(100)}. .bcdefghijklmnopqrstuvwxyz0123`])
      expect(isAttachmentName(attachmentName(raw))).toBe(true);
  });

  it("hide no direction or zero-width marks, which could disguise a file's type", () => {
    expect(attachmentName("invoice\u202efdp.exe")).toBe("invoice-fdp.exe");
    expect(attachmentName("\u200b.pdf")).toBe("-.pdf");
  });
});

describe("a second attachment with the same name", () => {
  it("is numbered before its extension", () => {
    expect(numberedName("cv.pdf", 2)).toBe("cv (2).pdf");
    expect(numberedName("archive.tar.gz", 3)).toBe("archive.tar (3).gz");
    expect(numberedName("README", 2)).toBe("README (2)");
  });

  it("is still a safe name", () => {
    expect(isAttachmentName(numberedName(attachmentName("x".repeat(400)), 99))).toBe(true);
  });
});

describe("the size limit (MVP S14.3)", () => {
  it("is 10 MB", () => {
    expect(MAX_ATTACHMENT_BYTES).toBe(10 * 1024 * 1024);
  });
});
