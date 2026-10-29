/**
 * A page that needs an open profile.
 *
 * @packageDocumentation
 */
import type { CoreService } from "@pharoam/core";
import { Navigate } from "@tanstack/react-router";
import type { ReactElement, ReactNode } from "react";
import { useSession } from "../profile/session.tsx";
import { AppShell } from "./app-shell.tsx";

/**
 * Shows a page in the app shell when a profile is open, and goes to the start page when none is.
 *
 * @remarks Nothing is kept between visits, so an address like `#/about` opened fresh starts from the start page.
 * @param props - Renders the page from the open profile's service and folder name.
 * @returns The page in the shell, or a redirect to the start page.
 */
export function ProfileRoute({
  page,
}: {
  readonly page: (service: CoreService, folder: string) => ReactNode;
}): ReactElement {
  const { session, disconnect } = useSession();
  if (session.status !== "open") return <Navigate to="/" />;
  return (
    <AppShell
      folder={session.place}
      attention={session.service.needsAttention().length + session.service.conflicts().length}
      onDisconnect={() => void disconnect()}
    >
      {page(session.service, session.place)}
    </AppShell>
  );
}
