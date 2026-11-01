/**
 * "Needs attention": files Pharoam can't use, and files with two versions (MVP S12).
 *
 * @packageDocumentation
 */
import { printRecordFile, type AttentionItem, type Conflict, type CoreService } from "@pharoam/core";
import { useMutation } from "@tanstack/react-query";
import type { TFunction } from "i18next";
import { FileWarning, GitCompareArrows } from "lucide-react";
import { useId, type ReactElement, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useSession } from "../profile/session.tsx";
import { Button } from "../ui/button.tsx";
import { Empty } from "../ui/empty.tsx";
import { Icon } from "../ui/icon.tsx";
import { Notice } from "../ui/notice.tsx";
import { PageTitle } from "../ui/page-title.tsx";
import { Tag } from "../ui/tag.tsx";

/**
 * Lists the files that need the person: two versions to choose between, then files that can't be read.
 *
 * @remarks Nothing here is ever rewritten or deleted by Pharoam: a broken file is explained in plain words and left
 * out until it's fixed (MVP S12.2, hard rule 3), and of two versions only the one the person chooses is kept
 * (MVP S12.1, AD10).
 * @param props - The open profile's service.
 * @returns The page, or a line saying nothing needs attention.
 */
export function AttentionPage({ service }: { readonly service: CoreService }): ReactElement {
  const { t } = useTranslation();
  const conflicts = service.conflicts();
  const broken = service.needsAttention();

  return (
    <>
      <PageTitle title={t("attention.title")} lead={t("attention.lead")} />
      <div className="grid gap-(--space-6)">
        {conflicts.length === 0 && broken.length === 0 ? <Empty text={t("attention.none")} /> : null}
        {conflicts.length === 0 ? null : (
          <section className="grid gap-(--space-3)">
            <h2 className="text-section font-bold tracking-[-0.01em]">{t("attention.conflictsTitle")}</h2>
            <p className="max-w-[72ch] text-ink-2">{t("attention.conflictsLead")}</p>
            {conflicts.map((conflict) => (
              <ConflictView key={conflict.location} service={service} conflict={conflict} />
            ))}
          </section>
        )}
        {broken.length === 0 ? null : (
          <section className="grid gap-(--space-3)">
            <h2 className="text-section font-bold tracking-[-0.01em]">{t("attention.brokenTitle")}</h2>
            <p className="max-w-[72ch] text-ink-2">{t("attention.brokenLead")}</p>
            <ul className="rounded-lg border border-line bg-surface px-(--pad) py-1">
              {broken.map((item) => (
                <BrokenFile key={item.location} item={item} />
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}

function BrokenFile({ item }: { readonly item: AttentionItem }): ReactElement {
  const { t } = useTranslation();
  const nameId = useId();
  return (
    <li
      aria-labelledby={nameId}
      className="flex min-h-(--row-2) items-start gap-(--space-3) border-b border-line-soft py-3 last:border-b-0"
    >
      <Icon of={FileWarning} className="mt-0.5 text-notice" />
      <span className="grid min-w-0 flex-1 gap-1">
        <code id={nameId} className="font-mono text-[13px] font-semibold break-all text-ink">
          {item.location}
        </code>
        <span className="text-ink-2">{explanation(t, item.problem)}</span>
      </span>
      <span className="max-sm:hidden">
        <Tag tone="attention">{t("attention.leftOut")}</Tag>
      </span>
    </li>
  );
}

// A plain explanation of what is wrong with a file (MVP S12.2).
function explanation(t: TFunction, problem: AttentionItem["problem"]): string {
  switch (problem.kind) {
    case "unreadable": {
      const error = problem.error;
      if (error.kind === "invalid-yaml") {
        const first = error.problems[0];
        return t("attention.problems.invalid-yaml", {
          message: first?.message ?? "",
          line: first?.line ?? 1,
        });
      }
      return t(`attention.problems.${error.kind}`);
    }
    case "invalid": {
      const error = problem.error;
      if (error.kind !== "invalid-fields") return t(`attention.problems.${error.kind}`);
      const fields = [...new Set(error.issues.map((issue) => issue.path.map(String).join(".") || "schema"))];
      return t("attention.problems.invalid-fields", { fields: fields.join(", ") });
    }
    case "duplicate-id":
      return t("attention.problems.duplicate-id", { file: problem.keptAt });
    case "unavailable":
      return t("attention.problems.unavailable");
  }
}

function ConflictView({
  service,
  conflict,
}: {
  readonly service: CoreService;
  readonly conflict: Conflict;
}): ReactElement {
  const { t } = useTranslation();
  const titleId = useId();
  const theirsId = useId();
  const mineId = useId();
  const { changed } = useSession();
  const resolve = useMutation({
    mutationFn: async (keep: "mine" | "theirs") => {
      const resolved = await service.resolveConflict(conflict.location, keep);
      changed();
      return resolved.ok;
    },
  });
  const theirsReadable = conflict.theirs.ok;
  const theirs = conflict.theirs.ok ? printRecordFile(conflict.theirs.value) : undefined;
  const mine = conflict.mine === undefined ? undefined : printRecordFile(conflict.mine);

  return (
    <section
      aria-labelledby={titleId}
      className="grid gap-(--space-3) rounded-lg border border-notice-edge bg-notice-wash p-(--pad)"
    >
      <h3 id={titleId} className="flex items-center gap-(--space-2) font-semibold">
        <Icon of={GitCompareArrows} className="text-notice" />
        {t("attention.conflict", { file: conflict.location })}
      </h3>
      <div className="grid gap-(--gap) md:grid-cols-2">
        <Side
          titleId={theirsId}
          title={t("attention.theirs")}
          text={theirs}
          other={mine}
          missing={
            conflict.theirs.ok
              ? ""
              : conflict.theirs.error.kind === "not-found"
                ? t("attention.theirsGone")
                : t("attention.theirsUnreadable")
          }
          keep={
            <Button
              size="sm"
              disabled={resolve.isPending}
              onClick={() => {
                resolve.mutate("theirs");
              }}
            >
              {t("attention.keepTheirs")}
            </Button>
          }
        />
        <Side
          titleId={mineId}
          title={t("attention.mine")}
          text={mine}
          other={theirs}
          missing={t("attention.mineDelete")}
          keep={
            theirsReadable || conflict.theirs.error.kind === "not-found" ? (
              <Button
                size="sm"
                disabled={resolve.isPending}
                onClick={() => {
                  resolve.mutate("mine");
                }}
              >
                {t("attention.keepMine")}
              </Button>
            ) : null
          }
        />
      </div>
      {resolve.data === false || resolve.isError ? (
        <Notice tone="problem" title={t("attention.resolveFailed")} />
      ) : null}
    </section>
  );
}

// One version of a file with two: its name, its text with the lines the other version lacks marked, and keeping it.
function Side({
  titleId,
  title,
  text,
  other,
  missing,
  keep,
}: {
  readonly titleId: string;
  readonly title: string;
  readonly text: string | undefined;
  readonly other: string | undefined;
  readonly missing: string;
  readonly keep: ReactNode;
}): ReactElement {
  const otherLines = new Set(other?.split("\n"));
  return (
    <section aria-labelledby={titleId} className="flex flex-col rounded-lg border border-line bg-surface">
      <h4 id={titleId} className="border-b border-line px-3.5 py-2.5 font-semibold">
        {title}
      </h4>
      {text === undefined ? (
        <p className="flex-1 px-3.5 py-2.5 text-ink-2">{missing}</p>
      ) : (
        <pre className="flex-1 overflow-x-auto px-3.5 py-2.5 font-mono text-[13px] leading-5 whitespace-pre-wrap [direction:ltr] [text-align:left]">
          {text.split("\n").map((line, index) => (
            // Lines the other version doesn't have are marked with the lamp wash (the design system's changed line).
            // A file's lines have no identity but their place, so the place is the key.
            <span
              key={index}
              className={other !== undefined && !otherLines.has(line) ? "bg-lamp-wash" : undefined}
            >
              {line}
              {"\n"}
            </span>
          ))}
        </pre>
      )}
      {keep === null ? null : <div className="border-t border-line px-3.5 py-2.5">{keep}</div>}
    </section>
  );
}
