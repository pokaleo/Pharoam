/**
 * Pharoam's core: the profile model, schemas, validation, shown-level and gap logic, and the core service.
 *
 * @remarks Pure TypeScript with no browser, Node, React, connector or provider dependencies, so the web app,
 * the relay and the tests share one implementation (ADR-0003).
 * @packageDocumentation
 */
export {
  createProfileRecordIdGenerator,
  parsePathwaySlug,
  parseProfileRecordId,
  parseSkillSlug,
  type Brand,
  type IdSource,
  type InvalidIdError,
  type PathwaySlug,
  type ProfileRecordId,
  type SkillSlug,
} from "./ids.ts";
export {
  canonicalJson,
  checkEntry,
  checkRecord,
  entryFingerprint,
  recordFingerprint,
  sealEntry,
  type IntegrityStatus,
  type NotCanonicalError,
} from "./integrity.ts";
export {
  createRecordFile,
  parseRecordFile,
  printRecordFile,
  withTopField,
  type RecordFile,
  type RecordFileError,
  type RecordFileLayout,
  type YamlProblem,
} from "./record-file.ts";
export { err, ok, type Result } from "./result.ts";
export { AiSkillLink, EvidenceRecord } from "./schemas/evidence.ts";
export { AiProvenance, ConfirmedAiProvenance, Provenance } from "./schemas/fields.ts";
export { GapRecord, GapRequirement } from "./schemas/gap.ts";
export { PackManifest } from "./schemas/pack.ts";
export { PathwayRecord, PathwayRequirement, SourceRef } from "./schemas/pathway.ts";
export { PharoamRecord } from "./schemas/pharoam.ts";
export {
  parseProfileRecord,
  PROFILE_RECORD_SCHEMAS,
  type FieldIssue,
  type ProfileRecord,
  type ProfileRecordError,
  type ProfileRecordType,
} from "./schemas/profile-record.ts";
export { publishedJsonSchemas } from "./schemas/published.ts";
export { Observation, Proficiency, Review, SkillRecord } from "./schemas/skill-record.ts";
export { SkillEntry } from "./schemas/skill.ts";
