import { describe, expect, it } from "vitest";
import {
  createProfileRecordIdGenerator,
  parsePathwaySlug,
  parseProfileRecordId,
  parseSkillSlug,
  type ProfileRecordId,
} from "./ids.ts";

const UUIDV7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

// Fills the random bytes with a fixed 80-bit value, big-endian.
function fixedRandom(value: bigint): (bytes: Uint8Array) => void {
  return (bytes) => {
    let rest = value;
    for (let i = bytes.length - 1; i >= 0; i--) {
      bytes[i] = Number(rest & 0xffn);
      rest >>= 8n;
    }
  };
}

// A real-looking random source, so tests don't depend on the platform's crypto.
function seededRandom(seed: number): (bytes: Uint8Array) => void {
  let state = seed;
  return (bytes) => {
    for (let i = 0; i < bytes.length; i++) {
      state = (state * 1103515245 + 12345) % 2 ** 31;
      bytes[i] = state & 0xff;
    }
  };
}

// A clock that returns the given times in turn, then repeats the last.
function clockAt(...times: number[]): () => number {
  let i = 0;
  return () => times[Math.min(i++, times.length - 1)] ?? 0;
}

describe("profile record IDs", () => {
  it("matches the RFC 9562 UUIDv7 example", () => {
    // RFC 9562 Appendix A.6: unix_ts_ms 0x017F22E279B0, rand_a 0xCC3, rand_b 0x18C4DC0C0C07398F.
    const next = createProfileRecordIdGenerator({
      now: () => 0x017f22e279b0,
      fillRandom: fixedRandom((0xcc3n << 62n) | 0x18c4dc0c0c07398fn),
    });
    expect(next()).toBe("017f22e2-79b0-7cc3-98c4-dc0c0c07398f");
  });

  it("is a lowercase UUIDv7 with the RFC 9562 variant", () => {
    const next = createProfileRecordIdGenerator({
      now: () => Date.UTC(2026, 9, 24),
      fillRandom: seededRandom(1),
    });
    for (let i = 0; i < 100; i++) expect(next()).toMatch(UUIDV7);
  });

  it("starts with the creation time in milliseconds", () => {
    const created = Date.UTC(2026, 9, 24, 14, 2, 11);
    const next = createProfileRecordIdGenerator({ now: () => created, fillRandom: seededRandom(2) });
    expect(Number.parseInt(next().replace("-", "").slice(0, 12), 16)).toBe(created);
  });

  it("sorts by creation time", () => {
    const next = createProfileRecordIdGenerator({
      now: clockAt(3_000, 1_000_000, 2_000_000_000_000),
      fillRandom: seededRandom(3),
    });
    const ids = [next(), next(), next()];
    expect(ids.toSorted()).toEqual(ids);
  });

  it("keeps IDs made in the same millisecond in creation order", () => {
    // The largest random value, so the next ID must carry into the timestamp.
    const next = createProfileRecordIdGenerator({
      now: () => 5_000,
      fillRandom: fixedRandom(2n ** 74n - 2n),
    });
    const ids = Array.from({ length: 4 }, () => next());
    expect(ids.toSorted()).toEqual(ids);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps creation order when the clock goes backwards", () => {
    const next = createProfileRecordIdGenerator({
      now: clockAt(9_000, 8_000, 7_000),
      fillRandom: seededRandom(4),
    });
    const ids = [next(), next(), next()];
    expect(ids.toSorted()).toEqual(ids);
  });

  it("makes distinct IDs", () => {
    const next = createProfileRecordIdGenerator({ now: () => 5_000, fillRandom: seededRandom(5) });
    const ids = new Set(Array.from({ length: 1_000 }, () => next()));
    expect(ids.size).toBe(1_000);
  });

  it.each([-1, 2 ** 48, Number.NaN, 1.5])("treats a clock reading of %s as a bug", (time) => {
    const next = createProfileRecordIdGenerator({ now: () => time, fillRandom: seededRandom(6) });
    expect(() => next()).toThrow(RangeError);
  });

  it("parses a generated ID", () => {
    const id: ProfileRecordId = createProfileRecordIdGenerator({
      now: () => 1,
      fillRandom: seededRandom(7),
    })();
    expect(parseProfileRecordId(id)).toEqual({ ok: true, value: id });
  });

  it.each([
    ["uppercase", "017F22E2-79B0-7CC3-98C4-DC0C0C07398F"],
    ["version 4", "017f22e2-79b0-4cc3-98c4-dc0c0c07398f"],
    ["the wrong variant", "017f22e2-79b0-7cc3-c8c4-dc0c0c07398f"],
    ["no hyphens", "017f22e279b07cc398c4dc0c0c07398f"],
    ["empty", ""],
    ["a slug", "python"],
  ])("rejects %s", (_name, value) => {
    expect(parseProfileRecordId(value)).toEqual({
      ok: false,
      error: { kind: "invalid-id", expected: "uuidv7", value },
    });
  });
});

describe("content slugs", () => {
  it.each(["python", "ml-engineer", "py-closures-01", "custom-kdb-q", "c", "a".repeat(64)])(
    "accepts %s",
    (value) => {
      expect(parseSkillSlug(value)).toEqual({ ok: true, value });
      expect(parsePathwaySlug(value)).toEqual({ ok: true, value });
    },
  );

  it.each([
    "",
    "Python",
    "-python",
    "python-",
    "ml--engineer",
    "ml_engineer",
    "ml engineer",
    "c++",
    "a".repeat(65),
  ])("rejects %j", (value) => {
    const error = { kind: "invalid-id", expected: "slug", value };
    expect(parseSkillSlug(value)).toEqual({ ok: false, error });
    expect(parsePathwaySlug(value)).toEqual({ ok: false, error });
  });
});
