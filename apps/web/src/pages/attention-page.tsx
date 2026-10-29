/**
 * "Needs attention": files Pharoam can't use, and files with two versions (MVP S12).
 *
 * @packageDocumentation
 */
import { printRecordFile, type AttentionItem, type Conflict, type CoreService } from "@pharoam/core";
import { useMutation } from "@tanstack/react-query";
import type { TFunction } from "i18next";
import { useId, type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { useSession } from "../profile/session.tsx";
import { Button } from "../ui/button.tsx";
import { Notice } from "../ui/notice.tsx";
import { PageTitle } from "../ui/page-title.tsx";

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
      <div className="grid max-w-(--canvas-max) gap-(--space-7)">
        {conflicts.length === 0 && broken.length === 0 ? (
          <p className="text-ink-2">{t("attention.none")}</p>
        ) : null}
        {conflicts.length === 0 ? null : (
          <section className="grid gap-(--space-3)">
            <h2 className="text-section font-bold">{t("attention.conflictsTitle")}</h2>
            <p className="max-w-[72ch] text-ink-2">{t("attention.conflictsLead")}</p>
            {conflicts.map((conflict) => (
              <ConflictView key={conflict.location} service={service} conflict={conflict} />
            ))}
          </section>
        )}
        {broken.length === 0 ? null : (
          <section className="grid max-w-[72ch] gap-(--space-3)">
            <h2 className="text-section font-bold">{t("attention.brokenTitle")}</h2>
            <p className="text-ink-2">{t("attention.brokenLead")}</p>
            <ul className="grid divide-y divide-line-soft rounded-lg bg-surface">
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
    <li aria-labelledby={nameId} className="grid gap-1 px-(--pad) py-(--space-3)">
      <code id={nameId} className="font-mono text-meta font-semibold">
        {item.location}
      </code>
      <p className="text-ink-2">{explanation(t, item.problem)}</p>
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

  return (
    <section
      aria-labelledby={titleId}
      className="grid gap-(--space-3) rounded-lg border border-notice-edge bg-surface p-(--pad)"
    >
      <h3 id={titleId} className="font-semibold">
        {t("attention.conflict", { file: conflict.location })}
      </h3>
      <div className="grid gap-(--space-3) md:grid-cols-2">
        <section aria-labelledby={theirsId} className="grid content-start gap-(--space-2)">
          <h4 id={theirsId} className="text-meta font-semibold text-ink-2">
            {t("attention.theirs")}
          </h4>
          {conflict.theirs.ok ? (
            <pre className="rounded-md bg-panel p-(--space-3) font-mono text-meta whitespace-pre-wrap">
              {printRecordFile(conflict.theirs.value)}
            </pre>
          ) : (
            <p className="text-ink-2">
              {conflict.theirs.error.kind === "not-found"
                ? t("attention.theirsGone")
                : t("attention.theirsUnreadable")}
            </p>
          )}
        </section>
        <section aria-labelledby={mineId} className="grid content-start gap-(--space-2)">
          <h4 id={mineId} className="text-meta font-semibold text-ink-2">
            {t("attention.mine")}
          </h4>
          {conflict.mine === undefined ? (
            <p className="text-ink-2">{t("attention.mineDelete")}</p>
          ) : (
            <pre className="rounded-md bg-panel p-(--space-3) font-mono text-meta whitespace-pre-wrap">
              {printRecordFile(conflict.mine)}
            </pre>
          )}
        </section>
      </div>
      {resolve.data === false || resolve.isError ? (
        <Notice tone="problem" title={t("attention.resolveFailed")} />
      ) : null}
      <div className="flex flex-wrap gap-(--space-2)">
        <Button
          disabled={resolve.isPending}
          onClick={() => {
            resolve.mutate("theirs");
          }}
        >
          {t("attention.keepTheirs")}
        </Button>
        {theirsReadable || conflict.theirs.error.kind === "not-found" ? (
          <Button
            disabled={resolve.isPending}
            onClick={() => {
              resolve.mutate("mine");
            }}
          >
            {t("attention.keepMine")}
          </Button>
        ) : null}
      </div>
    </section>
  );
}
