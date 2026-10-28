/**
 * The `pack` content record: the manifest of a versioned content pack.
 *
 * @remarks Every pack is checked against its manifest and minimum app version, and its licences are shown before
 * a pack is loaded from a URL (ADR-0005, interfaces §6).
 * @packageDocumentation
 */
import { z } from "zod";
import { SLUG_PATTERN } from "../ids.ts";
import {
  HttpUrlField,
  InventorySkillSlugField,
  LanguageTagField,
  PathwaySlugField,
  SpdxIdField,
  TextField,
} from "./fields.ts";

const SEMVER = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

/** The `pack/1` manifest. */
export const PackManifest = z.object({
  schema: z.literal("pack/1"),
  /** The pack's name, as a slug, such as `pharoam-core`. */
  name: z.string().regex(SLUG_PATTERN),
  /** The pack's semantic version. */
  version: z.string().regex(SEMVER),
  /** The oldest app version that can read this pack. */
  min_app_version: z.string().regex(SEMVER),
  publisher: TextField,
  /** One licence per data source in the pack, with any attribution it requires. */
  licences: z
    .array(
      z.object({
        source: TextField,
        licence: SpdxIdField,
        attribution: z.string().optional(),
        url: HttpUrlField.optional(),
      }),
    )
    .min(1),
  /** What the pack holds, by slug. */
  contents: z
    .object({
      skills: z.array(InventorySkillSlugField).default([]),
      pathways: z.array(PathwaySlugField).default([]),
    })
    .prefault({}),
  /** The languages the pack's text is available in. */
  translations: z.array(LanguageTagField).default([]),
});

/** A pack manifest as Pharoam reads it. */
export type PackManifest = z.output<typeof PackManifest>;
