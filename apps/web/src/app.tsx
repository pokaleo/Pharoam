/**
 * The app's root component.
 *
 * @packageDocumentation
 */
import type { ContentPack } from "@pharoam/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, type RouterHistory } from "@tanstack/react-router";
import type { i18n } from "i18next";
import { useLayoutEffect, useState, type ReactElement } from "react";
import { I18nextProvider } from "react-i18next";
import { createI18n } from "./i18n.ts";
import type { Places } from "./profile/places.ts";
import { SessionProvider } from "./profile/session.tsx";
import { createAppRouter } from "./router.tsx";

/** What the app is started with. */
export interface AppProps {
  /** Where addresses come from: hash URLs in the browser, memory in tests. */
  readonly history: RouterHistory;
  /** Whether the browser can open a folder the person chooses (`supportsFolderAccess`). */
  readonly supportsFolders: boolean;
  /** Where profiles are kept: folders in the browser, memory in tests. */
  readonly places: Places;
  /** Loads the content pack. */
  readonly content: () => Promise<ContentPack>;
}

/**
 * Renders the app: translations, the profile session, then the routes.
 *
 * @param props - The address history, what the browser supports, and the app's outside services.
 * @returns The running app.
 */
export function App({ history, supportsFolders, places, content }: AppProps): ReactElement {
  const [translation] = useState(createI18n);
  const [router] = useState(() => createAppRouter({ history, supportsFolders }));
  const [queries] = useState(() => new QueryClient());
  const [services] = useState(() => ({ places, content }));
  useDocumentLanguage(translation);
  return (
    <I18nextProvider i18n={translation}>
      <QueryClientProvider client={queries}>
        <SessionProvider services={services}>
          <RouterProvider router={router} />
        </SessionProvider>
      </QueryClientProvider>
    </I18nextProvider>
  );
}

// Names the page's language and direction, for screen readers, hyphenation and right-to-left layouts (PRD N9), and
// titles the page in that language.
function useDocumentLanguage(translation: i18n): void {
  const language = translation.resolvedLanguage ?? translation.language;
  useLayoutEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = translation.dir(language);
    document.title = translation.t("app.name");
  }, [translation, language]);
}
