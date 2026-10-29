import type { ContentFile } from "@pharoam/core";
import { describe, expect, it } from "vitest";
import { readContentFiles } from "../../../../tooling/content/build-pack.ts";
import { CONTENT_PACK_MODULE, contentPackModule } from "./content-pack.ts";

const REPO = new URL("../../../..", import.meta.url).pathname;

describe("contentPackModule (AD16)", () => {
  it("compiles data/ and content/ into the module the app imports", () => {
    const code = contentPackModule(() => readContentFiles(REPO));
    expect(code.ok).toBe(true);
    if (!code.ok) return;
    const pack = JSON.parse(code.value.replace(/^export default /, "").replace(/;\n$/, "")) as {
      format: string;
      pathways: unknown[];
    };
    expect(pack.format).toBe("pharoam-pack/1");
    expect(pack.pathways).toHaveLength(4);
  });

  it("refuses invalid content, naming every problem, so a broken pack never ships", () => {
    const broken: ContentFile[] = [{ path: "data/skills/broken.md", text: "no top block" }];
    const code = contentPackModule(() => broken);
    expect(code.ok).toBe(false);
    if (code.ok) return;
    expect(code.error).toMatch(/data\/skills\/broken\.md/);
  });

  it("is imported by a name that can't clash with a real package", () => {
    expect(CONTENT_PACK_MODULE).toBe("virtual:pharoam/content-pack");
  });
});
