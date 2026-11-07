/**
 * The open profile, shared with every screen.
 *
 * @remarks The interface talks only to the core service (AGENTS.md rule 11). The service holds what it read in
 * memory; screens re-render from it when the session's revision changes after a save.
 * @packageDocumentation
 */
import {
  createCoreService,
  err,
  ok,
  type CallRecord,
  type ContentPack,
  type CoreService,
  type CoreServiceOptions,
  type Result,
  type StorageError,
} from "@pharoam/core";
import type { TFunction } from "i18next";
import {
  createContext,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import type { Places, ProfilePlace } from "./places.ts";
import { gapWriter, overviewWriter } from "./writers.ts";
import type { LoadProvider, ModelSetup } from "../ai/providers.ts";

/**
 * Where the person is with their profile.
 *
 * @remarks `closed`: no folder is open. `no-profile`: the folder has no `pharoam.md`, so the person is offered to
 * create one there (MVP S2.3). `unreadable-profile`: `pharoam.md` is there but can't be read, so it is never
 * replaced (hard rule 3). `open`: the profile is open.
 */
export type Session =
  | { readonly status: "closed" }
  | { readonly status: "no-profile"; readonly place: string; readonly service: CoreService }
  | { readonly status: "unreadable-profile"; readonly place: string }
  | {
      readonly status: "open";
      readonly place: string;
      readonly service: CoreService;
      readonly revision: number;
    };

/** What the app needs from outside: where profiles are kept, the content it is built with, and model providers. */
export interface AppServices {
  /** Choosing, reopening and forgetting the profile's place. */
  readonly places: Places;
  /** Loads the content pack. */
  readonly content: () => Promise<ContentPack>;
  /** Loads the model provider the person chooses (MVP S13). */
  readonly providers: LoadProvider;
}

/** One AI call made in this session, as the activity log shows it (MVP S17). */
export interface LoggedCall {
  /** Tells calls apart in this session, in the order they were made. */
  readonly id: number;
  /** The call's record: task, model, time, exactly what was sent, and what came back. */
  readonly call: CallRecord;
  /** What the person did with the answer, once a screen knows. */
  readonly decision?: "accepted" | "discarded";
}

/** The session and what changes it. */
export interface SessionControls {
  /** Where the person is with their profile. */
  readonly session: Session;
  /** The app's outside services. */
  readonly services: AppServices;
  /** Reads a place the person chose; writes nothing (MVP S2.1). */
  readonly connect: (place: ProfilePlace) => Promise<Result<undefined, StorageError>>;
  /** Marks the profile open after it was created in the folder (MVP S1). */
  readonly profileCreated: () => void;
  /** Re-renders the screens after a save. */
  readonly changed: () => void;
  /** Forgets the folder and everything read from it (MVP S2.4). */
  readonly disconnect: () => Promise<void>;
  /** The model set up for this session, or `undefined`; kept in memory only, never written (MVP S13.4). */
  readonly model: ModelSetup | undefined;
  /** Sets up a model, with its key, for the rest of the session. */
  readonly chooseModel: (setup: ModelSetup) => void;
  /** Removes the model and forgets its key (MVP S13.8). */
  readonly removeModel: () => void;
  /**
   * The AI calls made with the open profile, oldest first (MVP S17.2).
   *
   * @remarks Kept in memory only: opening or closing a profile, or reloading the page, forgets them, and nothing
   * of them is written to storage (S17.3).
   */
  readonly calls: readonly LoggedCall[];
  /** Adds a call to the log, if the profile it was made with is still open; returns its ID. */
  readonly logCall: (call: CallRecord) => number;
  /** Records whether the person accepted or discarded what a call answered (MVP S17.1). */
  readonly decideCall: (id: number, decision: "accepted" | "discarded") => void;
}

const SessionContext = createContext<SessionControls | undefined>(undefined);

/**
 * Holds the session for the screens inside it.
 *
 * @param props - The app's outside services, and the screens.
 * @returns The screens, with the session available through {@link useSession}.
 */
export function SessionProvider({
  services,
  children,
}: {
  readonly services: AppServices;
  readonly children: ReactNode;
}): ReactElement {
  const { t } = useTranslation();
  const [session, setSession] = useState<Session>({ status: "closed" });
  // The model and its key, held only here: a reload or closing the profile forgets them (ADR-0011, MVP S13.4).
  const [model, setModel] = useState<ModelSetup | undefined>(undefined);
  // The AI calls made with the open profile, kept with the service they belong to, so a call that ends after the
  // profile closed is never logged against the next one (MVP S17.3).
  const [log, setLog] = useState<{ readonly owner: unknown; readonly calls: readonly LoggedCall[] }>({
    owner: undefined,
    calls: [],
  });
  const nextCall = useRef(0);

  const controls = useMemo<SessionControls>(() => {
    const closeService = (current: Session): void => {
      if (current.status === "open" || current.status === "no-profile") current.service.close();
    };
    return {
      session,
      services,
      connect: async (place) => {
        const content = await services.content();
        const service = createCoreService({
          storage: place.storage,
          ids: { now: Date.now, fillRandom },
          content,
          ...writers(t, content),
        });
        const opened = await service.open();
        if (!opened.ok) return err(opened.error);
        closeService(session);
        setModel(undefined);
        setLog({ owner: service, calls: [] });
        setSession(sessionFor(place.name, service));
        return ok(undefined);
      },
      profileCreated: () => {
        if (session.status === "no-profile") setSession({ ...session, status: "open", revision: 0 });
      },
      changed: () => {
        if (session.status !== "open") return;
        const { service } = session;
        // Only for the profile it was made for: a scan that finishes after the profile was closed, or another
        // opened, changes nothing on screen.
        setSession((current) =>
          current.status === "open" && current.service === service
            ? { ...current, revision: current.revision + 1 }
            : current,
        );
      },
      disconnect: async () => {
        closeService(session);
        // Forgotten before the start page shows, which would otherwise still find the folder and offer it again.
        await services.places.forget();
        setModel(undefined);
        setLog({ owner: undefined, calls: [] });
        setSession({ status: "closed" });
      },
      model,
      chooseModel: setModel,
      removeModel: () => {
        setModel(undefined);
      },
      calls: log.calls,
      logCall: (call) => {
        const id = ++nextCall.current;
        const owner = session.status === "open" ? session.service : undefined;
        setLog((current) =>
          current.owner === owner ? { owner, calls: [...current.calls, { id, call }] } : current,
        );
        return id;
      },
      decideCall: (id, decision) => {
        setLog((current) => ({
          ...current,
          calls: current.calls.map((one) => (one.id === id ? { ...one, decision } : one)),
        }));
      },
    };
  }, [session, services, t, model, log]);

  return <SessionContext value={controls}>{children}</SessionContext>;
}

/**
 * The session, for a screen inside {@link SessionProvider}.
 *
 * @returns The session and what changes it.
 * @throws When called outside {@link SessionProvider}, which is a bug.
 */
export function useSession(): SessionControls {
  const controls = useContext(SessionContext);
  if (controls === undefined) throw new Error("useSession must be called inside SessionProvider");
  return controls;
}

// Secure randomness for new IDs. Filled through a fresh array, since the browser refuses views of shared memory.
function fillRandom(bytes: Uint8Array): void {
  bytes.set(crypto.getRandomValues(new Uint8Array(bytes.length)));
}

function writers(t: TFunction, content: ContentPack): Pick<CoreServiceOptions, "overview" | "gapSummary"> {
  const names = Object.values(content.levels.levels).map((level) => level.name);
  return {
    overview: overviewWriter(t),
    gapSummary: gapWriter(t, (level) => names[level] ?? String(level)),
  };
}

// A folder whose pharoam.md can't be read holds a profile all the same: offering to create one would mean
// replacing a file the person may have edited by hand.
function sessionFor(place: string, service: CoreService): Session {
  if (service.profile() !== undefined) return { status: "open", place, service, revision: 0 };
  const unreadable = service
    .needsAttention()
    .some((item) => item.location.split("/").at(-1) === "pharoam.md");
  if (unreadable) {
    service.close();
    return { status: "unreadable-profile", place };
  }
  return { status: "no-profile", place, service };
}
