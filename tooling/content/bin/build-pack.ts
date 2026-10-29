/**
 * `pnpm content:build`: compiles `data/` and `content/` into the built-in content pack in `dist/content/`.
 *
 * @remarks Fails, listing every problem, when any content is invalid (AD16).
 * @packageDocumentation
 */
import path from "node:path";
import { buildPack } from "../build-pack.ts";

const root = path.join(import.meta.dirname, "..", "..", "..");
const built = buildPack(root, path.join(root, "dist", "content"));

if (!built.ok) {
  const problems = built.error.problems.map(
    (p) => `  - ${p.path === "" ? "the pack" : p.path}: ${p.message}`,
  );
  console.error(`The content pack can't be built:\n${problems.join("\n")}`);
  process.exit(1);
}
console.log(`Built ${path.relative(root, built.value.file)}.`);
