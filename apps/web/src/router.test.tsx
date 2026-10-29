import { createMemoryHistory } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";
import { createAppRouter } from "./router.tsx";

describe("createAppRouter (ADR-0008)", () => {
  const router = createAppRouter({ history: createMemoryHistory(), supportsFolders: true });

  it("has a route for every screen", () => {
    expect(Object.keys(router.routesByPath).sort()).toEqual(
      [
        "/",
        "/about",
        "/attention",
        "/evidence",
        "/evidence/$id",
        "/evidence/$id/edit",
        "/evidence/new",
        "/pathways",
        "/pathways/$slug",
        "/pathways/$slug/gap",
        "/skills",
        "/skills/$skill",
        "/skills/custom",
        "/skills/record",
      ].sort(),
    );
  });

  it("prefers a screen's own address to a skill or evidence ID that looks the same", () => {
    const match = (path: string): string | undefined => router.matchRoutes(path).at(-1)?.routeId;
    expect(match("/skills/custom")).toBe("/skills/custom");
    expect(match("/skills/record")).toBe("/skills/record");
    expect(match("/skills/python")).toBe("/skills/$skill");
    expect(match("/evidence/new")).toBe("/evidence/new");
  });
});
