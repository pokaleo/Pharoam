/**
 * Settings: the model the person sets up for AI help (MVP S13).
 *
 * @packageDocumentation
 */
import { checkModel, runTask, type ModelInfo } from "@pharoam/core";
import { useId, useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import {
  PROVIDERS,
  providerAddress,
  type LoadProvider,
  type ModelSetup,
  type ProviderChoice,
  type ProviderKind,
} from "../ai/providers.ts";
import { providerProblem, taskProblem } from "../ai/problems.ts";
import { useSession } from "../profile/session.tsx";
import { Button } from "../ui/button.tsx";
import { SelectField, TextField } from "../ui/field.tsx";
import { Notice } from "../ui/notice.tsx";
import { PageTitle } from "../ui/page-title.tsx";

const KINDS = Object.keys(PROVIDERS) as readonly ProviderKind[];

/**
 * Shows the settings: the model for AI help, and nothing else yet.
 *
 * @remarks A model is optional; everything else in Pharoam works without one (MVP S13.1). The key is held in the
 * session's memory only, never written anywhere (S13.4).
 * @returns The page, with the model form when none is set up, or the model in use with its test and removal.
 */
export function SettingsPage(): ReactElement {
  const { t } = useTranslation();
  const { services, model, chooseModel, removeModel } = useSession();
  const titleId = useId();
  return (
    <>
      <PageTitle title={t("settings.title")} lead={t("settings.lead")} />
      <section
        aria-labelledby={titleId}
        className="grid max-w-(--reading-measure) gap-(--space-4) rounded-lg border border-line bg-surface p-(--pad)"
      >
        <h2 id={titleId} className="text-section font-bold tracking-[-0.01em]">
          {t("settings.model.title")}
        </h2>
        {model === undefined ? (
          <ModelForm load={services.providers} onUse={chooseModel} />
        ) : (
          <CurrentModel setup={model} load={services.providers} onRemove={removeModel} />
        )}
      </section>
    </>
  );
}

// Choosing a provider and a model: the address is checked before anything is loaded or called (S13.5), and the
// provider's code loads only when the person asks for its models (S13.1).
function ModelForm({
  load,
  onUse,
}: {
  readonly load: LoadProvider;
  readonly onUse: (setup: ModelSetup) => void;
}): ReactElement {
  const { t } = useTranslation();
  const [kind, setKind] = useState<ProviderKind>("anthropic");
  const [address, setAddress] = useState(PROVIDERS.local.address);
  const [key, setKey] = useState("");
  const [models, setModels] = useState<readonly ModelInfo[] | undefined>(undefined);
  const [picked, setPicked] = useState("");
  const [typed, setTyped] = useState("");
  const [problem, setProblem] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const option = PROVIDERS[kind];
  const name = t(`settings.model.names.${kind}`);

  const choice = (): ProviderChoice | undefined => {
    const checked = providerAddress(kind, address);
    if (!checked.ok) {
      setProblem(t("settings.model.notLocal"));
      return undefined;
    }
    return option.needsKey ? { kind, address: checked.value, apiKey: key } : { kind, address: checked.value };
  };

  const showModels = async (): Promise<void> => {
    const chosen = choice();
    if (chosen === undefined) return;
    setBusy(true);
    setProblem(undefined);
    const listed = await (await load(chosen)).listModels();
    setBusy(false);
    setModels(listed.ok ? listed.value : []);
    if (!listed.ok) setProblem(providerProblem(t, listed.error, name));
  };

  const use = (): void => {
    const chosen = choice();
    if (chosen === undefined) return;
    const model = typed.trim() === "" ? picked : typed.trim();
    if (model === "") {
      setProblem(t("settings.model.noModel"));
      return;
    }
    const listedName = typed.trim() === "" ? models?.find((one) => one.id === model)?.name : undefined;
    onUse(listedName === undefined ? { choice: chosen, model } : { choice: chosen, model, name: listedName });
  };

  return (
    <div className="grid gap-(--space-4)">
      <p className="text-ink-2">{t("settings.model.none")}</p>
      <fieldset className="grid gap-(--space-2)">
        <legend className="mb-(--space-1) font-semibold">{t("settings.model.provider")}</legend>
        {KINDS.map((one) => (
          <label key={one} className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name="provider"
              value={one}
              checked={kind === one}
              onChange={() => {
                setKind(one);
                setModels(undefined);
                setPicked("");
                setProblem(undefined);
              }}
              className="size-4 accent-(--ink)"
            />
            {t(`settings.model.providers.${one}`)}
          </label>
        ))}
      </fieldset>
      {option.dataPolicy === undefined ? (
        <div className="grid gap-1 rounded-md bg-panel p-(--space-3) text-meta">
          <p>{t("settings.model.localTerms")}</p>
          <p className="text-ink-2">{t("settings.model.localSteps", { origin: window.location.origin })}</p>
        </div>
      ) : (
        <div className="grid gap-1 rounded-md bg-panel p-(--space-3) text-meta">
          <p>{t("settings.model.terms", { provider: name })}</p>
          <a
            href={option.dataPolicy}
            target="_blank"
            rel="noopener noreferrer"
            className="text-channel underline"
          >
            {t("settings.model.policy", { provider: name })}
          </a>
        </div>
      )}
      {kind === "local" ? (
        <TextField
          label={t("settings.model.address")}
          hint={t("settings.model.addressHint")}
          value={address}
          onChange={(event) => {
            setAddress(event.target.value);
          }}
          inputMode="url"
          spellCheck={false}
        />
      ) : (
        <TextField
          label={t("settings.model.key")}
          hint={t("settings.model.keyHint")}
          type="password"
          autoComplete="off"
          value={key}
          onChange={(event) => {
            setKey(event.target.value);
          }}
          spellCheck={false}
        />
      )}
      <div>
        <Button disabled={busy} onClick={() => void showModels()}>
          {busy ? t("settings.model.asking", { provider: name }) : t("settings.model.showModels")}
        </Button>
      </div>
      {problem === undefined ? null : <Notice tone="problem" title={problem} />}
      {models === undefined || models.length === 0 ? null : (
        <SelectField
          label={t("settings.model.pick")}
          value={picked}
          onChange={(event) => {
            setPicked(event.target.value);
          }}
          options={[
            { value: "", label: t("settings.model.pickNone") },
            ...models.map((one) => ({ value: one.id, label: one.name })),
          ]}
        />
      )}
      <TextField
        label={t("settings.model.typeId")}
        hint={t("settings.model.typeIdHint")}
        value={typed}
        onChange={(event) => {
          setTyped(event.target.value);
        }}
        spellCheck={false}
      />
      <div>
        <Button variant="primary" onClick={use}>
          {t("settings.model.use")}
        </Button>
      </div>
    </div>
  );
}

// The model in use, a test call that sends nothing of the person's (S13.3), and removing it (S13.8).
function CurrentModel({
  setup,
  load,
  onRemove,
}: {
  readonly setup: ModelSetup;
  readonly load: LoadProvider;
  readonly onRemove: () => void;
}): ReactElement {
  const { t } = useTranslation();
  const { logCall } = useSession();
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<{ readonly works: boolean; readonly text: string } | undefined>(
    undefined,
  );
  const name = t(`settings.model.names.${setup.choice.kind}`);
  const model =
    setup.name === undefined ? setup.model : t("settings.model.named", { name: setup.name, id: setup.model });

  const test = async (): Promise<void> => {
    setBusy(true);
    setOutcome(undefined);
    const answer = await runTask(
      await load(setup.choice),
      checkModel,
      {},
      { model: setup.model, now: () => new Date() },
    );
    logCall(answer.ok ? answer.value.call : answer.error.call);
    setBusy(false);
    setOutcome(
      answer.ok
        ? { works: true, text: t("settings.model.works") }
        : { works: false, text: taskProblem(t, answer.error.reason, name) },
    );
  };

  return (
    <div className="grid gap-(--space-3)">
      <p>{t("settings.model.current", { model, provider: name })}</p>
      <div className="flex flex-wrap gap-(--space-2)">
        <Button disabled={busy} onClick={() => void test()}>
          {busy ? t("settings.model.testing") : t("settings.model.test")}
        </Button>
        <Button variant="quiet" onClick={onRemove}>
          {t("settings.model.remove")}
        </Button>
      </div>
      {outcome === undefined ? null : outcome.works ? (
        <p role="status">{outcome.text}</p>
      ) : (
        <Notice tone="problem" title={outcome.text} />
      )}
    </div>
  );
}
