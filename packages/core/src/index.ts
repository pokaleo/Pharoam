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
