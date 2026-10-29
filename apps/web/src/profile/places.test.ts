import type { Result } from "@pharoam/core";
import { describe, expectTypeOf, it } from "vitest";
import type { PlaceError, Places, ProfilePlace } from "./places.ts";

// The module holds only the contract between the interface and the composition root, so its tests are of types.
describe("Places", () => {
  it("says why a place didn't open: closed picker, refused permission, nothing remembered, or storage failing", () => {
    expectTypeOf<PlaceError["kind"]>().toEqualTypeOf<"cancelled" | "denied" | "forgotten" | "unavailable">();
  });

  it("gives a place's name and storage, never a connector's own types (ADR-0003)", () => {
    expectTypeOf<keyof ProfilePlace>().toEqualTypeOf<"name" | "storage">();
    expectTypeOf<ReturnType<Places["choose"]>>().toEqualTypeOf<Promise<Result<ProfilePlace, PlaceError>>>();
    expectTypeOf<ReturnType<Places["remembered"]>>().toEqualTypeOf<Promise<string | undefined>>();
  });
});
