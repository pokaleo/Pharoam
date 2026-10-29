/**
 * The app's routes.
 *
 * @remarks TanStack Router with hash URLs, so the app runs on any static host without rewrite rules (ADR-0008, AD18).
 * @packageDocumentation
 */
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Outlet,
  type RouterHistory,
} from "@tanstack/react-router";
import type { ReactElement } from "react";
import { NotFoundPage } from "./pages/not-found-page.tsx";
import { ProfileRoute } from "./layout/profile-route.tsx";
import { AboutPage } from "./pages/about-page.tsx";
import { AttentionPage } from "./pages/attention-page.tsx";
import { GapPage } from "./pages/gap-page.tsx";
import { PathwayPage } from "./pages/pathway-page.tsx";
import { PathwaysPage } from "./pages/pathways-page.tsx";
import { CustomSkillPage } from "./pages/custom-skill-page.tsx";
import { RecordLevelPage } from "./pages/record-level-page.tsx";
import { SkillPage } from "./pages/skill-page.tsx";
import { SkillsPage } from "./pages/skills-page.tsx";
import { EditEvidencePage } from "./pages/edit-evidence-page.tsx";
import { EvidenceListPage } from "./pages/evidence-list-page.tsx";
import { EvidencePage } from "./pages/evidence-page.tsx";
import { NewEvidencePage } from "./pages/new-evidence-page.tsx";
import { HomePage } from "./pages/home-page.tsx";
import { UnsupportedPage } from "./pages/unsupported-page.tsx";

/** What every route can read. */
interface RouterContext {
  /** Whether the browser can keep a profile; without it, every address shows the "not supported yet" page. */
  readonly supported: boolean;
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: Root,
  notFoundComponent: NotFoundPage,
});

function Root(): ReactElement {
  const { supported } = rootRoute.useRouteContext();
  return supported ? <Outlet /> : <UnsupportedPage />;
}

const startRoute = createRoute({ getParentRoute: () => rootRoute, path: "/", component: HomePage });

const aboutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/about",
  component: () => <ProfileRoute page={(service) => <AboutPage service={service} />} />,
});

const evidenceListRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/evidence",
  component: () => <ProfileRoute page={(service) => <EvidenceListPage service={service} />} />,
});

const newEvidenceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/evidence/new",
  component: () => <ProfileRoute page={(service) => <NewEvidencePage service={service} />} />,
});

const evidenceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/evidence/$id",
  component: function Evidence() {
    const { id } = evidenceRoute.useParams();
    return <ProfileRoute page={(service) => <EvidencePage key={id} service={service} id={id} />} />;
  },
});

const editEvidenceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/evidence/$id/edit",
  component: function EditEvidence() {
    const { id } = editEvidenceRoute.useParams();
    return <ProfileRoute page={(service) => <EditEvidencePage key={id} service={service} id={id} />} />;
  },
});

const skillsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/skills",
  component: () => <ProfileRoute page={(service) => <SkillsPage service={service} />} />,
});

const recordLevelRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/skills/record",
  // The skill to start with, by slug, when coming from a skill's page.
  validateSearch: (search: Record<string, unknown>): { skill?: string } =>
    typeof search.skill === "string" ? { skill: search.skill } : {},
  component: function RecordLevel() {
    const { skill } = recordLevelRoute.useSearch();
    return <ProfileRoute page={(service) => <RecordLevelPage service={service} skill={skill} />} />;
  },
});

const customSkillRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/skills/custom",
  component: () => <ProfileRoute page={(service) => <CustomSkillPage service={service} />} />,
});

const skillRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/skills/$skill",
  component: function Skill() {
    const { skill } = skillRoute.useParams();
    return <ProfileRoute page={(service) => <SkillPage key={skill} service={service} skill={skill} />} />;
  },
});

const pathwaysRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/pathways",
  component: () => <ProfileRoute page={() => <PathwaysPage />} />,
});

const pathwayRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/pathways/$slug",
  component: function Pathway() {
    const { slug } = pathwayRoute.useParams();
    return <ProfileRoute page={() => <PathwayPage key={slug} slug={slug} />} />;
  },
});

const gapRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/pathways/$slug/gap",
  component: function Gap() {
    const { slug } = gapRoute.useParams();
    return <ProfileRoute page={(service) => <GapPage key={slug} service={service} slug={slug} />} />;
  },
});

const attentionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/attention",
  component: () => <ProfileRoute page={(service) => <AttentionPage service={service} />} />,
});

const routeTree = rootRoute.addChildren([
  pathwaysRoute,
  pathwayRoute,
  gapRoute,
  attentionRoute,
  skillsRoute,
  recordLevelRoute,
  customSkillRoute,
  skillRoute,
  startRoute,
  aboutRoute,
  evidenceListRoute,
  newEvidenceRoute,
  evidenceRoute,
  editEvidenceRoute,
]);

/**
 * Creates the app's router.
 *
 * @param options - Where addresses come from (hash URLs in the app, memory in tests) and what the routes can read.
 * @returns The router, ready for `RouterProvider`.
 */
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types -- The router's type is inferred from the route tree, so links are type-checked; spelling it out would repeat the tree.
export function createAppRouter(options: RouterContext & { readonly history: RouterHistory }) {
  return createRouter({
    routeTree,
    history: options.history,
    context: { supported: options.supported },
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
  // What a page passes to the next in the history entry, not the address: nothing here is profile data kept anywhere.
  interface HistoryState {
    /** The title of the evidence just deleted, so the list can say so (MVP S5.2). */
    deleted?: string;
  }
}
