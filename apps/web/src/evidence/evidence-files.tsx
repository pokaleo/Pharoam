/**
 * The files kept with a piece of evidence: listing, attaching, downloading and removing them (MVP S14).
 *
 * @packageDocumentation
 */
import {
  MAX_ATTACHMENT_BYTES,
  type AttachmentView,
  type CoreService,
  type LoadedRecord,
} from "@pharoam/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileUp, Trash2 } from "lucide-react";
import { useId, useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { useSession } from "../profile/session.tsx";
import { Button, buttonClassName } from "../ui/button.tsx";
import { ChangedOutsideNotice } from "../ui/changed-outside.tsx";
import { Icon } from "../ui/icon.tsx";
import { Notice } from "../ui/notice.tsx";
import { Tag } from "../ui/tag.tsx";
import { downloadFile, fileSize } from "./download.ts";

/**
 * The files a piece of evidence lists, with what the person's storage holds for each.
 *
 * @remarks Read again whenever the evidence is saved, as its version changes then.
 * @param service - The open profile's service.
 * @param loaded - The evidence, or `undefined` when there is none to list files for.
 * @returns The files, `undefined` while they are being read, or `false` when they couldn't be.
 */
export function useAttachments(
  service: CoreService,
  loaded: LoadedRecord | undefined,
): readonly AttachmentView[] | false | undefined {
  const files = useQuery({
    queryKey: ["attachments", loaded?.location, loaded?.version],
    queryFn: async () => {
      const listed = loaded === undefined ? undefined : await service.attachments(loaded.location);
      return listed?.ok === true ? listed.value : false;
    },
    enabled: loaded?.record.schema === "evidence/1",
  });
  return files.data;
}

// What the last action did, as the person is told.
type Outcome =
  | { readonly kind: "attached" | "removed"; readonly name: string }
  | {
      readonly kind:
        | "too-large"
        | "attach-failed"
        | "changed"
        | "remove-failed"
        | "not-unlisted"
        | "read-failed"
        | "changed-outside";
      readonly name: string;
    };

/**
 * The evidence's files, with attaching and removing where Pharoam may change the evidence (MVP S14).
 *
 * @remarks Files are only ever downloaded, never shown inside the page (S14.2, hard rule 10). A file over 10 MB is
 * refused before it is read (S14.3). Removing deletes the file from the person's folder, so it asks first, and
 * deletes nothing that changed there since it was shown (AD10).
 * @param props - The service, the evidence, its files, and whether Pharoam may change it.
 * @returns The files section.
 */
export function EvidenceFiles({
  service,
  loaded,
  files,
  editable,
}: {
  readonly service: CoreService;
  readonly loaded: LoadedRecord;
  readonly files: readonly AttachmentView[] | false | undefined;
  readonly editable: boolean;
}): ReactElement {
  const { t } = useTranslation();
  const { changed } = useSession();
  const titleId = useId();
  const hintId = useId();
  const [outcome, setOutcome] = useState<Outcome>();
  const [asking, setAsking] = useState<string>();
  const queryClient = useQueryClient();
  // Read again after every action, as a file can change in the folder without the evidence changing.
  const refresh = (): void => {
    void queryClient.invalidateQueries({ queryKey: ["attachments", loaded.location] });
  };

  const attach = useMutation({
    mutationFn: async (file: File): Promise<Outcome> => {
      if (file.size > MAX_ATTACHMENT_BYTES) return { kind: "too-large", name: file.name };
      const bytes = new Uint8Array(await file.arrayBuffer());
      const attached = await service.attachFile(loaded.location, { name: file.name, bytes });
      changed();
      if (attached.ok) {
        const record = attached.value.record;
        const name = record.schema === "evidence/1" ? (record.attachments.at(-1) ?? file.name) : file.name;
        return { kind: "attached", name };
      }
      const { kind } = attached.error;
      if (kind === "too-large") return { kind: "too-large", name: file.name };
      if (kind === "conflict") return { kind: "changed-outside", name: file.name };
      return { kind: "attach-failed", name: file.name };
    },
    onSuccess: setOutcome,
    onError: (_error, file) => {
      setOutcome({ kind: "attach-failed", name: file.name });
    },
    onSettled: refresh,
  });

  const remove = useMutation({
    mutationFn: async (file: AttachmentView): Promise<Outcome> => {
      const removed = await service.removeAttachment(loaded.location, file);
      changed();
      if (removed.ok) return { kind: "removed", name: file.name };
      const { kind } = removed.error;
      if (kind === "attachment-changed") return { kind: "changed", name: file.name };
      if (kind === "not-unlisted") return { kind: "not-unlisted", name: file.name };
      if (kind === "conflict") return { kind: "changed-outside", name: file.name };
      return { kind: "remove-failed", name: file.name };
    },
    onSuccess: (done) => {
      setAsking(undefined);
      setOutcome(done);
    },
    onError: (_error, file) => {
      setOutcome({ kind: "remove-failed", name: file.name });
    },
    onSettled: () => {
      setAsking(undefined);
      refresh();
    },
  });

  const download = async (name: string): Promise<void> => {
    const read = await service.readAttachment(loaded.location, name);
    if (read.ok) {
      downloadFile(name, read.value, document);
      return;
    }
    setOutcome({ kind: "read-failed", name });
    refresh();
  };

  return (
    <section
      aria-labelledby={titleId}
      className="grid gap-(--space-3) rounded-lg border border-line bg-surface p-(--pad)"
    >
      <h2 id={titleId} className="text-section font-bold">
        {t("evidence.files.title")}
      </h2>
      <p role="status" className="text-ink-2 empty:hidden">
        {outcome?.kind === "attached" || outcome?.kind === "removed"
          ? t(`evidence.files.${outcome.kind}`, { name: outcome.name })
          : attach.isPending
            ? t("evidence.files.attaching", { name: attach.variables.name })
            : ""}
      </p>
      <OutcomeNotice outcome={outcome} />
      {files === false ? (
        <Notice tone="problem" title={t("evidence.files.listFailed")} />
      ) : files === undefined ? null : files.length === 0 ? (
        <p className="text-ink-2">{t("evidence.files.empty")}</p>
      ) : (
        <ul aria-labelledby={titleId} className="grid divide-y divide-line">
          {files.map((file) => (
            <li key={file.name} className="grid gap-(--space-2) py-(--space-2)">
              <div className="flex flex-wrap items-center gap-(--space-2)">
                <span className="min-w-0 grow font-semibold break-all">{file.name}</span>
                {file.stored === undefined ? (
                  <Tag tone="attention">{t("evidence.files.missing")}</Tag>
                ) : (
                  <>
                    <span className="text-meta text-ink-2">
                      {fileSize(file.stored.size, t("app.locale"))}
                    </span>
                    <Button
                      size="sm"
                      aria-label={t("evidence.files.downloadName", { name: file.name })}
                      onClick={() => {
                        void download(file.name);
                      }}
                    >
                      <Icon of={Download} />
                      {t("evidence.files.download")}
                    </Button>
                  </>
                )}
                {editable ? (
                  <Button
                    size="sm"
                    variant="quiet"
                    aria-label={t("evidence.files.removeName", { name: file.name })}
                    aria-expanded={asking === file.name}
                    onClick={() => {
                      setAsking(file.name);
                    }}
                  >
                    <Icon of={Trash2} />
                    {t("evidence.files.remove")}
                  </Button>
                ) : null}
              </div>
              {asking === file.name ? (
                <RemoveQuestion
                  name={file.name}
                  busy={remove.isPending}
                  onConfirm={() => {
                    remove.mutate(file);
                  }}
                  onKeep={() => {
                    setAsking(undefined);
                  }}
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {editable ? (
        <div className="grid gap-(--space-1)">
          <div>
            <label
              className={`${buttonClassName("secondary")} cursor-pointer has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-(--focus)`}
            >
              <Icon of={FileUp} />
              {t("evidence.files.attach")}
              <input
                type="file"
                disabled={attach.isPending}
                aria-describedby={hintId}
                className="sr-only"
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  // Cleared, so picking the same file again attaches it again.
                  event.currentTarget.value = "";
                  if (file !== undefined) attach.mutate(file);
                }}
              />
            </label>
          </div>
          <p id={hintId} className="text-meta text-ink-2">
            {t("evidence.files.attachHint")}
          </p>
        </div>
      ) : null}
    </section>
  );
}

function OutcomeNotice({ outcome }: { readonly outcome: Outcome | undefined }): ReactElement | null {
  const { t } = useTranslation();
  if (outcome === undefined) return null;
  const { name } = outcome;
  switch (outcome.kind) {
    case "attached":
    case "removed":
      return null;
    case "too-large":
      return <Notice tone="attention" title={t("evidence.files.tooLarge", { name })} />;
    case "changed":
      return <Notice tone="attention" title={t("evidence.files.changed", { name })} />;
    case "changed-outside":
      return (
        <ChangedOutsideNotice
          title={t("evidence.changedOutside.title")}
          text={t("evidence.changedOutside.text")}
        />
      );
    case "attach-failed":
      return <Notice tone="problem" title={t("evidence.files.attachFailed", { name })} />;
    case "remove-failed":
      return <Notice tone="problem" title={t("evidence.files.removeFailed", { name })} />;
    case "not-unlisted":
      return <Notice tone="attention" title={t("evidence.files.notUnlisted", { name })} />;
    case "read-failed":
      return <Notice tone="problem" title={t("evidence.files.readFailed", { name })} />;
  }
}

function RemoveQuestion({
  name,
  busy,
  onConfirm,
  onKeep,
}: {
  readonly name: string;
  readonly busy: boolean;
  readonly onConfirm: () => void;
  readonly onKeep: () => void;
}): ReactElement {
  const { t } = useTranslation();
  const questionId = useId();
  return (
    <div
      role="group"
      aria-labelledby={questionId}
      className="flex flex-wrap items-center gap-(--space-2) rounded-md border border-problem-edge bg-problem-wash p-(--space-2)"
    >
      <p id={questionId} className="grow">
        {t("evidence.files.removeQuestion", { name })}
      </p>
      <Button size="sm" variant="primary" disabled={busy} onClick={onConfirm}>
        {t("evidence.files.removeConfirm")}
      </Button>
      <Button size="sm" onClick={onKeep}>
        {t("evidence.files.removeKeep")}
      </Button>
    </div>
  );
}
