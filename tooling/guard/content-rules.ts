/**
 * Content checks for AGENTS.md hard rules that can be detected in a single file's text.
 *
 * @remarks Used by the Claude Code hook (before an edit is written), the git pre-commit hook and CI.
 * @packageDocumentation
 */
import { isDeniedPackage } from "./deny-list.ts";

/** A broken hard rule found in a file. */
export interface Violation {
  /** The rule's ID, such as `HR7-telemetry`. */
  rule: string;
  /** What is wrong and which rule it breaks, for the person or agent fixing it. */
  message: string;
}

const CODE_FILE = /\.(?:[cm]?[jt]sx?)$/;
const MODULE_SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*|^\s*import\s+)["']([^"']+)["']/gm;
const LANGSMITH =
  /\b(?:LANGSMITH_TRACING|LANGCHAIN_TRACING(?:_V2)?)\b["']?\s*[=:]\s*["']?true|\bLANGSMITH_API_KEY\b/;
const EXTERNAL_SCRIPT = /<script\b[^>]*\bsrc\s*=\s*["'](?:https?:)?\/\//i;
const RAW_HTML = /\bdangerouslySetInnerHTML\b|["']rehype-raw["']/;

const JAVASCRIPT_FILE = /\.(?:[cm]?js|jsx)$/;
// Files a tool can only load as JavaScript, each with its reason (ADR-0002). None today.
const JAVASCRIPT_EXCEPTIONS: readonly string[] = [];

// The guard's own sources must name what they forbid.
const EXEMPT_PREFIX = "tooling/guard/";

/**
 * Checks one file's text against the content rules.
 *
 * @remarks Files under `tooling/guard/` are exempt, because they must name what they forbid.
 * @param path - Repo-relative path, which decides the checks that apply.
 * @param content - The file's full text.
 * @returns Every violation found; empty when the file is clean.
 */
export function checkContent(path: string, content: string): Violation[] {
  const violations: Violation[] = [];

  if (JAVASCRIPT_FILE.test(path) && !JAVASCRIPT_EXCEPTIONS.includes(path)) {
    violations.push({
      rule: "TS-only",
      message: "Write code in TypeScript; JavaScript is allowed only as a named exception (ADR-0002).",
    });
  }
  if (path.startsWith(EXEMPT_PREFIX)) return violations;

  if (CODE_FILE.test(path)) {
    for (const [, specifier] of content.matchAll(MODULE_SPECIFIER)) {
      if (specifier && isDeniedPackage(specifier)) {
        violations.push({
          rule: "HR7-telemetry",
          message: `"${specifier}" is a telemetry/analytics package. Pharoam has no telemetry (AGENTS.md hard rule 7).`,
        });
      }
    }
    if (RAW_HTML.test(content)) {
      violations.push({
        rule: "HR10-raw-html",
        message:
          "Raw HTML rendering (dangerouslySetInnerHTML / rehype-raw) is forbidden; render sanitised Markdown (AGENTS.md hard rule 10).",
      });
    }
  }

  if (path.endsWith("package.json")) {
    for (const name of declaredDependencies(content)) {
      if (isDeniedPackage(name)) {
        violations.push({
          rule: "HR7-telemetry",
          message: `Dependency "${name}" is a telemetry/analytics package (AGENTS.md hard rule 7).`,
        });
      }
    }
  }

  if (path.endsWith(".html") && EXTERNAL_SCRIPT.test(content)) {
    violations.push({
      rule: "HR7-third-party-script",
      message:
        "Third-party scripts are forbidden; load scripts only from the app itself (AGENTS.md hard rule 7).",
    });
  }

  if (LANGSMITH.test(content)) {
    violations.push({
      rule: "HR7-langsmith",
      message: "LangSmith tracing must stay off and unconfigured (AGENTS.md hard rule 7, ADR-0012).",
    });
  }

  return violations;
}

function declaredDependencies(packageJson: string): string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(packageJson);
  } catch {
    return [];
  }
  if (typeof parsed !== "object" || parsed === null) return [];
  const sections = ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"] as const;
  return sections.flatMap((section) => {
    const deps = (parsed as Record<string, unknown>)[section];
    return typeof deps === "object" && deps !== null ? Object.keys(deps) : [];
  });
}
