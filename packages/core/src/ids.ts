/**
 * IDs for records: UUIDv7 for profile records, readable slugs for content records.
 *
 * @remarks References always use these IDs, never file names, so renaming or moving a file breaks nothing
 * (data model §2). Branded types keep one kind of ID from being passed where another is expected.
 * @packageDocumentation
 */
import { err, ok, type Result } from "./result.ts";

declare const brand: unique symbol;

/**
 * A value of type `T` that has been checked to be a `B`.
 *
 * @remarks The brand exists only in the type system; at runtime the value is a plain `T`. Values get a brand
 * only from the parse and create functions in this module.
 * @typeParam T - The runtime type, such as `string`.
 * @typeParam B - The name of the checked kind.
 */
export type Brand<T, B extends string> = T & { readonly [brand]: B };

/** The ID of a profile record: a lowercase UUIDv7 (RFC 9562), which sorts by creation time. */
export type ProfileRecordId = Brand<string, "ProfileRecordId">;

/** The slug of a skill in the vocabulary, such as `python`. Custom skills start with `custom-`. */
export type SkillSlug = Brand<string, "SkillSlug">;

/** The slug of a pathway, such as `ml-engineer`. */
export type PathwaySlug = Brand<string, "PathwaySlug">;

/** A string that isn't a valid ID of the expected form. */
export interface InvalidIdError {
  /** Always `"invalid-id"`. */
  readonly kind: "invalid-id";
  /** The form the value should have had. */
  readonly expected: "uuidv7" | "slug";
  /** The value as given. */
  readonly value: string;
}

/** Where a profile record ID generator gets the time and its randomness. */
export interface IdSource {
  /** The current time in milliseconds since the Unix epoch, such as `Date.now()`. */
  readonly now: () => number;
  /** Fills `bytes` with cryptographically secure random values, such as `crypto.getRandomValues`. */
  readonly fillRandom: (bytes: Uint8Array) => void;
}

/** The form of a profile record ID: a lowercase UUIDv7 (RFC 9562). */
export const PROFILE_RECORD_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** The form of a content slug: lowercase letters and digits joined by single hyphens, at most 64 characters. */
export const SLUG_PATTERN = /^(?=.{1,64}$)[a-z0-9]+(?:-[a-z0-9]+)*$/;

const MAX_TIMESTAMP = 2 ** 48 - 1;
const RANDOM_BITS = 74n;
const RANDOM_LIMIT = 1n << RANDOM_BITS;

/**
 * Creates a function that makes a new profile record ID each time it is called.
 *
 * @remarks Each ID is a UUIDv7 (RFC 9562): the creation time in milliseconds, then 74 random bits. IDs from one
 * generator always sort in the order they were made: within the same millisecond, or when the clock goes
 * backwards, the next ID is the previous one plus one (RFC 9562 §6.2, method 2). The clock and randomness are
 * passed in so the core stays free of platform APIs (ADR-0003).
 * @param source - The clock and random source to use.
 * @returns A function returning a new ID on each call.
 * @throws RangeError when the clock gives a time that isn't a whole number of milliseconds from 1970 to 10889.
 */
export function createProfileRecordIdGenerator(source: IdSource): () => ProfileRecordId {
  let lastTime = -1;
  let lastRandom = 0n;
  return () => {
    const now = source.now();
    if (!Number.isInteger(now) || now < 0 || now > MAX_TIMESTAMP) {
      throw new RangeError(`Clock gave ${String(now)}, not a UUIDv7 timestamp in milliseconds.`);
    }
    if (now > lastTime) {
      lastTime = now;
      lastRandom = randomBits(source);
    } else {
      lastRandom += 1n;
      if (lastRandom === RANDOM_LIMIT) {
        lastTime += 1;
        lastRandom = randomBits(source);
      }
    }
    return formatUuidV7(lastTime, lastRandom) as ProfileRecordId;
  };
}

/**
 * Checks that a string is a profile record ID.
 *
 * @param value - The string to check, such as an `id` read from a file.
 * @returns The ID, or an error when it isn't a lowercase UUIDv7.
 */
export function parseProfileRecordId(value: string): Result<ProfileRecordId, InvalidIdError> {
  return PROFILE_RECORD_ID_PATTERN.test(value)
    ? ok(value as ProfileRecordId)
    : err({ kind: "invalid-id", expected: "uuidv7", value });
}

/**
 * Checks that a string is a skill slug.
 *
 * @remarks Slugs are lowercase letters and digits joined by single hyphens, at most 64 characters, so they are
 * safe as file names (data model §2).
 * @param value - The string to check, such as a skill named in a record.
 * @returns The slug, or an error when it isn't one.
 */
export function parseSkillSlug(value: string): Result<SkillSlug, InvalidIdError> {
  return SLUG_PATTERN.test(value)
    ? ok(value as SkillSlug)
    : err({ kind: "invalid-id", expected: "slug", value });
}

/**
 * Checks that a string is a pathway slug.
 *
 * @remarks Same form as a skill slug (data model §2).
 * @param value - The string to check, such as a pathway named in a record.
 * @returns The slug, or an error when it isn't one.
 */
export function parsePathwaySlug(value: string): Result<PathwaySlug, InvalidIdError> {
  return SLUG_PATTERN.test(value)
    ? ok(value as PathwaySlug)
    : err({ kind: "invalid-id", expected: "slug", value });
}

// 74 random bits from 10 random bytes.
function randomBits(source: IdSource): bigint {
  const bytes = new Uint8Array(10);
  source.fillRandom(bytes);
  let value = 0n;
  for (const byte of bytes) value = (value << 8n) | BigInt(byte);
  return value % RANDOM_LIMIT;
}

// Lays out the RFC 9562 fields: 48-bit time, version 7, 12 random bits, variant 0b10, 62 random bits.
function formatUuidV7(time: number, random: bigint): string {
  const randA = random >> 62n;
  const randB = random & ((1n << 62n) - 1n);
  const value = (BigInt(time) << 80n) | (0x7n << 76n) | (randA << 64n) | (0b10n << 62n) | randB;
  const hex = value.toString(16).padStart(32, "0");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
