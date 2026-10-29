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
  type ContentPack,
  type CoreService,
  type CoreServiceOptions,
  type Result,
  type StorageError,
} from "@pharoam/core";
import type { TFunction } from "i18next";
import { createContext, useContext, useMemo, useState, type ReactElement, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { Places, ProfilePlace } from "./places.ts";
import { gapWriter, overviewWriter } from "./writers.ts";

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

/** What the app needs from outside: where profiles are kept, and the content it is built with. */
export interface AppServices {
  /** Choosing, reopening and forgetting the profile's place. */
  readonly places: Places;
  /** Loads the content pack. */
  readonly content: () => Promise<ContentPack>;
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
        setSession(sessionFor(place.name, service));
        return ok(undefined);
      },
      profileCreated: () => {
        if (session.status === "no-profile") setSession({ ...session, status: "open", revision: 0 });
      },
      changed: () => {
        if (session.status === "open") setSession({ ...session, revision: session.revision + 1 });
      },
      disconnect: async () => {
        closeService(session);
        setSession({ status: "closed" });
        await services.places.forget();
      },
    };
  }, [session, services, t]);

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
