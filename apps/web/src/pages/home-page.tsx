/**
 * The app's home address, which shows the page for where the person is with their profile.
 *
 * @packageDocumentation
 */
import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { AppShell } from "../layout/app-shell.tsx";
import { useSession } from "../profile/session.tsx";
import { CreateProfilePage } from "./create-profile-page.tsx";
import { ProfileHomePage } from "./profile-home-page.tsx";
import { StartPage } from "./start-page.tsx";
import { UnreadableProfilePage } from "./unreadable-profile-page.tsx";

/**
 * Shows the start page, the profile form, or the open profile.
 *
 * @remarks A profile kept in the browser's own storage is named "this browser" rather than by its directory
 * (ADR-0020).
 * @returns The start page before a place is open; the form for a place without a profile (MVP S2.3); the
 * explanation for an unreadable one; the profile's home once open.
 */
export function HomePage(): ReactElement {
  const { t } = useTranslation();
  const { session, services, disconnect } = useSession();
  if (session.status === "closed") return <StartPage />;
  const place = services.places.kind === "browser" ? t("place.thisBrowser") : session.place;
  switch (session.status) {
    case "no-profile":
      return <CreateProfilePage folder={place} />;
    case "unreadable-profile":
      return <UnreadableProfilePage folder={place} />;
    case "open":
      return (
        <AppShell
          kind={services.places.kind}
          folder={place}
          attention={session.service.needsAttention().length + session.service.conflicts().length}
          onDisconnect={() => void disconnect()}
        >
          <ProfileHomePage folder={place} service={session.service} />
        </AppShell>
      );
  }
}
