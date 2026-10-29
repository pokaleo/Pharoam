/**
 * The app's home address, which shows the page for where the person is with their profile.
 *
 * @packageDocumentation
 */
import type { ReactElement } from "react";
import { AppShell } from "../layout/app-shell.tsx";
import { useSession } from "../profile/session.tsx";
import { CreateProfilePage } from "./create-profile-page.tsx";
import { ProfileHomePage } from "./profile-home-page.tsx";
import { StartPage } from "./start-page.tsx";
import { UnreadableProfilePage } from "./unreadable-profile-page.tsx";

/**
 * Shows the start page, the profile form, or the open profile.
 *
 * @returns The start page before a folder is open; the form for a folder without a profile (MVP S2.3); the
 * explanation for an unreadable one; the profile's home once open.
 */
export function HomePage(): ReactElement {
  const { session, disconnect } = useSession();
  switch (session.status) {
    case "closed":
      return <StartPage />;
    case "no-profile":
      return <CreateProfilePage folder={session.place} />;
    case "unreadable-profile":
      return <UnreadableProfilePage folder={session.place} />;
    case "open":
      return (
        <AppShell
          folder={session.place}
          attention={session.service.needsAttention().length + session.service.conflicts().length}
          onDisconnect={() => void disconnect()}
        >
          <ProfileHomePage folder={session.place} service={session.service} />
        </AppShell>
      );
  }
}
