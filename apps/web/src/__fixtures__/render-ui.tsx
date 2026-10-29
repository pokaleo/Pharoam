// Renders one component for a test, with the translations and a router around it, and optionally a session.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { render, type RenderResult } from "@testing-library/react";
import type { ReactElement } from "react";
import { I18nextProvider } from "react-i18next";
import { loadContentPack } from "../content.ts";
import { createI18n } from "../i18n.ts";
import type { Places } from "../profile/places.ts";
import { SessionProvider, type AppServices } from "../profile/session.tsx";

/** Places that never open anything, for components that only need the content pack. */
export const NO_PLACES: Places = {
  kind: "folder",
  remembered: () => Promise.resolve(undefined),
  reopen: () => Promise.resolve({ ok: false, error: { kind: "forgotten" } }),
  choose: () => Promise.resolve({ ok: false, error: { kind: "cancelled" } }),
  forget: () => Promise.resolve(),
};

/** The services a test session uses by default: the real content pack, and no places. */
export const TEST_SERVICES: AppServices = { places: NO_PLACES, content: loadContentPack };

/**
 * Renders a component inside the translations, a query client, a session and a router at `/`.
 *
 * @param ui - The component.
 * @param services - The session's services; the real content pack and no places by default.
 * @returns The render result; the component appears once the router has loaded, so find it with `findBy`.
 */
export function renderUi(ui: ReactElement, services: AppServices = TEST_SERVICES): RenderResult {
  const rootRoute = createRootRoute({
    component: () => (
      <>
        {ui}
        <Outlet />
      </>
    ),
  });
  const router = createRouter({ routeTree: rootRoute, history: createMemoryHistory({ initialEntries: ["/"] }) });
  return render(
    <I18nextProvider i18n={createI18n()}>
      <QueryClientProvider client={new QueryClient()}>
        <SessionProvider services={services}>
          <RouterProvider router={router} />
        </SessionProvider>
      </QueryClientProvider>
    </I18nextProvider>,
  );
}
